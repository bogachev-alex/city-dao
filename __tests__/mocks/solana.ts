import { vi } from 'vitest'
import { PublicKey, SystemProgram } from '@solana/web3.js'

// Valid base58 test public keys
export const TEST_WALLET = new PublicKey('GRxpKMjVx7UiRp4VnDHDdFR6qkuMN5cGSLSYHDQGRg8K')
export const TEST_WALLET_2 = new PublicKey('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')

// Mock rpc chain: program.methods.X(...).accounts({...}).rpc()
export function mockRpcChain(txSig = 'mock-tx-signature') {
  const rpc = vi.fn().mockResolvedValue(txSig)
  const accounts = vi.fn().mockReturnValue({ rpc })
  const method = vi.fn().mockReturnValue({ accounts })
  return { method, accounts, rpc }
}

// Mock Anchor Program
export function createMockProgram(methods: Record<string, ReturnType<typeof mockRpcChain>>) {
  const methodsProxy = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (methods[prop]) {
          return (...args: any[]) => {
            methods[prop].method(...args)
            return { accounts: methods[prop].accounts }
          }
        }
        return vi.fn().mockReturnValue({ accounts: vi.fn().mockReturnValue({ rpc: vi.fn() }) })
      },
    }
  )

  return {
    methods: methodsProxy,
    account: new Proxy(
      {},
      {
        get() {
          return { fetch: vi.fn().mockResolvedValue(null) }
        },
      }
    ),
    programId: new PublicKey('11111111111111111111111111111111'),
  }
}

// Mock useWallet return
export const mockWallet = {
  publicKey: TEST_WALLET,
  connected: true,
  signTransaction: vi.fn(),
  signAllTransactions: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  select: vi.fn(),
  wallet: null,
  wallets: [],
  connecting: false,
  disconnecting: false,
  sendTransaction: vi.fn(),
}

export const mockConnection = {
  getGenesisHash: vi.fn().mockResolvedValue('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'),
  getBalance: vi.fn().mockResolvedValue(1_000_000_000),
  getAccountInfo: vi.fn().mockResolvedValue(null),
  confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
}
