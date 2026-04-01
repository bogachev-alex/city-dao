use anchor_lang::prelude::*;

declare_id!("CRWDaH7ByG5BKmoCRestxNP7k4gSWgrWQVKLhf5VQ8mZ");

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
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(deadline > now, CrowdfundingError::DeadlinePassed);

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

    pub fn contribute(ctx: Context<Contribute>, amount: u64, anonymous: bool) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let escrow = &mut ctx.accounts.escrow;

        require!(campaign.status == CampaignStatus::Active, CrowdfundingError::CampaignNotActive);

        let now = Clock::get()?.unix_timestamp;
        require!(campaign.deadline > now, CrowdfundingError::DeadlinePassed);
        require!(amount >= 500, CrowdfundingError::AmountTooLow);
        require!(amount <= 500_000, CrowdfundingError::AmountTooHigh);

        campaign.citizen_raised = campaign
            .citizen_raised
            .checked_add(amount)
            .ok_or(CrowdfundingError::Overflow)?;
        campaign.donor_count = campaign
            .donor_count
            .checked_add(1)
            .ok_or(CrowdfundingError::Overflow)?;

        escrow.total_deposited = escrow
            .total_deposited
            .checked_add(amount)
            .ok_or(CrowdfundingError::Overflow)?;

        let donor = &mut ctx.accounts.donor_record;
        donor.donor = ctx.accounts.donor.key();
        donor.campaign = campaign.key();
        donor.amount = amount;
        donor.anonymous = anonymous;
        donor.created_at = now;
        donor.bump = ctx.bumps.donor_record;

        emit!(ContributionReceived {
            campaign: campaign.key(),
            donor: donor.donor,
            amount,
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

        campaign.state_deposited = true;
        campaign.status = CampaignStatus::Matched;
        escrow.total_deposited = escrow
            .total_deposited
            .checked_add(campaign.state_match)
            .ok_or(CrowdfundingError::Overflow)?;

        emit!(StateMatched {
            campaign: campaign.key(),
            state_amount: campaign.state_match,
            total_funds: escrow.total_deposited,
        });

        Ok(())
    }

    pub fn refund_all(ctx: Context<RefundAll>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let escrow = &mut ctx.accounts.escrow;

        let now = Clock::get()?.unix_timestamp;
        require!(now > campaign.deadline, CrowdfundingError::DeadlineNotPassed);
        require!(campaign.status == CampaignStatus::Active, CrowdfundingError::CampaignNotActive);

        campaign.status = CampaignStatus::Expired;

        emit!(RefundExecuted {
            campaign: campaign.key(),
            total_refunded: escrow.total_deposited,
            donor_count: campaign.donor_count,
        });

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
        init,
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
    pub caller: Signer<'info>,
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
pub struct DonorRecord {
    pub donor: Pubkey,
    pub campaign: Pubkey,
    pub amount: u64,
    pub anonymous: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl DonorRecord {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1 + 8 + 1;
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
}
