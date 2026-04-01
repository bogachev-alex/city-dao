# Solana USDC Economy (Implementation Notes)

This repository is moving to a USDC-first settlement architecture:

- USDC for contract money flows (escrow, tranches, penalties, expert stake/slash).
- SOL only for fees/rent.
- PDA vaults for deterministic, program-owned safes.

## Implemented scaffolding

- Public economy config endpoint: `app/api/economy/config/route.ts`
- Relayer MVP endpoint (jury/citizen allowlist): `app/api/relayer/vote/route.ts`
- Expert stake/slash orchestration endpoint: `app/api/economy/expert-stake/route.ts`
- Rent lifecycle policy/queue endpoint: `app/api/economy/rent-lifecycle/route.ts`
- USDC helpers: `lib/economy/usdc.ts`
- Vault PDA helpers: `lib/web3/pda.ts`

## Next on-chain migration checkpoints

1. `contract_registry`: replace lamport transfers with SPL Token CPI.
2. `district_treasury`: convert deposit/execute to token balances/transfers.
3. `citizen_registry` + `penalty_engine`: expert stake vault and slash path.
4. Add close-account instructions for rent reclaim.

