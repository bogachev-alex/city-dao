use anchor_lang::prelude::*;

declare_id!("HVZcSwtwNA2eJwEgimoDFTXe74pmGpvv1CDUXaEntzTd");

#[program]
pub mod jury_mechanism {
    use super::*;

    /// Initialize a jury session for a milestone review.
    /// Called after contractor submits milestone completion.
    pub fn init_session(
        ctx: Context<InitSession>,
        contract: Pubkey,
        milestone_index: u8,
    ) -> Result<()> {
        let session = &mut ctx.accounts.jury_session;
        let clock = Clock::get()?;

        session.contract = contract;
        session.milestone_index = milestone_index;
        session.authority = ctx.accounts.authority.key();
        session.status = JurySessionStatus::Selecting;
        session.juror_count = 0;
        session.commit_deadline = 0;
        session.reveal_deadline = 0;
        session.weighted_accept = 0;
        session.weighted_reject = 0;
        session.result = JuryResult::Pending;
        session.created_at = clock.unix_timestamp;
        session.bump = ctx.bumps.jury_session;

        emit!(JurySessionCreated {
            session: session.key(),
            contract,
            milestone_index,
        });

        Ok(())
    }

    /// Select jurors using VRF result. Sets commit/reveal deadlines.
    /// In production: VRF result from Switchboard oracle.
    /// For hackathon: accept any 32-byte seed.
    pub fn select_jury(
        ctx: Context<SelectJury>,
        vrf_result: [u8; 32],
        jurors: Vec<Pubkey>,       // 3 citizens + 1 expert
        expert_index: u8,          // which juror is the expert
    ) -> Result<()> {
        let session = &mut ctx.accounts.jury_session;
        require!(session.status == JurySessionStatus::Selecting, JuryError::WrongPhase);
        require!(jurors.len() == 4, JuryError::InvalidJurorCount);
        require!((expert_index as usize) < jurors.len(), JuryError::InvalidExpertIndex);

        let clock = Clock::get()?;

        session.vrf_result = vrf_result;
        session.juror_count = 4;
        session.status = JurySessionStatus::CommitPhase;
        session.commit_deadline = clock.unix_timestamp + 48 * 3600; // +48h
        session.reveal_deadline = clock.unix_timestamp + 72 * 3600; // +72h

        // Store jurors in the juror accounts (created separately)
        // For now, emit event with juror list
        emit!(JurySelected {
            session: session.key(),
            jurors: jurors.clone(),
            expert_index,
            commit_deadline: session.commit_deadline,
            reveal_deadline: session.reveal_deadline,
        });

        Ok(())
    }

    /// Juror commits their vote hash: SHA-256(vote + salt).
    /// Vote is hidden until reveal phase.
    pub fn commit_vote(
        ctx: Context<CommitVote>,
        vote_hash: [u8; 32],
    ) -> Result<()> {
        let session = &ctx.accounts.jury_session;
        require!(session.status == JurySessionStatus::CommitPhase, JuryError::WrongPhase);

        let clock = Clock::get()?;
        require!(clock.unix_timestamp <= session.commit_deadline, JuryError::DeadlinePassed);

        let vote = &mut ctx.accounts.jury_vote;
        require!(!vote.committed, JuryError::AlreadyCommitted);

        vote.juror = ctx.accounts.juror.key();
        vote.session = session.key();
        vote.vote_hash = vote_hash;
        vote.committed = true;
        vote.revealed = false;
        vote.vote = JuryVoteValue::None;
        vote.bump = ctx.bumps.jury_vote;

        emit!(VoteCommitted {
            session: session.key(),
            juror: vote.juror,
        });

        Ok(())
    }

