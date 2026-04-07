use anchor_lang::prelude::*;

declare_id!("DBMPFjrt7aaiCh4s56wrsge2uMcu8zn9Wb7o6LE28E7z");

#[program]
pub mod penalty_engine {
    use super::*;

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

        record.contract = ctx.accounts.contract_data.key();
        record.penalty_type = penalty_type;
        record.amount = actual_penalty;
        record.days_overdue = days_overdue;
        record.triggered_by = ctx.accounts.caller.key();
        record.timestamp = clock.unix_timestamp;
        record.bump = ctx.bumps.penalty_record;

        // CPI: withdraw_penalty from contract_registry (escrow → treasury)
        let cpi_program = ctx.accounts.contract_registry_program.to_account_info();
        let cpi_accounts = contract_registry::cpi::accounts::WithdrawPenalty {
            government_contract: ctx.accounts.government_contract.to_account_info(),
            escrow: ctx.accounts.escrow.to_account_info(),
            district_treasury: ctx.accounts.district_treasury.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        contract_registry::cpi::withdraw_penalty(cpi_ctx, actual_penalty)?;

        // CPI: deposit into district_treasury (update balance counter)
        let treasury_cpi_program = ctx.accounts.district_treasury_program.to_account_info();
        let treasury_cpi_accounts = district_treasury::cpi::accounts::Deposit {
            district_treasury: ctx.accounts.district_treasury.to_account_info(),
            depositor: ctx.accounts.caller.to_account_info(),
        };
        let treasury_cpi_ctx = CpiContext::new(treasury_cpi_program, treasury_cpi_accounts);
        district_treasury::cpi::deposit(treasury_cpi_ctx, actual_penalty)?;

        emit!(PenaltyExecuted {
            contract: record.contract,
            penalty_type,
            amount: actual_penalty,
            total_accumulated: capped,
            cap: max_penalty,
            triggered_by: record.triggered_by,
        });

        if capped >= max_penalty {
            emit!(PenaltyCapped {
                contract: record.contract,
                total_penalty: capped,
            });
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct ExecutePenalty<'info> {
    pub contract_data: Account<'info, ContractRef>,
    #[account(mut)]
    pub government_contract: Account<'info, contract_registry::GovernmentContract>,
    /// CHECK: Verified by contract_registry CPI
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,
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
    pub district_treasury_program: Program<'info, district_treasury::program::DistrictTreasury>,
    pub contract_registry_program: Program<'info, contract_registry::program::ContractRegistry>,
    #[account(mut)]
    pub caller: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ContractRef {
    pub total_amount: u64,
    pub penalty_accumulated: u64,
    pub district: String,
}

#[account]
pub struct PenaltyRecord {
    pub contract: Pubkey,
    pub penalty_type: PenaltyType,
    pub amount: u64,
    pub days_overdue: u64,
    pub triggered_by: Pubkey,
    pub timestamp: i64,
    pub bump: u8,
}

impl PenaltyRecord {
    pub const SPACE: usize = 8 + 32 + 1 + 8 + 8 + 32 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PenaltyType {
    TimeOverdue,
    QualityRejected,
    GhostSite,
}

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

#[error_code]
pub enum PenaltyError {
    #[msg("No penalty due — cap already reached or zero amount")]
    NoPenaltyDue,
}
