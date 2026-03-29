import { vi } from 'vitest'
import { PublicKey } from '@solana/web3.js'

export const TEST_WALLET = new PublicKey('GRxpKMjVx7UiRp4VnDHDdFR6qkuMN5cGSLSYHDQGRg8K')
export const TEST_WALLET_2 = new PublicKey('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')

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
