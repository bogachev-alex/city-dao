import { PublicKey } from '@solana/web3.js'
import { PROGRAM_IDS, SEEDS } from './constants'

/** Derive citizen profile PDA from wallet address */
export function getCitizenPDA(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.citizen, wallet.toBuffer()],
    PROGRAM_IDS.citizenRegistry
  )
}

/** Derive contract PDA from authority + title */
export function getContractPDA(authority: PublicKey, title: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.contract, authority.toBuffer(), Buffer.from(title)],
    PROGRAM_IDS.contractRegistry
  )
}

/** Derive escrow PDA from contract account */
export function getEscrowPDA(contract: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.escrow, contract.toBuffer()],
    PROGRAM_IDS.contractRegistry
  )
}

/** Derive escrow token vault PDA account (vault authority owned by program). */
export function getEscrowTokenVaultPDA(contract: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_token_vault'), contract.toBuffer()],
    PROGRAM_IDS.contractRegistry
  )
}

/** Derive district treasury token vault PDA account. */
export function getTreasuryTokenVaultPDA(district: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('treasury_token_vault'), Buffer.from(district)],
    PROGRAM_IDS.districtTreasury
  )
}

/** Derive expert stake vault PDA account. */
export function getExpertStakeVaultPDA(expert: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('expert_stake_vault'), expert.toBuffer()],
    PROGRAM_IDS.citizenRegistry
  )
}

/** Derive jury session PDA from contract + milestone index */
export function getJurySessionPDA(contract: PublicKey, milestoneIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.jury, contract.toBuffer(), Buffer.from([milestoneIndex])],
    PROGRAM_IDS.juryMechanism
  )
}

/** Derive jury vote PDA from session + juror */
export function getJuryVotePDA(session: PublicKey, juror: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.vote, session.toBuffer(), juror.toBuffer()],
    PROGRAM_IDS.juryMechanism
  )
}

/** Derive district treasury PDA from district name */
export function getTreasuryPDA(district: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.treasury, Buffer.from(district)],
    PROGRAM_IDS.districtTreasury
  )
}

/** Derive spending proposal PDA from treasury + title */
export function getProposalPDA(treasury: PublicKey, title: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.proposal, treasury.toBuffer(), Buffer.from(title)],
    PROGRAM_IDS.districtTreasury
  )
}

/** Derive voter ballot PDA from proposal + voter */
export function getBallotPDA(proposal: PublicKey, voter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.ballot, proposal.toBuffer(), voter.toBuffer()],
    PROGRAM_IDS.districtTreasury
  )
}

// ─── Crowdfunding ───

/** Derive crowdfunding campaign PDA from creator + title */
export function getCampaignPDA(creator: PublicKey, title: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.campaign, creator.toBuffer(), Buffer.from(title)],
    PROGRAM_IDS.crowdfunding
  )
}

/** Derive campaign escrow PDA from campaign account */
export function getCampaignEscrowPDA(campaign: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.cfEscrow, campaign.toBuffer()],
    PROGRAM_IDS.crowdfunding
  )
}

/** Derive donor record PDA from campaign + donor wallet */
export function getDonorRecordPDA(campaign: PublicKey, donor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.donor, campaign.toBuffer(), donor.toBuffer()],
    PROGRAM_IDS.crowdfunding
  )
}
