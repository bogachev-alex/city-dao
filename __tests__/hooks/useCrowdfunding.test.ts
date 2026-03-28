// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { TEST_WALLET, TEST_WALLET_2, mockWallet, mockConnection } from '../mocks/solana'

const fakePDA = PublicKey.default
vi.spyOn(PublicKey, 'findProgramAddressSync').mockReturnValue([fakePDA, 255])

const mockRpc = vi.fn().mockResolvedValue('mock-campaign-tx')
const mockAccounts = vi.fn().mockReturnValue({ rpc: mockRpc })
const mockInitCampaign = vi.fn().mockReturnValue({ accounts: mockAccounts })
const mockContribute = vi.fn().mockReturnValue({ accounts: mockAccounts })

const mockProgram = {
  methods: { initCampaign: mockInitCampaign, contribute: mockContribute },
  account: { crowdfundingCampaignAccount: { fetch: vi.fn().mockResolvedValue(null) } },
}

vi.mock('@solana/wallet-adapter-react', () => ({
  useConnection: () => ({ connection: mockConnection }),
  useWallet: () => mockWallet,
}))

vi.mock('@coral-xyz/anchor', () => {
  function AnchorProvider() {}
  function Program() { return mockProgram }
  function BN(n: number) { return { toNumber: () => n, toString: () => String(n) } }
  return { AnchorProvider, Program, BN }
})

const { useCrowdfunding } = await import('@/lib/web3/useCrowdfunding')

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue('mock-campaign-tx')
})

describe('useCrowdfunding', () => {
  it('createCampaign sends tx and returns PDA', async () => {
    const { result } = renderHook(() => useCrowdfunding())

    let res: any
    await act(async () => {
      res = await result.current.createCampaign(
        'Test Campaign', 'Description', 'Ауэзовский', 'playground',
        1000000, Math.floor(Date.now() / 1000) + 86400, 43.24, 76.87
      )
    })

    expect(mockInitCampaign).toHaveBeenCalled()
    expect(mockAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        creator: TEST_WALLET,
        systemProgram: SystemProgram.programId,
      })
    )
    expect(res.tx).toBe('mock-campaign-tx')
    expect(res.pda).toBeTruthy()
  })

  it('contribute sends tx with correct accounts', async () => {
    const { result } = renderHook(() => useCrowdfunding())

    await act(async () => {
      await result.current.contribute(TEST_WALLET_2, 'Test Campaign', 5000, false)
    })

    expect(mockContribute).toHaveBeenCalled()
    expect(mockAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        donor: TEST_WALLET,
        systemProgram: SystemProgram.programId,
      })
    )
  })

  it('handles createCampaign error', async () => {
    mockRpc.mockRejectedValueOnce(new Error('Insufficient funds'))
    const { result } = renderHook(() => useCrowdfunding())

    await act(async () => {
      await expect(
        result.current.createCampaign('T', 'D', 'A', 'playground', 100, 0, 0, 0)
      ).rejects.toThrow('Insufficient funds')
    })

    expect(result.current.error).toBeTruthy()
  })
})
