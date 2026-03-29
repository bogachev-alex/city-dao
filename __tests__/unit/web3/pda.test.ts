import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import {
  getCitizenPDA, getContractPDA, getEscrowPDA,
  getJurySessionPDA, getJuryVotePDA,
  getTreasuryPDA, getProposalPDA, getBallotPDA,
  getCampaignPDA, getCampaignEscrowPDA, getDonorRecordPDA,
} from '@/lib/web3/pda'

const W1 = new PublicKey('GRxpKMjVx7UiRp4VnDHDdFR6qkuMN5cGSLSYHDQGRg8K')
const W2 = new PublicKey('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')

describe('PDA functions', () => {
  it('getCitizenPDA: deterministic, unique per wallet', () => {
    const [a] = getCitizenPDA(W1)
    const [b] = getCitizenPDA(W1)
    const [c] = getCitizenPDA(W2)
    expect(a.equals(b)).toBe(true)
    expect(a.equals(c)).toBe(false)
  })

  it('getContractPDA: unique per title', () => {
    const [a] = getContractPDA(W1, 'Contract A')
    const [b] = getContractPDA(W1, 'Contract B')
    expect(a.equals(b)).toBe(false)
  })

  it('getEscrowPDA: derives from contract', () => {
    const [contract] = getContractPDA(W1, 'Test')
    const [escrow] = getEscrowPDA(contract)
    expect(escrow).toBeInstanceOf(PublicKey)
    expect(escrow.equals(contract)).toBe(false)
  })

  it('getJurySessionPDA: unique per milestone index', () => {
    const [contract] = getContractPDA(W1, 'Test')
    const [a] = getJurySessionPDA(contract, 0)
    const [b] = getJurySessionPDA(contract, 1)
    expect(a.equals(b)).toBe(false)
  })

  it('getJuryVotePDA: unique per juror (prevents double voting on-chain)', () => {
    const session = new PublicKey('11111111111111111111111111111111')
    const [a] = getJuryVotePDA(session, W1)
    const [b] = getJuryVotePDA(session, W2)
    expect(a.equals(b)).toBe(false)
  })

  it('getTreasuryPDA: deterministic per district', () => {
    const [a] = getTreasuryPDA('Медеуский')
    const [b] = getTreasuryPDA('Медеуский')
    expect(a.equals(b)).toBe(true)
  })

  it('getBallotPDA: unique per voter (prevents double treasury voting)', () => {
    const [treasury] = getTreasuryPDA('Медеуский')
    const [proposal] = getProposalPDA(treasury, 'Test')
    const [a] = getBallotPDA(proposal, W1)
    const [b] = getBallotPDA(proposal, W2)
    expect(a.equals(b)).toBe(false)
  })

  it('getCampaignPDA + getCampaignEscrowPDA + getDonorRecordPDA', () => {
    const [campaign] = getCampaignPDA(W1, 'Test')
    const [escrow] = getCampaignEscrowPDA(campaign)
    const [donor] = getDonorRecordPDA(campaign, W2)
    expect(campaign).toBeInstanceOf(PublicKey)
    expect(escrow.equals(campaign)).toBe(false)
    expect(donor.equals(campaign)).toBe(false)
  })
})
