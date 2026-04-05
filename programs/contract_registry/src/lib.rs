use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6E9SJu8QPEAoyuZRh9SBhVMtkYypFmgYsHFbJb792pz4");

#[program]
pub mod contract_registry {
    use super::*;

    /// Register a new government contract. Akimat-only.
    /// 20% of total_amount is transferred to escrow PDA immediately.
    pub fn register_contract(
        ctx: Context<RegisterContract>,
        title: String,
        district: String,
        total_amount: u64,
        deadline: i64,
        milestones: Vec<MilestoneInput>,
        lat: f64,
        lng: f64,
    ) -> Result<()> {
        require!(milestones.len() >= 2 && milestones.len() <= 10, ContractError::InvalidMilestoneCount);

        let total_pct: u8 = milestones.iter().map(|m| m.tranche_pct).sum();
        require!(total_pct == 100, ContractError::MilestonePercentageMismatch);

        let contract_key = ctx.accounts.government_contract.key();
        let contract = &mut ctx.accounts.government_contract;
        contract.id = contract_key;
        contract.authority = ctx.accounts.authority.key();
        contract.contractor = ctx.accounts.contractor.key();
        contract.title = title;
        contract.district = district;
        contract.total_amount = total_amount;
        contract.escrow_amount = total_amount / 5; // 20%
        contract.penalty_amount = 0;
        contract.deadline = deadline;
        contract.status = ContractStatus::Active;
        contract.lat = lat;
        contract.lng = lng;
        contract.milestone_count = milestones.len() as u8;
        contract.milestones_accepted = 0;
        contract.created_at = Clock::get()?.unix_timestamp;
        contract.bump = ctx.bumps.government_contract;

        // Store milestones
        contract.milestones = milestones.iter().enumerate().map(|(i, m)| {
            Milestone {
                description: m.description.clone(),
                deadline_days: m.deadline_days,
                tranche_pct: m.tranche_pct,
                status: MilestoneStatus::Pending,
                sort_order: i as u8,
            }
        }).collect();

        // Transfer escrow from authority to escrow PDA
        let escrow_amount = contract.escrow_amount;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            escrow_amount,
        )?;

        emit!(ContractRegistered {
            contract: contract.key(),
            title: contract.title.clone(),
            total_amount,
            district: contract.district.clone(),
        });

