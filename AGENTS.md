# Amanat Protocol — OpenCode agent context

## Project

- **Stack**: Next.js (App Router, locales) + Prisma (PostgreSQL) + Solana **Anchor** programs under `programs/`.
- **Blockchain**: Devnet by default; program IDs and RPC in `lib/web3/constants.ts`.
- **Crowdfunding**: Hybrid DB + optional on-chain hooks (`lib/web3/useCrowdfunding.ts`, IDL `lib/web3/idl/crowdfunding.json`). On-chain program: `programs/crowdfunding` (see `Anchor.toml`). IDL discriminators are kept in sync with Anchor’s `sha256("global:" / "account:" / "event:" + name)[0..8]`; run `npm run idl:verify` in `app/` after edits. Build: `cd app && anchor build`; deploy to devnet with a keypair for program id `CRWDaH7...` (or generate a new id and update `declare_id!`, `lib/web3/constants.ts`, and IDL `address`). After `anchor build`, compare `target/idl/crowdfunding.json` with the checked-in IDL in case of layout drift.

## Conventions

- TypeScript: match existing imports and `@/` aliases.
- API routes: `app/api/**`.
- Prisma client: `lib/generated/prisma` (do not hand-edit generated code).
- Solana: Anchor 0.32.x per `Anchor.toml`; Rust edition and patterns like existing `programs/*/src/lib.rs`.

## Agentic coding (ARCHITECT → OpenCode GLM-5 → REGISTRAR)

Workflow sources live in **`city_dao/agentic_coding/`** (not under `app/`).

- **Docs:** [`city_dao/agentic_coding/README.md`](../city_dao/agentic_coding/README.md)
- **Cursor rules:** `app/.cursor/rules/` (sync from `city_dao/agentic_coding/cursor-rules/` when templates change)
- **Shell (macOS/Linux):** `cd app` then `source ../city_dao/agentic_coding/bash/workflow.sh`, then `start-workflow-watcher`
- **Windows:** dot-source `city_dao/agentic_coding/powershell/workflow.ps1`, `Set-Location` to `app`, then `Start-WorkflowWatcher`
- **OpenCode:** `opencode.json` uses **`zai-coding-plan/glm-5`**. Set **`ZHIPU_API_KEY`** (see `.env.example`).

Shortcut commands in OpenCode TUI: `/agentic-plan`, `/agentic-build`, `/anchor-feature`.

## Environment

- Set `ZHIPU_API_KEY` in the shell or in `.env` (ignored by git) before running `opencode` from this directory. Never commit API keys.
