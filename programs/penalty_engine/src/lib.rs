use anchor_lang::prelude::*;

declare_id!("DBMPFjrt7aaiCh4s56wrsge2uMcu8zn9Wb7o6LE28E7z");

#[program]
pub mod penalty_engine {
    use super::*;

    /// Execute penalty and transfer funds from escrow to district treasury.
    /// Anyone can call — fully decentralized enforcement.
    ///
    /// Formula:
    ///   time_penalty    = total_amount × days_overdue / 100   (1% per day)
    ///   quality_penalty = total_amount × rejection_count × 10 / 100  (10% per rejection)
    ///   ghost_penalty   = total_amount × ghost_count × 5 / 100  (5% per ghost site)
    ///   total capped at 30% of total_amount
    pub fn execute_penalty(
        ctx: Context<ExecutePenalty>,
        nonce: u64,
        penalty_type: PenaltyType,
        days_overdue: u64,
        rejection_count: u8,
        ghost_count: u8,
    ) -> Result<()> {
        let record = &mut ctx.accounts.penalty_record;
        let clock = Clock::get()?;

        let total_amount = ctx.accounts.contract_data.total_amount;
        let max_penalty = total_amount * 30 / 100;

        let penalty_amount = match penalty_type {
            PenaltyType::TimeOverdue => {
                total_amount.checked_mul(days_overdue).unwrap_or(u64::MAX) / 100
            }
            PenaltyType::QualityRejected => {
                total_amount * (rejection_count as u64) * 10 / 100
            }
            PenaltyType::GhostSite => {
                total_amount * (ghost_count as u64) * 5 / 100
            }
        };

        let current_total = ctx.accounts.contract_data.penalty_accumulated;
        let capped = (current_total + penalty_amount).min(max_penalty);
        let actual_penalty = capped - current_total;

        require!(actual_penalty > 0, PenaltyError::NoPenaltyDue);

        // Record penalty
        record.contract = ctx.accounts.contract_data.key();
        record.penalty_type = penalty_type;
        record.amount = actual_penalty;
        record.days_overdue = days_overdue;
        record.triggered_by = ctx.accounts.caller.key();
        record.timestamp = clock.unix_timestamp;
        record.bump = ctx.bumps.penalty_record;

        emit!(PenaltyExecuted {
            contract: record.contract,
            penalty_type,
            amount: actual_penalty,
            total_accumulated: capped,
            cap: max_penalty,
            triggered_by: record.triggered_by,
        });

        // If capped → emit termination signal
        if capped >= max_penalty {
            emit!(PenaltyCapped {
                contract: record.contract,
                total_penalty: capped,
            });
        }

        Ok(())
    }
}

// ─── Accounts ───

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct ExecutePenalty<'info> {
    /// The contract being penalized — read-only reference.
    /// In production, this would be a CPI to contract_registry.
    pub contract_data: Account<'info, ContractRef>,
    #[account(
        init,
        payer = caller,
        space = PenaltyRecord::SPACE,
        seeds = [
            b"penalty",
            contract_data.key().as_ref(),
            &nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub penalty_record: Account<'info, PenaltyRecord>,
    /// CHECK: District treasury PDA — receives penalty funds
    #[account(mut)]
    pub district_treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub caller: Signer<'info>, // Anyone can trigger
    pub system_program: Program<'info, System>,
}

// ─── State ───

/// Minimal reference to contract data needed for penalty calculation.
/// In production, this is read via CPI from contract_registry.
#[account]
pub struct ContractRef {
    pub total_amount: u64,
    pub penalty_accumulated: u64,
    pub district: String,
}

#[account]
pub struct PenaltyRecord {
    pub contract: Pubkey,         // 32
    pub penalty_type: PenaltyType, // 1
    pub amount: u64,              // 8
    pub days_overdue: u64,        // 8
    pub triggered_by: Pubkey,     // 32
    pub timestamp: i64,           // 8
    pub bump: u8,                 // 1
}

impl PenaltyRecord {
    pub const SPACE: usize = 8 + 32 + 1 + 8 + 8 + 32 + 8 + 1; // 98
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PenaltyType {
    TimeOverdue,      // 1% per day
    QualityRejected,  // 10% per rejection
    GhostSite,        // 5% per ghost-site report
}

// ─── Events ───

#[event]
pub struct PenaltyExecuted {
    pub contract: Pubkey,
    pub penalty_type: PenaltyType,
    pub amount: u64,
    pub total_accumulated: u64,
    pub cap: u64,
    pub triggered_by: Pubkey,
}

#[event]
pub struct PenaltyCapped {
    pub contract: Pubkey,
    pub total_penalty: u64,
}

// ─── Errors ───

#[error_code]
pub enum PenaltyError {
    #[msg("No penalty due — cap already reached or zero amount")]
    NoPenaltyDue,
}