        Ok(())
    }

    /// Contractor submits milestone completion with IPFS evidence hash.
    pub fn submit_milestone(
        ctx: Context<SubmitMilestone>,
        milestone_index: u8,
        evidence_hash: String, // IPFS/Arweave hash of photos
    ) -> Result<()> {
        let contract = &mut ctx.accounts.government_contract;
        require!(contract.status == ContractStatus::Active, ContractError::ContractNotActive);

        let idx = milestone_index as usize;
        require!(idx < contract.milestones.len(), ContractError::InvalidMilestoneIndex);
        require!(
            contract.milestones[idx].status == MilestoneStatus::Pending ||
            contract.milestones[idx].status == MilestoneStatus::Rejected,
            ContractError::MilestoneNotSubmittable
        );

        contract.milestones[idx].status = MilestoneStatus::Submitted;

        emit!(MilestoneSubmitted {
            contract: contract.key(),
            milestone_index,
            evidence_hash,
        });

        Ok(())
    }

    /// Accept a milestone (called by jury_mechanism after successful vote).
    /// Releases tranche to contractor.
    pub fn accept_milestone(
        ctx: Context<AcceptMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        let contract = &mut ctx.accounts.government_contract;
        let idx = milestone_index as usize;
        require!(idx < contract.milestones.len(), ContractError::InvalidMilestoneIndex);
        require!(
            contract.milestones[idx].status == MilestoneStatus::UnderReview,
            ContractError::MilestoneNotUnderReview
        );

        contract.milestones[idx].status = MilestoneStatus::Accepted;
        contract.milestones_accepted += 1;

        // Calculate tranche and transfer from escrow to contractor
        let tranche = (contract.total_amount as u128)
            .checked_mul(contract.milestones[idx].tranche_pct as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;

        // Transfer from escrow PDA to contractor
        let contract_key = contract.key();
        let escrow_seeds = &[
            b"escrow",
            contract_key.as_ref(),
            &[ctx.bumps.escrow],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.contractor.to_account_info(),
                },
                signer_seeds,
            ),
            tranche,
        )?;

        // If all milestones accepted → complete contract
        if contract.milestones_accepted == contract.milestone_count {
            contract.status = ContractStatus::Completed;
            emit!(ContractCompleted { contract: contract.key() });
        }

        emit!(MilestoneAccepted {
            contract: contract.key(),
            milestone_index,
            tranche,
        });

        Ok(())
    }

    /// Reject a milestone (called by jury_mechanism after failed vote).
    pub fn reject_milestone(
        ctx: Context<RejectMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        let contract = &mut ctx.accounts.government_contract;
        let idx = milestone_index as usize;
        require!(idx < contract.milestones.len(), ContractError::InvalidMilestoneIndex);

        contract.milestones[idx].status = MilestoneStatus::Rejected;

        emit!(MilestoneRejected {
            contract: contract.key(),
            milestone_index,
        });

        Ok(())
    }

    /// Check deadline and auto-penalize if overdue. Anyone can call this.
    pub fn check_deadline(ctx: Context<CheckDeadline>) -> Result<()> {
        let contract = &mut ctx.accounts.government_contract;
        require!(contract.status == ContractStatus::Active, ContractError::ContractNotActive);

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        if now > contract.deadline {
            let days_overdue = ((now - contract.deadline) / 86400) as u64;
            // 1% per day, capped at 30% total
            let time_penalty = contract.total_amount
                .checked_mul(days_overdue)
                .unwrap_or(u64::MAX)
                / 100;

            let max_penalty = contract.total_amount * 30 / 100;
            let total_penalty = (contract.penalty_amount + time_penalty).min(max_penalty);
            let new_penalty = total_penalty - contract.penalty_amount;

            if new_penalty > 0 {
                contract.penalty_amount = total_penalty;
                contract.status = ContractStatus::Penalized;

                emit!(PenaltyTriggered {
                    contract: contract.key(),
                    penalty_type: PenaltyType::TimeOverdue,
                    amount: new_penalty,
                    days_overdue,
                    triggered_by: ctx.accounts.caller.key(),
                });
            }

            // If penalty maxed → flag for termination
            if total_penalty >= max_penalty {
                emit!(ContractFlaggedForTermination {
                    contract: contract.key(),
                });
            }
        }

        Ok(())
    }

    /// Terminate contract. Akimat-only. Returns remaining escrow to city.
    pub fn terminate_contract(ctx: Context<TerminateContract>) -> Result<()> {
        let contract = &mut ctx.accounts.government_contract;
        require!(
            contract.status == ContractStatus::Penalized || contract.status == ContractStatus::Disputed,
            ContractError::CannotTerminate
        );
        contract.status = ContractStatus::Terminated;

        emit!(ContractTerminated { contract: contract.key() });
        Ok(())
    }
}

// ─── Instruction inputs ───

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MilestoneInput {
    pub description: String,
    pub deadline_days: u16,
    pub tranche_pct: u8,
}

// ─── Accounts ───

#[derive(Accounts)]
#[instruction(title: String, district: String)]
pub struct RegisterContract<'info> {
    #[account(
        init,
        payer = authority,
        space = GovernmentContract::SPACE,
        seeds = [b"contract", authority.key().as_ref(), title.as_bytes()],
        bump,
    )]
    pub government_contract: Account<'info, GovernmentContract>,
    /// CHECK: Escrow PDA, holds escrowed funds
    #[account(
        mut,
        seeds = [b"escrow", government_contract.key().as_ref()],
        bump,
    )]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: Contractor wallet
    pub contractor: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>, // Akimat admin
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    #[account(mut, has_one = contractor)]
    pub government_contract: Account<'info, GovernmentContract>,
    pub contractor: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptMilestone<'info> {
    #[account(mut)]
    pub government_contract: Account<'info, GovernmentContract>,
    /// CHECK: Escrow PDA
    #[account(
        mut,
        seeds = [b"escrow", government_contract.key().as_ref()],
        bump,
    )]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: Contractor wallet receives tranche
    #[account(mut)]
    pub contractor: UncheckedAccount<'info>,
    pub authority: Signer<'info>, // jury_mechanism program
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RejectMilestone<'info> {
    #[account(mut)]
    pub government_contract: Account<'info, GovernmentContract>,
    pub authority: Signer<'info>, // jury_mechanism program
}

