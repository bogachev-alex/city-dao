# Changelog

## [Unreleased]

- Docker production setup: `app/Dockerfile`, `app/.dockerignore`, repo root `docker-compose.yml` (PostgreSQL + Next.js), `deploy.env.example`, `DEPLOY.md`.
- Agentic coding workflow vendored under `city_dao/agentic_coding/` (Cursor rules + bash/PowerShell helpers); `app/.cursor/rules/` consumes templates from there.
- Added Solana Anchor program `programs/crowdfunding` (init_campaign, contribute, match_funds, refund_all with donor pairs in remaining accounts, finalize_campaign). Wired into workspace `Cargo.toml` and `Anchor.toml` (program id `CRWDaH7ByG5BKmoCRestxNP7k4gSWgrWQVKLhf5VQ8mZ`).
- Synced `lib/web3/idl/crowdfunding.json` to Anchor discriminators; added `systemProgram` on `refund_all`; `useCrowdfunding` exposes `matchFunds`, `refundAll` (with `.remainingAccounts`), `finalizeCampaign`; `npm run idl:verify` checks IDL hashes.