    /// Juror reveals their vote + salt. Contract verifies hash matches.
    pub fn reveal_vote(
        ctx: Context<RevealVote>,
        vote: JuryVoteValue,
        salt: [u8; 32],
    ) -> Result<()> {
        let session = &ctx.accounts.jury_session;
        require!(session.status == JurySessionStatus::RevealPhase, JuryError::WrongPhase);

        let clock = Clock::get()?;
        require!(clock.unix_timestamp <= session.reveal_deadline, JuryError::DeadlinePassed);

        let jury_vote = &mut ctx.accounts.jury_vote;
        require!(jury_vote.committed, JuryError::NotCommitted);
        require!(!jury_vote.revealed, JuryError::AlreadyRevealed);

        // Verify: hash(vote_byte || salt) == committed hash
        let vote_byte: u8 = match vote {
            JuryVoteValue::Accept => 1,
            JuryVoteValue::Reject => 2,
            JuryVoteValue::None => return Err(JuryError::InvalidVote.into()),
        };

        let mut preimage = [0u8; 33];
        preimage[0] = vote_byte;
        preimage[1..33].copy_from_slice(&salt);
        // SHA-256 hash verification
        let computed = solana_sha256_hasher::hashv(&[&preimage]);

        require!(
            computed.to_bytes() == jury_vote.vote_hash,
            JuryError::HashMismatch
        );

        jury_vote.vote = vote;
        jury_vote.revealed = true;

        emit!(VoteRevealed {
            session: session.key(),
            juror: jury_vote.juror,
            vote,
        });

        Ok(())
    }

    /// Transition from commit to reveal phase.
    /// Called after commit deadline or when all jurors have committed.
    pub fn start_reveal_phase(ctx: Context<TransitionPhase>) -> Result<()> {
        let session = &mut ctx.accounts.jury_session;
        require!(session.status == JurySessionStatus::CommitPhase, JuryError::WrongPhase);

        session.status = JurySessionStatus::RevealPhase;

        emit!(PhaseTransitioned {
            session: session.key(),
            new_phase: JurySessionStatus::RevealPhase,
        });

        Ok(())
    }

    /// Finalize session: tally weighted votes, determine result.
    /// Expert vote = 2, citizen vote = 1. Threshold = 3 of 5 weighted.
    pub fn finalize_session(
        ctx: Context<FinalizeSession>,
        weighted_accept: u8,
        weighted_reject: u8,
    ) -> Result<()> {
        let session = &mut ctx.accounts.jury_session;
        require!(session.status == JurySessionStatus::RevealPhase, JuryError::WrongPhase);

        session.weighted_accept = weighted_accept;
        session.weighted_reject = weighted_reject;

        // Determine result
        if weighted_accept == weighted_reject {
            // Tie → escalate to 5-person jury
            session.status = JurySessionStatus::Escalated;
            session.result = JuryResult::Pending;
            emit!(SessionEscalated { session: session.key() });
        } else if weighted_accept >= 3 {
            session.status = JurySessionStatus::Finalized;
            session.result = JuryResult::Accepted;
            emit!(SessionFinalized {
                session: session.key(),
                result: JuryResult::Accepted,
            });
        } else {
            session.status = JurySessionStatus::Finalized;
            session.result = JuryResult::Rejected;
            emit!(SessionFinalized {
                session: session.key(),
                result: JuryResult::Rejected,
            });
        }

        Ok(())
    }
}

// ─── Accounts ───

#[derive(Accounts)]
#[instruction(contract: Pubkey, milestone_index: u8)]
pub struct InitSession<'info> {
    #[account(
        init,
        payer = authority,
        space = JurySession::SPACE,
        seeds = [b"jury", contract.as_ref(), &[milestone_index]],
        bump,
    )]
    pub jury_session: Account<'info, JurySession>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SelectJury<'info> {
    #[account(mut)]
    pub jury_session: Account<'info, JurySession>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CommitVote<'info> {
    pub jury_session: Account<'info, JurySession>,
    #[account(
        init_if_needed,
        payer = juror,
        space = JuryVoteAccount::SPACE,
        seeds = [b"vote", jury_session.key().as_ref(), juror.key().as_ref()],
        bump,
    )]
    pub jury_vote: Account<'info, JuryVoteAccount>,
    #[account(mut)]
    pub juror: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealVote<'info> {
    pub jury_session: Account<'info, JurySession>,
    #[account(
        mut,
        seeds = [b"vote", jury_session.key().as_ref(), juror.key().as_ref()],
        bump = jury_vote.bump,
    )]
    pub jury_vote: Account<'info, JuryVoteAccount>,
    pub juror: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransitionPhase<'info> {
    #[account(mut)]
    pub jury_session: Account<'info, JurySession>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeSession<'info> {
    #[account(mut)]
    pub jury_session: Account<'info, JurySession>,
    pub authority: Signer<'info>,
}

