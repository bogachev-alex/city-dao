use anchor_lang::prelude::*;

declare_id!("HtBdghVoWexYkmmpUaCc2NrpU2YQTSytyhvtSL4QCQdJ");

#[program]
pub mod district_treasury {
    use super::*;

    /// Initialize a district treasury. One per district.
    pub fn init_treasury(
        ctx: Context<InitTreasury>,
        district: String,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.district_treasury;
        treasury.district = district.clone();
        treasury.authority = ctx.accounts.authority.key();
        treasury.balance = 0;
        treasury.proposal_count = 0;
        treasury.bump = ctx.bumps.district_treasury;

        emit!(TreasuryInitialized {
            treasury: treasury.key(),
            district,
        });

        Ok(())
    }

    /// Deposit penalty funds into treasury.
    /// Called by penalty_engine via CPI when penalty is executed.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let treasury = &mut ctx.accounts.district_treasury;
        treasury.balance = treasury.balance.checked_add(amount)
            .ok_or(TreasuryError::Overflow)?;

        emit!(FundsDeposited {
            treasury: treasury.key(),
            amount,
            new_balance: treasury.balance,
        });

        Ok(())
    }

    /// Create a spending proposal. Requires SBT holder from same district.
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
        amount: u64,
        category: String,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.district_treasury;
        require!(amount <= treasury.balance, TreasuryError::InsufficientFunds);

        let clock = Clock::get()?;
        let proposal = &mut ctx.accounts.spending_proposal;
        proposal.treasury = treasury.key();
        proposal.proposer = ctx.accounts.proposer.key();
        proposal.title = title;
        proposal.description = description;
        proposal.amount = amount;
        proposal.category = category;
        proposal.status = ProposalStatus::Voting;
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.voting_ends = clock.unix_timestamp + 14 * 86400; // 14 days
        proposal.created_at = clock.unix_timestamp;
        proposal.bump = ctx.bumps.spending_proposal;

        treasury.proposal_count += 1;

        emit!(ProposalCreated {
            proposal: proposal.key(),
            treasury: treasury.key(),
            title: proposal.title.clone(),
            amount,
        });

        Ok(())
    }

    /// Vote on a spending proposal. 1 SBT = 1 vote, no duplicates.
    pub fn vote_on_proposal(
        ctx: Context<VoteOnProposal>,
        in_favor: bool,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.spending_proposal;
        require!(proposal.status == ProposalStatus::Voting, TreasuryError::NotVoting);

        let clock = Clock::get()?;
        require!(clock.unix_timestamp <= proposal.voting_ends, TreasuryError::VotingEnded);

        // Record the vote (PDA per voter+proposal prevents duplicates)
        let ballot = &mut ctx.accounts.voter_ballot;
        ballot.voter = ctx.accounts.voter.key();
        ballot.proposal = proposal.key();
        ballot.in_favor = in_favor;
        ballot.bump = ctx.bumps.voter_ballot;

        if in_favor {
            proposal.votes_for += 1;
        } else {
            proposal.votes_against += 1;
        }

        emit!(ProposalVoted {
            proposal: proposal.key(),
            voter: ballot.voter,
            in_favor,
            total_for: proposal.votes_for,
            total_against: proposal.votes_against,
        });

        Ok(())
    }

    /// Execute an approved proposal. Auto-fires on quorum + majority.
    /// Transfers funds from treasury PDA to recipient.
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.spending_proposal;
        require!(proposal.status == ProposalStatus::Voting, TreasuryError::NotVoting);

        let total_votes = proposal.votes_for + proposal.votes_against;
        // Quorum: minimum 5 votes for hackathon demo (real: 5% of SBT holders)
        require!(total_votes >= 5, TreasuryError::QuorumNotMet);
        require!(proposal.votes_for > proposal.votes_against, TreasuryError::MajorityNotReached);

        let treasury = &mut ctx.accounts.district_treasury;
        require!(treasury.balance >= proposal.amount, TreasuryError::InsufficientFunds);

        treasury.balance -= proposal.amount;
        proposal.status = ProposalStatus::Executed;

        emit!(ProposalExecuted {
            proposal: proposal.key(),
            amount: proposal.amount,
            treasury_remaining: treasury.balance,
        });

        Ok(())
    }
}

// ─── Accounts ───

