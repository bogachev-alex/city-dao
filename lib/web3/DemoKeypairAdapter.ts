import {
  BaseWalletAdapter,
  WalletName,
  WalletReadyState,
  WalletNotConnectedError,
  type SendTransactionOptions,
} from '@solana/wallet-adapter-base'
import {
  Keypair,
  Transaction,
  VersionedTransaction,
  Connection,
  type TransactionSignature,
} from '@solana/web3.js'

const DEMO_SK_KEY = 'amanat_demo_sk'

export const DemoWalletName = 'Demo Wallet' as WalletName<'Demo Wallet'>

function loadOrCreateKeypair(): Keypair {
  if (typeof window === 'undefined') return Keypair.generate()
  try {
    const stored = localStorage.getItem(DEMO_SK_KEY)
    if (stored) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(stored)))
    }
  } catch {}
  const kp = Keypair.generate()
  localStorage.setItem(DEMO_SK_KEY, JSON.stringify(Array.from(kp.secretKey)))
  return kp
}

/**
 * A lightweight wallet adapter that uses an ephemeral Keypair stored in
 * localStorage. No browser extension required. Designed for devnet demo mode.
 *
 * Implements signTransaction / signAllTransactions so Anchor's AnchorProvider
 * can use it just like Phantom.
 */
export class DemoKeypairAdapter extends BaseWalletAdapter {
  readonly name = DemoWalletName
  readonly url = '#'
  // Simple green shield SVG as icon (base64)
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMTBiOTgxIi8+PHBhdGggZD0iTTE2IDZMMjQgOVYxNkMyNCAyMCAxNiAyNiAxNiAyNkM4IDI2IDggMjAgOCAxNlY5TDE2IDZ6IiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC45Ii8+PC9zdmc+'

  private _keypair: Keypair | null = null
  private _connecting = false

  get publicKey() {
    return this._keypair?.publicKey ?? null
  }

  get readyState() {
    return WalletReadyState.Installed
  }

  get connecting() {
    return this._connecting
  }

  async connect(): Promise<void> {
    this._connecting = true
    try {
      this._keypair = loadOrCreateKeypair()
      this.emit('connect', this._keypair.publicKey)
    } finally {
      this._connecting = false
    }
  }

  async disconnect(): Promise<void> {
    this._keypair = null
    this.emit('disconnect')
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    _options?: SendTransactionOptions
  ): Promise<TransactionSignature> {
    if (!this._keypair) throw new WalletNotConnectedError()

    if (transaction instanceof VersionedTransaction) {
      transaction.sign([this._keypair])
      return await connection.sendTransaction(transaction)
    }

    // Legacy transaction
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.lastValidBlockHeight = lastValidBlockHeight
    transaction.feePayer = this._keypair.publicKey
    transaction.sign(this._keypair)
    return await connection.sendRawTransaction(transaction.serialize())
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    if (!this._keypair) throw new WalletNotConnectedError()
    if (transaction instanceof VersionedTransaction) {
      transaction.sign([this._keypair])
    } else {
      transaction.partialSign(this._keypair)
    }
    return transaction
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)))
  }
}