#[derive(Accounts)]
pub struct CheckDeadline<'info> {
    #[account(mut)]
    pub government_contract: Account<'info, GovernmentContract>,
    pub caller: Signer<'info>, // Anyone can call
}

#[derive(Accounts)]
pub struct TerminateContract<'info> {
    #[account(mut, has_one = authority)]
    pub government_contract: Account<'info, GovernmentContract>,
    pub authority: Signer<'info>, // Akimat admin
}

// ─── State ───

#[account]
pub struct GovernmentContract {
    pub id: Pubkey,                 // 32
    pub authority: Pubkey,          // 32 (akimat)
    pub contractor: Pubkey,         // 32
    pub title: String,              // 4 + 128
    pub district: String,           // 4 + 64
    pub total_amount: u64,          // 8
    pub escrow_amount: u64,         // 8
    pub penalty_amount: u64,        // 8
    pub deadline: i64,              // 8
    pub status: ContractStatus,     // 1
    pub lat: f64,                   // 8
    pub lng: f64,                   // 8
    pub milestone_count: u8,        // 1
    pub milestones_accepted: u8,    // 1
    pub created_at: i64,            // 8
    pub bump: u8,                   // 1
    pub milestones: Vec<Milestone>, // 4 + (10 * Milestone::SIZE)
}

impl GovernmentContract {
    // 8 + 32*3 + (4+128) + (4+64) + 8*5 + 1 + 8*2 + 1 + 1 + 8 + 1 + 4 + (10 * 140) = ~1780
    pub const SPACE: usize = 8 + 32 * 3 + (4 + 128) + (4 + 64) + 8 * 5 + 1 + 8 * 2 + 1 + 1 + 8 + 1 + 4 + (10 * Milestone::SIZE);
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Milestone {
    pub description: String,       // 4 + 128
    pub deadline_days: u16,        // 2
    pub tranche_pct: u8,           // 1
    pub status: MilestoneStatus,   // 1
    pub sort_order: u8,            // 1
}

impl Milestone {
    pub const SIZE: usize = (4 + 128) + 2 + 1 + 1 + 1; // 137
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ContractStatus {
    Active,
    Disputed,
    Penalized,
    Completed,
    Terminated,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    UnderReview,
    Accepted,
    Rejected,
    Overdue,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum PenaltyType {
    TimeOverdue,
    QualityRejected,
    GhostSite,
}

// ─── Events ───

#[event]
pub struct ContractRegistered {
    pub contract: Pubkey,
    pub title: String,
    pub total_amount: u64,
    pub district: String,
}

#[event]
pub struct MilestoneSubmitted {
    pub contract: Pubkey,
    pub milestone_index: u8,
    pub evidence_hash: String,
}

#[event]
pub struct MilestoneAccepted {
    pub contract: Pubkey,
    pub milestone_index: u8,
    pub tranche: u64,
}

#[event]
pub struct MilestoneRejected {
    pub contract: Pubkey,
    pub milestone_index: u8,
}

#[event]
pub struct PenaltyTriggered {
    pub contract: Pubkey,
    pub penalty_type: PenaltyType,
    pub amount: u64,
    pub days_overdue: u64,
    pub triggered_by: Pubkey,
}

#[event]
pub struct ContractFlaggedForTermination {
    pub contract: Pubkey,
}

#[event]
pub struct ContractCompleted {
    pub contract: Pubkey,
}

#[event]
pub struct ContractTerminated {
    pub contract: Pubkey,
}

// ─── Errors ───

#[error_code]
pub enum ContractError {
    #[msg("Contract must have 2-10 milestones")]
    InvalidMilestoneCount,
    #[msg("Milestone percentages must sum to 100")]
    MilestonePercentageMismatch,
    #[msg("Contract is not active")]
    ContractNotActive,
    #[msg("Invalid milestone index")]
    InvalidMilestoneIndex,
    #[msg("Milestone is not in a submittable state")]
    MilestoneNotSubmittable,
    #[msg("Milestone is not under review")]
    MilestoneNotUnderReview,
    #[msg("Contract cannot be terminated in current status")]
    CannotTerminate,
}
