// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { TEST_WALLET, mockWallet, mockConnection } from '../mocks/solana'

const fakePDA = PublicKey.default
vi.spyOn(PublicKey, 'findProgramAddressSync').mockReturnValue([fakePDA, 255])

const mockRpc = vi.fn().mockResolvedValue('mock-vote-tx')
const mockAccounts = vi.fn().mockReturnValue({ rpc: mockRpc })
const mockVoteOnProposal = vi.fn().mockReturnValue({ accounts: mockAccounts })

const mockProgram = {
  methods: { voteOnProposal: mockVoteOnProposal },
  account: {},
}

vi.mock('@solana/wallet-adapter-react', () => ({
  useConnection: () => ({ connection: mockConnection }),
  useWallet: () => mockWallet,
}))

vi.mock('@coral-xyz/anchor', () => {
  function AnchorProvider() {}
  function Program() { return mockProgram }
  return { AnchorProvider, Program, BN: vi.fn((n: number) => n) }
})

const { useDistrictTreasury } = await import('@/lib/web3/useDistrictTreasury')

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue('mock-vote-tx')
})

describe('useDistrictTreasury', () => {
  it('voteOnProposal sends tx with ballot PDA', async () => {
    const { result } = renderHook(() => useDistrictTreasury())

    let res: any
    await act(async () => {
      res = await result.current.voteOnProposal('Ауэзовский', 'Test Proposal', true)
    })

    expect(mockVoteOnProposal).toHaveBeenCalled()
    expect(mockAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        voter: TEST_WALLET,
        systemProgram: SystemProgram.programId,
      })
    )
    expect(res.tx).toBe('mock-vote-tx')
  })

  it('handles vote error gracefully', async () => {
    mockRpc.mockRejectedValueOnce(new Error('Already voted'))
    const { result } = renderHook(() => useDistrictTreasury())

    await act(async () => {
      await expect(
        result.current.voteOnProposal('Ауэзовский', 'Test', true)
      ).rejects.toThrow('Already voted')
    })

    expect(result.current.error).toBeTruthy()
  })
})