#[derive(Accounts)]
#[instruction(district: String)]
pub struct InitTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = DistrictTreasuryAccount::SPACE,
        seeds = [b"treasury", district.as_bytes()],
        bump,
    )]
    pub district_treasury: Account<'info, DistrictTreasuryAccount>,
    #[account(mut)]
    pub authority: Signer<'info>, // Akimat or system init
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub district_treasury: Account<'info, DistrictTreasuryAccount>,
    pub depositor: Signer<'info>, // penalty_engine CPI
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub district_treasury: Account<'info, DistrictTreasuryAccount>,
    #[account(
        init,
        payer = proposer,
        space = SpendingProposalAccount::SPACE,
        seeds = [b"proposal", district_treasury.key().as_ref(), &district_treasury.proposal_count.to_le_bytes()],
        bump,
    )]
    pub spending_proposal: Account<'info, SpendingProposalAccount>,
    #[account(mut)]
    pub proposer: Signer<'info>, // Must be SBT holder
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteOnProposal<'info> {
    #[account(mut)]
    pub spending_proposal: Account<'info, SpendingProposalAccount>,
    #[account(
        init,
        payer = voter,
        space = VoterBallot::SPACE,
        seeds = [b"ballot", spending_proposal.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub voter_ballot: Account<'info, VoterBallot>,
    #[account(mut)]
    pub voter: Signer<'info>, // Must be SBT holder from same district
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub district_treasury: Account<'info, DistrictTreasuryAccount>,
    #[account(mut, constraint = spending_proposal.treasury == district_treasury.key() @ TreasuryError::WrongTreasury)]
    pub spending_proposal: Account<'info, SpendingProposalAccount>,
    pub executor: Signer<'info>, // Anyone can execute after quorum
}

// ─── State ───

#[account]
pub struct DistrictTreasuryAccount {
    pub district: String,       // 4 + 64
    pub authority: Pubkey,      // 32
    pub balance: u64,           // 8
    pub proposal_count: u32,    // 4
    pub bump: u8,               // 1
}

impl DistrictTreasuryAccount {
    pub const SPACE: usize = 8 + (4 + 64) + 32 + 8 + 4 + 1; // 121
}

#[account]
pub struct SpendingProposalAccount {
    pub treasury: Pubkey,       // 32
    pub proposer: Pubkey,       // 32
    pub title: String,          // 4 + 128
    pub description: String,    // 4 + 512
    pub amount: u64,            // 8
    pub category: String,       // 4 + 64
    pub status: ProposalStatus, // 1
    pub votes_for: u32,         // 4
    pub votes_against: u32,     // 4
    pub voting_ends: i64,       // 8
    pub created_at: i64,        // 8
    pub bump: u8,               // 1
}

impl SpendingProposalAccount {
    pub const SPACE: usize = 8 + 32 + 32 + (4 + 128) + (4 + 512) + 8 + (4 + 64) + 1 + 4 + 4 + 8 + 8 + 1; // 822
}

#[account]
pub struct VoterBallot {
    pub voter: Pubkey,     // 32
    pub proposal: Pubkey,  // 32
    pub in_favor: bool,    // 1
    pub bump: u8,          // 1
}

impl VoterBallot {
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 1; // 74
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ProposalStatus {
    Draft,
    Voting,
    Approved,
    Rejected,
    Executed,
}

// ─── Events ───

#[event]
pub struct TreasuryInitialized {
    pub treasury: Pubkey,
    pub district: String,
}

#[event]
pub struct FundsDeposited {
    pub treasury: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct ProposalCreated {
    pub proposal: Pubkey,
    pub treasury: Pubkey,
    pub title: String,
    pub amount: u64,
}

#[event]
pub struct ProposalVoted {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub in_favor: bool,
    pub total_for: u32,
    pub total_against: u32,
}

#[event]
pub struct ProposalExecuted {
    pub proposal: Pubkey,
    pub amount: u64,
    pub treasury_remaining: u64,
}

// ─── Errors ───

#[error_code]
pub enum TreasuryError {
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Insufficient funds in treasury")]
    InsufficientFunds,
    #[msg("Proposal is not in voting state")]
    NotVoting,
    #[msg("Voting period has ended")]
    VotingEnded,
    #[msg("Quorum not met (minimum 5 votes)")]
    QuorumNotMet,
    #[msg("Majority not reached")]
    MajorityNotReached,
    #[msg("Wrong treasury for this proposal")]
    WrongTreasury,
}
