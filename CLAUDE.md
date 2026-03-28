# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amanat Protocol — a City DAO for transparent monitoring of Almaty government construction contracts. The frontend is an MVP demo with mock/demo data (no live Solana integration yet). The UI language is Russian.

## Commands

```bash
npm run dev      # Start dev server (Next.js on port 3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run Next.js linter
```

No test framework is configured. No `.env.local` is committed — you need `OPENAI_API_KEY` set for the AI research endpoint.

## Architecture

**Next.js 14 App Router** project with TypeScript, Tailwind CSS, and no database — all contract data is in-memory demo data (`lib/contracts.ts`).

### Key patterns

- **`lib/contracts.ts`** — Central data layer. All pages import `DEMO_CONTRACTS` and helper functions from here. Types `Contract`, `Milestone`, `ContractStatus`, `MilestoneStatus` are defined here.
- **`lib/crypto.ts`** — Client-side Web Crypto API utilities: IIN SHA-256 hashing and commit-reveal vote hashing. IIN never leaves the browser.
- **`app/api/research/route.ts`** — Single API route. Calls OpenAI Responses API (`gpt-4o-mini` + `web_search_preview` tool) to generate SWOT/risk analysis for treasury proposals. Returns structured JSON.
- **AlmatyMap component** — Uses `react-leaflet` with `dynamic(() => import(...), { ssr: false })` to avoid SSR. Custom SVG pin icons with animated pulsing for overdue contracts. Leaflet popup styles are overridden in `globals.css`.
- **JuryVoting component** — Implements commit-reveal voting flow using `localStorage` for salt persistence.
- **Path alias** — `@/*` maps to repo root (tsconfig paths).

### Page structure

| Route | Purpose |
|---|---|
| `/` | Almaty map with contract pins + stats banner |
| `/contracts` | Filterable contract list |
| `/contracts/[id]` | Contract detail with milestone timeline |
| `/jury/[session_id]` | Commit-reveal jury voting |
| `/treasury/[district]` | District treasury + AI-researched proposals |
| `/register` | Citizen registration (client-side IIN hashing) |
| `/profile` | Reputation score display |
| `/admin` | Government contract registration form |

### Styling

Dark theme throughout (`bg-gray-950`, `text-white`). Emerald is the primary accent color. All components use Tailwind utility classes directly — no component library. The Inter font loads with both `latin` and `cyrillic` subsets.

### Smart contract design (documented, not yet implemented)

The `ARCHITECTURE.md` file documents the planned Solana/Anchor program design: 5 programs (Contract Registry, Citizen Registry, Jury Mechanism, Penalty Engine, District Treasury) with Switchboard VRF for random jury selection. The frontend currently uses mock data in place of on-chain reads.

### Scripts

`scripts/generate-arch.js` — Node script that programmatically generates `ARCHITECTURE.excalidraw` diagram. Run with `node scripts/generate-arch.js`.
