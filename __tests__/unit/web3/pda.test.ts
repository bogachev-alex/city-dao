import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import {
  getCitizenPDA,
  getContractPDA,
  getEscrowPDA,
  getJurySessionPDA,
  getJuryVotePDA,
  getTreasuryPDA,
  getProposalPDA,
  getBallotPDA,
  getCampaignPDA,
  getCampaignEscrowPDA,
  getDonorRecordPDA,
} from '@/lib/web3/pda'

const WALLET_A = new PublicKey('GRxpKMjVx7UiRp4VnDHDdFR6qkuMN5cGSLSYHDQGRg8K')
const WALLET_B = new PublicKey('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')

describe('PDA derivation', () => {
  describe('getCitizenPDA', () => {
    it('returns [PublicKey, number] tuple', () => {
      const [pda, bump] = getCitizenPDA(WALLET_A)
      expect(pda).toBeInstanceOf(PublicKey)
      expect(typeof bump).toBe('number')
    })

    it('is deterministic', () => {
      const [a] = getCitizenPDA(WALLET_A)
      const [b] = getCitizenPDA(WALLET_A)
      expect(a.equals(b)).toBe(true)
    })

    it('different wallets → different PDAs', () => {
      const [a] = getCitizenPDA(WALLET_A)
      const [b] = getCitizenPDA(WALLET_B)
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('getContractPDA', () => {
    it('returns deterministic PDA from authority + title', () => {
      const [a] = getContractPDA(WALLET_A, 'Test Contract')
      const [b] = getContractPDA(WALLET_A, 'Test Contract')
      expect(a.equals(b)).toBe(true)
    })

    it('different titles → different PDAs', () => {
      const [a] = getContractPDA(WALLET_A, 'Contract A')
      const [b] = getContractPDA(WALLET_A, 'Contract B')
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('getEscrowPDA', () => {
    it('derives from contract PDA', () => {
      const [contractPDA] = getContractPDA(WALLET_A, 'Test')
      const [escrow, bump] = getEscrowPDA(contractPDA)
      expect(escrow).toBeInstanceOf(PublicKey)
      expect(typeof bump).toBe('number')
    })
  })

  describe('getJurySessionPDA', () => {
    it('derives from contract + milestone index', () => {
      const [contractPDA] = getContractPDA(WALLET_A, 'Test')
      const [a] = getJurySessionPDA(contractPDA, 0)
      const [b] = getJurySessionPDA(contractPDA, 1)
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('getJuryVotePDA', () => {
    it('unique per session + juror', () => {
      const session = new PublicKey('11111111111111111111111111111111')
      const [a] = getJuryVotePDA(session, WALLET_A)
      const [b] = getJuryVotePDA(session, WALLET_B)
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('getTreasuryPDA', () => {
    it('derives from district name', () => {
      const [a] = getTreasuryPDA('Медеуский')
      const [b] = getTreasuryPDA('Ауэзовский')
      expect(a.equals(b)).toBe(false)
    })

    it('is deterministic', () => {
      const [a] = getTreasuryPDA('Медеуский')
      const [b] = getTreasuryPDA('Медеуский')
      expect(a.equals(b)).toBe(true)
    })
  })

  describe('getProposalPDA', () => {
    it('derives from treasury + title', () => {
      const [treasury] = getTreasuryPDA('Медеуский')
      const [a] = getProposalPDA(treasury, 'Proposal A')
      const [b] = getProposalPDA(treasury, 'Proposal B')
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('getBallotPDA', () => {
    it('unique per proposal + voter (prevents double voting)', () => {
      const [treasury] = getTreasuryPDA('Медеуский')
      const [proposal] = getProposalPDA(treasury, 'Test')
      const [a] = getBallotPDA(proposal, WALLET_A)
      const [b] = getBallotPDA(proposal, WALLET_B)
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('getCampaignPDA', () => {
    it('derives from creator + title', () => {
      const [a] = getCampaignPDA(WALLET_A, 'Campaign 1')
      const [b] = getCampaignPDA(WALLET_A, 'Campaign 1')
      expect(a.equals(b)).toBe(true)
    })
  })

  describe('getCampaignEscrowPDA', () => {
    it('derives from campaign PDA', () => {
      const [campaign] = getCampaignPDA(WALLET_A, 'Test')
      const [escrow] = getCampaignEscrowPDA(campaign)
      expect(escrow).toBeInstanceOf(PublicKey)
      expect(escrow.equals(campaign)).toBe(false)
    })
  })

  describe('getDonorRecordPDA', () => {
    it('unique per campaign + donor', () => {
      const [campaign] = getCampaignPDA(WALLET_A, 'Test')
      const [a] = getDonorRecordPDA(campaign, WALLET_A)
      const [b] = getDonorRecordPDA(campaign, WALLET_B)
      expect(a.equals(b)).toBe(false)
    })
  })
})