// ─── State ───

#[account]
pub struct JurySession {
    pub contract: Pubkey,              // 32
    pub milestone_index: u8,           // 1
    pub authority: Pubkey,             // 32
    pub status: JurySessionStatus,     // 1
    pub vrf_result: [u8; 32],          // 32
    pub juror_count: u8,               // 1
    pub commit_deadline: i64,          // 8
    pub reveal_deadline: i64,          // 8
    pub weighted_accept: u8,           // 1
    pub weighted_reject: u8,           // 1
    pub result: JuryResult,            // 1
    pub created_at: i64,               // 8
    pub bump: u8,                      // 1
}

impl JurySession {
    pub const SPACE: usize = 8 + 32 + 1 + 32 + 1 + 32 + 1 + 8 + 8 + 1 + 1 + 1 + 8 + 1; // 135
}

#[account]
pub struct JuryVoteAccount {
    pub juror: Pubkey,            // 32
    pub session: Pubkey,          // 32
    pub vote_hash: [u8; 32],      // 32
    pub committed: bool,          // 1
    pub revealed: bool,           // 1
    pub vote: JuryVoteValue,      // 1
    pub is_expert: bool,          // 1
    pub weight: u8,               // 1
    pub bump: u8,                 // 1
}

impl JuryVoteAccount {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 1 + 1 + 1 + 1 + 1 + 1; // 110
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum JurySessionStatus {
    Selecting,
    CommitPhase,
    RevealPhase,
    Finalized,
    Escalated,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum JuryVoteValue {
    None,
    Accept,
    Reject,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum JuryResult {
    Pending,
    Accepted,
    Rejected,
}

// ─── Events ───

#[event]
pub struct JurySessionCreated {
    pub session: Pubkey,
    pub contract: Pubkey,
    pub milestone_index: u8,
}

#[event]
pub struct JurySelected {
    pub session: Pubkey,
    pub jurors: Vec<Pubkey>,
    pub expert_index: u8,
    pub commit_deadline: i64,
    pub reveal_deadline: i64,
}

#[event]
pub struct VoteCommitted {
    pub session: Pubkey,
    pub juror: Pubkey,
}

#[event]
pub struct VoteRevealed {
    pub session: Pubkey,
    pub juror: Pubkey,
    pub vote: JuryVoteValue,
}

#[event]
pub struct PhaseTransitioned {
    pub session: Pubkey,
    pub new_phase: JurySessionStatus,
}

#[event]
pub struct SessionFinalized {
    pub session: Pubkey,
    pub result: JuryResult,
}

#[event]
pub struct SessionEscalated {
    pub session: Pubkey,
}

// ─── Errors ───

#[error_code]
pub enum JuryError {
    #[msg("Operation not allowed in current phase")]
    WrongPhase,
    #[msg("Deadline has passed")]
    DeadlinePassed,
    #[msg("Already committed")]
    AlreadyCommitted,
    #[msg("Must commit before reveal")]
    NotCommitted,
    #[msg("Already revealed")]
    AlreadyRevealed,
    #[msg("Vote hash does not match commitment")]
    HashMismatch,
    #[msg("Invalid vote value")]
    InvalidVote,
    #[msg("Must have exactly 4 jurors")]
    InvalidJurorCount,
    #[msg("Expert index out of range")]
    InvalidExpertIndex,
}
