// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { TEST_WALLET, mockWallet, mockConnection } from '../mocks/solana'

const fakePDA = PublicKey.default
vi.spyOn(PublicKey, 'findProgramAddressSync').mockReturnValue([fakePDA, 255])

const mockRpc = vi.fn().mockResolvedValue('mock-tx-sig')
const mockAccounts = vi.fn().mockReturnValue({ rpc: mockRpc })
const mockRegisterCitizen = vi.fn().mockReturnValue({ accounts: mockAccounts })
const mockFetch = vi.fn().mockResolvedValue({ district: 'Медеуский', reputationScore: 100 })

const mockProgram = {
  methods: { registerCitizen: mockRegisterCitizen },
  account: { citizenProfile: { fetch: mockFetch } },
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

const { useCitizenRegistry } = await import('@/lib/web3/useCitizenRegistry')

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue('mock-tx-sig')
  mockFetch.mockResolvedValue({ district: 'Медеуский', reputationScore: 100 })
})

describe('useCitizenRegistry', () => {
  it('registerCitizen sends transaction and returns tx sig', async () => {
    const { result } = renderHook(() => useCitizenRegistry())

    let txResult: any
    await act(async () => {
      txResult = await result.current.registerCitizen('Медеуский', new Uint8Array(32))
    })

    expect(mockRegisterCitizen).toHaveBeenCalled()
    expect(mockAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet: TEST_WALLET,
        systemProgram: SystemProgram.programId,
      })
    )
    expect(mockRpc).toHaveBeenCalled()
    expect(txResult.tx).toBe('mock-tx-sig')
  })

  it('fetchCitizenProfile reads from chain', async () => {
    const { result } = renderHook(() => useCitizenRegistry())

    let profile: any
    await act(async () => {
      profile = await result.current.fetchCitizenProfile()
    })

    expect(mockFetch).toHaveBeenCalled()
    expect(profile).toHaveProperty('district')
  })

  it('handles transaction error', async () => {
    mockRpc.mockRejectedValueOnce(new Error('Program not found'))
    const { result } = renderHook(() => useCitizenRegistry())

    await act(async () => {
      await expect(result.current.registerCitizen('Медеуский', new Uint8Array(32)))
        .rejects.toThrow('Program not found')
    })

    expect(result.current.error).toBeTruthy()
  })
})
