use anchor_lang::prelude::*;

declare_id!("3Mvy26WHuEW2X1Nwt9Ve6b4n5yEEwRPrLi7ie3tCo2MY");

/// Minimum SOL the creator must lock for automated `refund_all` execution (pays relayer after refunds).
pub const MIN_REFUND_EXEC_DEPOSIT_LAMPORTS: u64 = 1_000_000; // 0.001 SOL
/// Fixed fee paid to the transaction caller for executing `refund_one`.
/// Must keep `refund_exec_vault` rent-exempt.
pub const REFUND_ONE_FEE_LAMPORTS: u64 = 10_000; // 0.00001 SOL

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn init_campaign(
        ctx: Context<InitCampaign>,
        title: String,
        description: String,
        district: String,
        category: CampaignCategory,
        target_amount: u64,
        deadline: i64,
        lat: f64,
        lng: f64,
        refund_executor_deposit_lamports: u64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(deadline > now, CrowdfundingError::DeadlinePassed);
        require!(
            refund_executor_deposit_lamports >= MIN_REFUND_EXEC_DEPOSIT_LAMPORTS,
            CrowdfundingError::RefundExecDepositTooLow
        );

        let state_percent: u64 = match category {
            CampaignCategory::Playground => 90,
            CampaignCategory::School => 90,
            CampaignCategory::Roads => 70,
            CampaignCategory::Landscaping => 50,
            CampaignCategory::Commercial => 0,
        };

        let citizen_target = target_amount
            .checked_mul(100 - state_percent)
            .ok_or(CrowdfundingError::Overflow)?
            / 100;
        let state_match = target_amount
            .checked_sub(citizen_target)
            .ok_or(CrowdfundingError::Overflow)?;

        let campaign = &mut ctx.accounts.campaign;
        campaign.creator = ctx.accounts.creator.key();
        campaign.title = title.clone();
        campaign.description = description;
        campaign.district = district;
        campaign.category = category;
        campaign.status = CampaignStatus::Active;
        campaign.target_amount = target_amount;
        campaign.citizen_target = citizen_target;
        campaign.state_match = state_match;
        campaign.citizen_raised = 0;
        campaign.state_deposited = false;
        campaign.donor_count = 0;
        campaign.deadline = deadline;
        campaign.lat = lat;
        campaign.lng = lng;
        campaign.contract_pubkey = None;
        campaign.created_at = now;
        campaign.bump = ctx.bumps.campaign;

        let escrow = &mut ctx.accounts.escrow;
        escrow.campaign = campaign.key();
        escrow.total_deposited = 0;
        escrow.bump = ctx.bumps.escrow;

        ctx.accounts.refund_exec_vault.bump = ctx.bumps.refund_exec_vault;
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.refund_exec_vault.to_account_info(),
                },
            ),
            refund_executor_deposit_lamports,
        )?;

        emit!(CampaignCreated {
            campaign: campaign.key(),
            creator: campaign.creator,
            title,
            target_amount,
            citizen_target,
            state_match,
        });

        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>, amount: u64, lamports: u64, anonymous: bool) -> Result<()> {
        require!(amount >= 500, CrowdfundingError::AmountTooLow);
        require!(amount <= 500_000, CrowdfundingError::AmountTooHigh);
        require!(lamports > 0, CrowdfundingError::AmountTooLow);

        let campaign_info = &ctx.accounts.campaign;
        require!(campaign_info.status == CampaignStatus::Active, CrowdfundingError::CampaignNotActive);

        let now = Clock::get()?.unix_timestamp;
        require!(campaign_info.deadline > now, CrowdfundingError::DeadlinePassed);

        // Transfer SOL from donor to escrow (before mutable borrows)
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.donor.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            lamports,
        )?;

        let campaign = &mut ctx.accounts.campaign;
        let escrow = &mut ctx.accounts.escrow;

        let donor = &mut ctx.accounts.donor_record;
        let is_new = donor.amount == 0;

        campaign.citizen_raised = campaign
            .citizen_raised
            .checked_add(amount)
            .ok_or(CrowdfundingError::Overflow)?;
        if is_new {
            campaign.donor_count = campaign
                .donor_count
                .checked_add(1)
                .ok_or(CrowdfundingError::Overflow)?;
        }

        escrow.total_deposited = escrow
            .total_deposited
            .checked_add(lamports)
            .ok_or(CrowdfundingError::Overflow)?;

        donor.donor = ctx.accounts.donor.key();
        donor.campaign = campaign.key();
        donor.amount = donor
            .amount
            .checked_add(amount)
            .ok_or(CrowdfundingError::Overflow)?;
        donor.lamports = donor
            .lamports
            .checked_add(lamports)
            .ok_or(CrowdfundingError::Overflow)?;
        donor.anonymous = anonymous;
        donor.created_at = now;
        donor.bump = ctx.bumps.donor_record;

        emit!(ContributionReceived {
            campaign: campaign.key(),
            donor: donor.donor,
            amount,
            lamports,
            total_raised: campaign.citizen_raised,
            donor_count: campaign.donor_count,
        });

        if campaign.citizen_raised >= campaign.citizen_target {
            campaign.status = CampaignStatus::Funded;
            emit!(CampaignFunded {
                campaign: campaign.key(),
                citizen_raised: campaign.citizen_raised,
                citizen_target: campaign.citizen_target,
            });
        }

        Ok(())
    }

    pub fn match_funds(ctx: Context<MatchFunds>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let escrow = &mut ctx.accounts.escrow;

        require!(campaign.status == CampaignStatus::Funded, CrowdfundingError::TargetNotReached);
        require!(!campaign.state_deposited, CrowdfundingError::AlreadyMatched);

        let match_amount = campaign.state_match;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.akimat.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            match_amount,
        )?;

        campaign.state_deposited = true;
        campaign.status = CampaignStatus::Matched;
        escrow.total_deposited = escrow
            .total_deposited
            .checked_add(match_amount)
            .ok_or(CrowdfundingError::Overflow)?;

        emit!(StateMatched {
            campaign: campaign.key(),
            state_amount: match_amount,
            total_funds: escrow.total_deposited,
        });

        Ok(())
    }

    /// After deadline (and if target not reached): return a single donor's `lamports` from escrow PDA.
    /// This is permissionless — anyone can execute it — and it pays a small fee from `refund_exec_vault`
    /// to incentivize automation (keepers).
    pub fn refund_one(ctx: Context<RefundOne>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(now > ctx.accounts.campaign.deadline, CrowdfundingError::DeadlineNotPassed);
        require!(
            ctx.accounts.campaign.status == CampaignStatus::Active,
            CrowdfundingError::CampaignNotActive
        );
        require!(
            ctx.accounts.campaign.citizen_raised < ctx.accounts.campaign.citizen_target,
            CrowdfundingError::TargetAlreadyReached
        );

        require!(
            ctx.accounts.donor_record.campaign == ctx.accounts.campaign.key(),
            CrowdfundingError::InvalidRefundAccounts
        );
        require!(
            ctx.accounts.donor_record.donor == ctx.accounts.donor_wallet.key(),
            CrowdfundingError::InvalidRefundAccounts
        );

        let lamports = ctx.accounts.donor_record.lamports;
        require!(lamports > 0, CrowdfundingError::AlreadyRefunded);

        let rent = Rent::get()?;
        let min_escrow_rent = rent.minimum_balance(CampaignEscrow::SPACE);

        let campaign_key = ctx.accounts.campaign.key();
        let escrow_bump = ctx.accounts.escrow.bump;
        let escrow_seeds: &[&[u8]] = &[b"cf_escrow", campaign_key.as_ref(), &[escrow_bump]];

        // Ensure escrow remains rent-exempt after refund transfer.
        let escrow_ai = ctx.accounts.escrow.to_account_info();
        let escrow_after = escrow_ai
            .lamports()
            .checked_sub(lamports)
            .ok_or(CrowdfundingError::Overflow)?;
        require!(
            escrow_after >= min_escrow_rent,
            CrowdfundingError::InsufficientEscrowForRefund
        );

        // Transfer donor lamports from escrow PDA.
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: escrow_ai,
                    to: ctx.accounts.donor_wallet.to_account_info(),
                },
                &[escrow_seeds],
            ),
            lamports,
        )?;

        // Update ledgers / idempotency guards.
        ctx.accounts.escrow.total_deposited = ctx
            .accounts
            .escrow
            .total_deposited
            .checked_sub(lamports)
            .ok_or(CrowdfundingError::Overflow)?;
        ctx.accounts.donor_record.amount = 0;
        ctx.accounts.donor_record.lamports = 0;

        // Pay the caller fee from refund_exec_vault PDA (keeps automation permissionless).
        let min_vault_rent = rent.minimum_balance(RefundExecVault::SPACE);
        let vault_ai = ctx.accounts.refund_exec_vault.to_account_info();
        let vault_bump = ctx.accounts.refund_exec_vault.bump;
        let vault_seeds: &[&[u8]] = &[b"cf_refund_exec", campaign_key.as_ref(), &[vault_bump]];

        let vault_after = vault_ai
            .lamports()
            .checked_sub(REFUND_ONE_FEE_LAMPORTS)
            .ok_or(CrowdfundingError::Overflow)?;
        require!(vault_after >= min_vault_rent, CrowdfundingError::FeeVaultTooLow);

        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: vault_ai,
                    to: ctx.accounts.caller.to_account_info(),
                },
                &[vault_seeds],
            ),
            REFUND_ONE_FEE_LAMPORTS,
        )?;

        // If all escrow is refunded, expire the campaign.
        if ctx.accounts.escrow.total_deposited == 0 {
            ctx.accounts.campaign.status = CampaignStatus::Expired;
        }

        emit!(RefundOneExecuted {
            campaign: ctx.accounts.campaign.key(),
            donor: ctx.accounts.donor_wallet.key(),
            refunded_lamports: lamports,
            fee_lamports: REFUND_ONE_FEE_LAMPORTS,
            caller: ctx.accounts.caller.key(),
        });

        Ok(())
    }

    /// After deadline: return each donor's `lamports` from the escrow PDA to their wallet.
    /// `remaining_accounts` must be `[donor_record, donor_wallet, ...]` pairs for every donor.
    pub fn refund_all<'info>(ctx: Context<'_, '_, '_, 'info, RefundAll<'info>>) -> Result<()> {
        use anchor_lang::{AnchorSerialize, Discriminator};

        let rem: Vec<AccountInfo<'info>> = ctx.remaining_accounts.iter().cloned().collect();

        let campaign_key = ctx.accounts.campaign.key();
        let deadline = ctx.accounts.campaign.deadline;
        let status = ctx.accounts.campaign.status;
        let donor_count = ctx.accounts.campaign.donor_count;
        let expected_total = ctx.accounts.escrow.total_deposited;
        let escrow_bump = ctx.accounts.escrow.bump;

        let now = Clock::get()?.unix_timestamp;
        require!(now > deadline, CrowdfundingError::DeadlineNotPassed);
        require!(status == CampaignStatus::Active, CrowdfundingError::CampaignNotActive);

        require!(rem.len() % 2 == 0, CrowdfundingError::InvalidRefundAccounts);
        let rent = Rent::get()?;
        let min_escrow_rent = rent.minimum_balance(CampaignEscrow::SPACE);
        let signer_seeds: &[&[u8]] = &[b"cf_escrow", campaign_key.as_ref(), &[escrow_bump]];
        let escrow_ai = ctx.accounts.escrow.to_account_info();
        let system_ai = ctx.accounts.system_program.to_account_info();

        if expected_total == 0 {
            require!(rem.is_empty(), CrowdfundingError::InvalidRefundAccounts);
            let campaign = &mut ctx.accounts.campaign;
            let escrow = &mut ctx.accounts.escrow;
            campaign.status = CampaignStatus::Expired;
            escrow.total_deposited = 0;
            emit!(RefundExecuted {
                campaign: campaign.key(),
                total_refunded: 0,
                donor_count,
            });
            return Ok(());
        }

        require!(!rem.is_empty(), CrowdfundingError::InvalidRefundAccounts);

        let mut refunded: u64 = 0;

        for chunk in rem.chunks(2) {
            let dr_ai = &chunk[0];
            let donor_wallet = &chunk[1];
            require!(
                dr_ai.is_writable && donor_wallet.is_writable,
                CrowdfundingError::InvalidRefundAccounts
            );

            let donor_record = {
                let data = dr_ai.try_borrow_data()?;
                let mut slice: &[u8] = &data;
                DonorRecord::try_deserialize(&mut slice)?
            };

            require!(
                donor_record.campaign == campaign_key,
                CrowdfundingError::InvalidRefundAccounts
            );
            require!(
                donor_record.donor == donor_wallet.key(),
                CrowdfundingError::InvalidRefundAccounts
            );

            let (expected_pda, _) = Pubkey::find_program_address(
                &[
                    b"donor",
                    campaign_key.as_ref(),
                    donor_wallet.key().as_ref(),
                ],
                ctx.program_id,
            );
            require!(dr_ai.key() == expected_pda, CrowdfundingError::InvalidRefundAccounts);

            let lamports = donor_record.lamports;
            if lamports == 0 {
                continue;
            }

            let after = escrow_ai
                .lamports()
                .checked_sub(lamports)
                .ok_or(CrowdfundingError::Overflow)?;
            require!(
                after >= min_escrow_rent,
                CrowdfundingError::InsufficientEscrowForRefund
            );

            anchor_lang::system_program::transfer(
                CpiContext::new_with_signer(
                    system_ai.clone(),
                    anchor_lang::system_program::Transfer {
                        from: escrow_ai.clone(),
                        to: donor_wallet.clone(),
                    },
                    &[signer_seeds],
                ),
                lamports,
            )?;

            refunded = refunded
                .checked_add(lamports)
                .ok_or(CrowdfundingError::Overflow)?;

            let mut cleared = donor_record;
            cleared.amount = 0;
            cleared.lamports = 0;
            let mut data = dr_ai.try_borrow_mut_data()?;
            require!(data.len() >= DonorRecord::SPACE, CrowdfundingError::Overflow);
            let disc = DonorRecord::DISCRIMINATOR;
            data[..disc.len()].copy_from_slice(&disc);
            let mut w: &mut [u8] = &mut data[disc.len()..];
            cleared
                .serialize(&mut w)
                .map_err(|_| error!(CrowdfundingError::Overflow))?;
        }

        require!(
            refunded == expected_total,
            CrowdfundingError::RefundAmountMismatch
        );

        let campaign = &mut ctx.accounts.campaign;
        let escrow = &mut ctx.accounts.escrow;

        emit!(RefundExecuted {
            campaign: campaign.key(),
            total_refunded: refunded,
            donor_count,
        });

        campaign.status = CampaignStatus::Expired;
        escrow.total_deposited = 0;

        Ok(())
    }

    pub fn finalize_campaign(ctx: Context<FinalizeCampaign>, contract_pubkey: Pubkey) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        require!(campaign.status == CampaignStatus::Matched, CrowdfundingError::NotMatched);

        campaign.contract_pubkey = Some(contract_pubkey);
        campaign.status = CampaignStatus::InProgress;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct InitCampaign<'info> {
    #[account(
        init,
        payer = creator,
        space = CrowdfundingCampaignAccount::SPACE,
        seeds = [b"campaign", creator.key().as_ref(), title.as_bytes()],
        bump
    )]
    pub campaign: Account<'info, CrowdfundingCampaignAccount>,
    #[account(
        init,
        payer = creator,
        space = CampaignEscrow::SPACE,
        seeds = [b"cf_escrow", campaign.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, CampaignEscrow>,
    #[account(
        init,
        payer = creator,
        space = RefundExecVault::SPACE,
        seeds = [b"cf_refund_exec", campaign.key().as_ref()],
        bump
    )]
    pub refund_exec_vault: Account<'info, RefundExecVault>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub campaign: Account<'info, CrowdfundingCampaignAccount>,
    #[account(
        mut,
        seeds = [b"cf_escrow", campaign.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, CampaignEscrow>,
    #[account(
        init_if_needed,
        payer = donor,
        space = DonorRecord::SPACE,
        seeds = [b"donor", campaign.key().as_ref(), donor.key().as_ref()],
        bump
    )]
    pub donor_record: Account<'info, DonorRecord>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MatchFunds<'info> {
    #[account(mut)]
    pub campaign: Account<'info, CrowdfundingCampaignAccount>,
    #[account(
        mut,
        seeds = [b"cf_escrow", campaign.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, CampaignEscrow>,
    #[account(mut)]
    pub akimat: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundAll<'info> {
    #[account(mut)]
    pub campaign: Account<'info, CrowdfundingCampaignAccount>,
    #[account(
        mut,
        seeds = [b"cf_escrow", campaign.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, CampaignEscrow>,
    #[account(
        mut,
        seeds = [b"cf_refund_exec", campaign.key().as_ref()],
        bump = refund_exec_vault.bump,
        close = caller
    )]
    pub refund_exec_vault: Account<'info, RefundExecVault>,
    #[account(mut)]
    pub caller: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundOne<'info> {
    #[account(mut)]
    pub campaign: Account<'info, CrowdfundingCampaignAccount>,
    #[account(
        mut,
        seeds = [b"cf_escrow", campaign.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, CampaignEscrow>,
    #[account(
        mut,
        seeds = [b"donor", campaign.key().as_ref(), donor_wallet.key().as_ref()],
        bump = donor_record.bump
    )]
    pub donor_record: Account<'info, DonorRecord>,
    #[account(mut)]
    pub donor_wallet: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"cf_refund_exec", campaign.key().as_ref()],
        bump = refund_exec_vault.bump
    )]
    pub refund_exec_vault: Account<'info, RefundExecVault>,
    #[account(mut)]
    pub caller: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeCampaign<'info> {
    #[account(mut)]
    pub campaign: Account<'info, CrowdfundingCampaignAccount>,
    #[account(
        mut,
        seeds = [b"cf_escrow", campaign.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, CampaignEscrow>,
    /// CHECK: contract account belongs to another program and is only linked.
    #[account(mut)]
    pub contract_account: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct CrowdfundingCampaignAccount {
    pub creator: Pubkey,
    pub title: String,
    pub description: String,
    pub district: String,
    pub category: CampaignCategory,
    pub status: CampaignStatus,
    pub target_amount: u64,
    pub citizen_target: u64,
    pub state_match: u64,
    pub citizen_raised: u64,
    pub state_deposited: bool,
    pub donor_count: u32,
    pub deadline: i64,
    pub lat: f64,
    pub lng: f64,
    pub contract_pubkey: Option<Pubkey>,
    pub created_at: i64,
    pub bump: u8,
}

impl CrowdfundingCampaignAccount {
    pub const SPACE: usize = 8
        + 32
        + (4 + 128)
        + (4 + 512)
        + (4 + 64)
        + 1
        + 1
        + 8
        + 8
        + 8
        + 8
        + 1
        + 4
        + 8
        + 8
        + 8
        + 33
        + 8
        + 1;
}

#[account]
pub struct CampaignEscrow {
    pub campaign: Pubkey,
    pub total_deposited: u64,
    pub bump: u8,
}

impl CampaignEscrow {
    pub const SPACE: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct RefundExecVault {
    pub bump: u8,
}

impl RefundExecVault {
    pub const SPACE: usize = 8 + 1;
}

#[account]
pub struct DonorRecord {
    pub donor: Pubkey,
    pub campaign: Pubkey,
    pub amount: u64,
    pub lamports: u64,
    pub anonymous: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl DonorRecord {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CampaignCategory {
    Playground,
    School,
    Roads,
    Landscaping,
    Commercial,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CampaignStatus {
    Active,
    Funded,
    Matched,
    InProgress,
    Completed,
    Expired,
}

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub title: String,
    pub target_amount: u64,
    pub citizen_target: u64,
    pub state_match: u64,
}

#[event]
pub struct ContributionReceived {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
    pub lamports: u64,
    pub total_raised: u64,
    pub donor_count: u32,
}

#[event]
pub struct CampaignFunded {
    pub campaign: Pubkey,
    pub citizen_raised: u64,
    pub citizen_target: u64,
}

#[event]
pub struct StateMatched {
    pub campaign: Pubkey,
    pub state_amount: u64,
    pub total_funds: u64,
}

#[event]
pub struct RefundExecuted {
    pub campaign: Pubkey,
    pub total_refunded: u64,
    pub donor_count: u32,
}

#[event]
pub struct RefundOneExecuted {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub refunded_lamports: u64,
    pub fee_lamports: u64,
    pub caller: Pubkey,
}

#[error_code]
pub enum CrowdfundingError {
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Campaign is not in active state")]
    CampaignNotActive,
    #[msg("Campaign deadline has passed")]
    DeadlinePassed,
    #[msg("Campaign deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("Contribution below minimum (500 tenge)")]
    AmountTooLow,
    #[msg("Contribution above maximum (500000 tenge)")]
    AmountTooHigh,
    #[msg("Citizen target has not been reached")]
    TargetNotReached,
    #[msg("Citizen target already reached")]
    TargetAlreadyReached,
    #[msg("State funds already deposited")]
    AlreadyMatched,
    #[msg("State has not matched funds yet")]
    NotMatched,
    #[msg("Invalid campaign category")]
    InvalidCategory,
    #[msg("Invalid refund accounts: expected [donor_record, donor_wallet, ...] pairs")]
    InvalidRefundAccounts,
    #[msg("Refunded lamports must match escrow total_deposited")]
    RefundAmountMismatch,
    #[msg("Escrow balance too low for this refund (rent or ledger mismatch)")]
    InsufficientEscrowForRefund,
    #[msg("Refund executor deposit below minimum (creator must fund relayer reimbursement)")]
    RefundExecDepositTooLow,
    #[msg("Donor already refunded")]
    AlreadyRefunded,
    #[msg("Refund executor vault too low to pay caller fee")]
    FeeVaultTooLow,
}
