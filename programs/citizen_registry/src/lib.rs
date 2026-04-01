use anchor_lang::prelude::*;

declare_id!("2Gjs7gsyaBayR38AACScCPz3ZgRf3JZvAoW63A5jKCd3");

#[program]
pub mod citizen_registry {
    use super::*;

    /// Register a new citizen with hashed IIN. Creates a Soulbound Token (non-transferable).
    /// IIN is hashed client-side — only the hash reaches the chain.
    pub fn register_citizen(
        ctx: Context<RegisterCitizen>,
        district: String,
        iin_hash: [u8; 32],
    ) -> Result<()> {
        let profile = &mut ctx.accounts.citizen_profile;
        profile.wallet = ctx.accounts.wallet.key();
        profile.district = district;
        profile.iin_hash = iin_hash;
        profile.reputation_score = 100;
        profile.tier = CitizenTier::New;
        profile.is_eligible = true;
        profile.votes_cast = 0;
        profile.votes_with_majority = 0;
        profile.missed_jury_count = 0;
        profile.ban_until = 0; // 0 = no ban
        profile.bump = ctx.bumps.citizen_profile;

        emit!(CitizenRegistered {
            wallet: profile.wallet,
            district: profile.district.clone(),
        });

        Ok(())
    }

    /// Update reputation score after jury vote or other action.
    /// Only callable by authorized programs (jury_mechanism, penalty_engine).
    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        delta: i64,
        voted_with_majority: bool,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.citizen_profile;

        // Apply delta
        let new_score = profile.reputation_score.checked_add(delta)
            .ok_or(AmanatError::Overflow)?;
        profile.reputation_score = new_score.max(0);

        // Update vote counters
        profile.votes_cast += 1;
        if voted_with_majority {
            profile.votes_with_majority += 1;
        }

        // Recalculate tier
        profile.tier = CitizenTier::from_score(profile.reputation_score);

        emit!(ReputationUpdated {
            wallet: profile.wallet,
            new_score: profile.reputation_score,
            delta,
            tier: profile.tier,
        });

        Ok(())
    }

    /// Record a missed jury duty. After 3 misses → 30-day ban.
    pub fn record_missed_jury(ctx: Context<UpdateReputation>) -> Result<()> {
        let profile = &mut ctx.accounts.citizen_profile;
        profile.missed_jury_count += 1;
        profile.reputation_score = profile.reputation_score.saturating_sub(20);
        profile.tier = CitizenTier::from_score(profile.reputation_score);

        if profile.missed_jury_count >= 3 {
            let clock = Clock::get()?;
            profile.ban_until = clock.unix_timestamp + 30 * 24 * 60 * 60; // 30 days
            profile.is_eligible = false;
        }

        Ok(())
    }

    /// Check if ban has expired and re-enable citizen.
    pub fn check_eligibility(ctx: Context<CheckEligibility>) -> Result<()> {
        let profile = &mut ctx.accounts.citizen_profile;

        if profile.ban_until > 0 {
            let clock = Clock::get()?;
            if clock.unix_timestamp >= profile.ban_until {
                profile.ban_until = 0;
                profile.is_eligible = true;
                profile.missed_jury_count = 0;
            }
        }

        Ok(())
    }
}

// ─── Accounts ───

#[derive(Accounts)]
#[instruction(district: String, iin_hash: [u8; 32])]
pub struct RegisterCitizen<'info> {
    #[account(
        init,
        payer = wallet,
        space = CitizenProfile::SPACE,
        seeds = [b"citizen", wallet.key().as_ref()],
        bump,
    )]
    pub citizen_profile: Account<'info, CitizenProfile>,
    #[account(mut)]
    pub wallet: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(
        mut,
        seeds = [b"citizen", citizen_profile.wallet.as_ref()],
        bump = citizen_profile.bump,
    )]
    pub citizen_profile: Account<'info, CitizenProfile>,
    pub authority: Signer<'info>, // Must be jury_mechanism or penalty_engine program
}

#[derive(Accounts)]
pub struct CheckEligibility<'info> {
    #[account(
        mut,
        seeds = [b"citizen", citizen_profile.wallet.as_ref()],
        bump = citizen_profile.bump,
    )]
    pub citizen_profile: Account<'info, CitizenProfile>,
}

// ─── State ───

#[account]
pub struct CitizenProfile {
    pub wallet: Pubkey,            // 32
    pub district: String,          // 4 + max 64
    pub iin_hash: [u8; 32],        // 32
    pub reputation_score: i64,     // 8
    pub tier: CitizenTier,         // 1
    pub is_eligible: bool,         // 1
    pub votes_cast: u32,           // 4
    pub votes_with_majority: u32,  // 4
    pub missed_jury_count: u8,     // 1
    pub ban_until: i64,            // 8, unix timestamp, 0 = no ban
    pub bump: u8,                  // 1
}

impl CitizenProfile {
    // 8 (discriminator) + 32 + (4+64) + 32 + 8 + 1 + 1 + 4 + 4 + 1 + 8 + 1 = 168
    pub const SPACE: usize = 8 + 32 + (4 + 64) + 32 + 8 + 1 + 1 + 4 + 4 + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CitizenTier {
    New,       // 0-49
    Active,    // 50-149
    Trusted,   // 150-299
    Guardian,  // 300+
}

impl CitizenTier {
    pub fn from_score(score: i64) -> Self {
        if score >= 300 { CitizenTier::Guardian }
        else if score >= 150 { CitizenTier::Trusted }
        else if score >= 50 { CitizenTier::Active }
        else { CitizenTier::New }
    }
}

// ─── Events ───

#[event]
pub struct CitizenRegistered {
    pub wallet: Pubkey,
    pub district: String,
}

#[event]
pub struct ReputationUpdated {
    pub wallet: Pubkey,
    pub new_score: i64,
    pub delta: i64,
    pub tier: CitizenTier,
}

// ─── Errors ───

#[error_code]
pub enum AmanatError {
    #[msg("Arithmetic overflow")]
    Overflow,
}
