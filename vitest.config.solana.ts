import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest config for Solana devnet E2E tests.
 *
 * Separate from the main config because:
 * - Much longer timeouts (devnet transactions + airdrops)
 * - No React/jsdom — runs in Node with real Solana RPC calls
 * - Sequential execution (avoid airdrop rate limits)
 * - Different include pattern (tests/solana/)
 *
 * Run: npm run test:solana
 * Env: SOLANA_TEST_RPC_URL (optional, defaults to devnet public RPC)
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/solana/**/*.test.ts'],
    testTimeout: 120_000,       // 2 min per test (devnet can be slow)
    hookTimeout: 90_000,        // 1.5 min for beforeAll (airdrop)
    sequence: {
      concurrent: false,        // sequential — avoid parallel airdrop throttling
    },
    fileParallelism: false,     // one file at a time
    reporters: ['verbose'],
  },
})
