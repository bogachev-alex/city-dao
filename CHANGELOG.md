# Changelog

## [Unreleased]

### Added

- [2026-03-31] Phase 2 contractor bidding: `BidRound` / `Bid` Prisma models (optional `Contract.contractorId`); `lib/bidding.ts`; `GET`/`POST /api/bids`, `GET`/`PATCH /api/bids/[roundId]`; tick engine auto-closes bid rounds after `closesDay` (`BID_ROUND_CLOSED` events); agent API supports `open_bid_round`, `bid_on_contract`, `select_bid_winner`; `POST /api/contracts` accepts `awaitingBids: true` for unassigned contracts; `PATCH /api/contracts/[id]` can set `contractorId`.

- [2026-03-30] Phase 0 of closed-loop agent simulation: `GameState`, `GameEvent` Prisma models; `JurySession` game-day phase fields; `POST/GET /api/game/tick`; deterministic tick engine (`lib/tick-engine.ts`) for milestones, penalties, jury phases, proposals, treasury income, crowdfunding expiry, contractor metrics.

- [2026-03-30] Phase 1 agent API: `GET /api/agent/observe`, `POST /api/agent/action` with `lib/agent/observe.ts`, `lib/agent/dispatch-action.ts`, `lib/agent/jury-vote-agent.ts` (commit/reveal salt on `JuryVote.agentCommitSalt`). Runbook: `agentic/OPENCODE-RUN.md`.
