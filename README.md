<p align="center">
  <img src="https://img.shields.io/badge/Solana-Devnet-blueviolet?logo=solana" alt="Solana Devnet" />
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/Anchor-0.32-blue" alt="Anchor" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tests-169_passed-brightgreen" alt="Tests" />
</p>

# Amanat Protocol

**City DAO for transparent monitoring of Almaty government construction contracts**

> 26 of 147 Almaty city projects had delays or quality violations in 2025.
> 38 billion tenge invested. Contractors take new contracts without finishing existing ones.
> Penalties are not enforced.

Amanat Protocol puts government contracts on Solana, escrows 20% of funds in smart contracts, auto-penalizes overdue work, and lets citizens verify construction quality through a provably random jury system.

---

## How It Works

```
                CITIZEN                     AKIMAT                    CONTRACTOR
                   |                           |                           |
                   |    registers contract      |                           |
                   |    on Solana (20% escrow)  |                           |
                   |                           |────────────────────────────>
                   |                           |                           |
                   |                           |      submits milestone     |
                   |                           |      + photo evidence      |
                   |<──────────────────────────────────────────────────────|
                   |                           |                           |
              VRF selects                      |                           |
              3 citizens + 1 expert            |                           |
                   |                           |                           |
           commit-reveal vote                  |                           |
           (48h commit + 24h reveal)           |                           |
                   |                           |                           |
              ┌────┴────┐                      |                           |
              |         |                      |                           |
           ACCEPT    REJECT                    |                           |
              |         |                      |                           |
         release     penalty ──> District      |                           |
         tranche     (1-10%)     Treasury      |                           |
              |                    |            |                           |
              └────────────────────┘            |                           |
                                   |            |                           |
                          citizens vote         |                           |
                          on spending           |                           |
                          (with AI research)    |                           |
```

---

## Key Features

### On-Chain (Solana / Anchor)

| Program | What it does |
|---------|-------------|
| **Contract Registry** | Registers government contracts, escrows 20%, milestone submit/accept/reject, auto-penalty on deadline |
| **Citizen Registry** | Soulbound tokens (non-transferable), IIN hash for uniqueness, reputation score |
| **Jury Mechanism** | VRF-based random jury selection, commit-reveal voting with SHA-256 verification |
| **Penalty Engine** | 1% per day overdue, 10% per rejection, 5% per ghost site, capped at 30% |
| **District Treasury** | Penalty funds pooled per district, citizen-voted spending proposals |
| **Crowdfunding** | Citizen-initiated projects with state co-funding (50-90%), escrow, refund on failure |

### Frontend

| Feature | Description |
|---------|-------------|
| Interactive map | Leaflet map of Almaty with contract pins (color-coded by status) |
| 3 user roles | Citizen, Contractor, Akimat (government) with role-specific dashboards |
| AI Research Agent | OpenAI-powered SWOT analysis and cost benchmarking before treasury votes |
| Crowdfunding | Citizens fund projects, state matches 50-90% depending on category |
| Penalty calculator | Real-time penalty computation with formula visualization |
| ADL Token | SPL token on devnet, awarded for civic participation |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
|                        Browser (Phantom Wallet)                  |
└──────────────────────────┬──────────────────────────────────────┘
                           |
                    ┌──────┴──────┐
                    |   Next.js   |
                    |   Frontend  |
                    └──┬───────┬──┘
                       |       |
          ┌────────────┘       └────────────┐
          |                                 |
   ┌──────┴──────┐                  ┌───────┴───────┐
   |  PostgreSQL  |                  |  Solana Devnet |
   |   (Prisma)   |                  |   6 Anchor     |
   |              |                  |   Programs     |
   |  - Contracts |                  |                |
   |  - Citizens  |                  |  + SPL Token   |
   |  - Treasury  |                  |    (ADL)       |
   |  - Proposals |                  |                |
   |  - Work Logs |                  |  + IPFS/Arweave|
   └──────────────┘                  |    (evidence)  |
                                     └────────────────┘
```

**Dual-mode data layer:** the app works in `mock` mode with demo data (no wallet needed) or `onchain` mode reading directly from Solana devnet. Controlled by `NEXT_PUBLIC_DATA_SOURCE` env var.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Solana (devnet) |
| Smart contracts | Rust + Anchor 0.32 |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| Maps | Leaflet + react-leaflet |
| Wallet | Phantom (via @solana/wallet-adapter) |
| AI | OpenAI gpt-4o-mini + web_search_preview |
| i18n | next-intl (Russian + Kazakh) |
| Testing | Vitest (unit) + Playwright (e2e) |
| Deploy | nginx + PM2 on Ubuntu 24.04 |

---

## Project Structure

```
city-dao/
├── app/
|   ├── [locale]/              # Pages (Next.js App Router + i18n)
|   |   ├── page.tsx           # Home — Almaty map with contract pins
|   |   ├── contracts/         # Contract list + detail with milestones
|   |   ├── crowdfunding/      # Campaign list + detail + create + my campaigns
|   |   ├── treasury/          # District treasury with proposals and voting
|   |   ├── jury/              # Commit-reveal jury voting
|   |   ├── admin/             # Akimat contract registration form
|   |   ├── akimat/            # Akimat dashboard
|   |   ├── contractor/        # Contractor dashboard
|   |   ├── profile/           # Citizen reputation + ADL wallet
|   |   ├── login/             # Phantom wallet + demo login
|   |   └── register*/         # Registration for citizen/contractor/akimat
|   └── api/                   # API routes (30+)
|       ├── contracts/         # CRUD, milestone submit, penalty
|       ├── crowdfunding/      # Campaign CRUD, contributions
|       ├── treasury/          # District treasury, proposals, voting
|       ├── research/          # AI SWOT analysis (OpenAI)
|       ├── goszakup/          # Proxy to goszakup.gov.kz
|       └── ...
├── components/                # React components
|   ├── AlmatyMap.tsx          # Leaflet map (SSR-disabled)
|   ├── ContractCard.tsx       # Contract card with penalty + progress
|   ├── CampaignCard.tsx       # Crowdfunding campaign card
|   ├── TreasuryDashboard.tsx  # Treasury with proposals + votes
|   ├── JuryVoting.tsx         # Commit-reveal voting flow
|   ├── PenaltyCalculator.tsx  # Real-time penalty formula
|   ├── CryptoTooltip.tsx      # Hover tooltip with SOL/USDT equivalent
|   └── ...
├── lib/
|   ├── contracts.ts           # Contract types + demo data + formatters
|   ├── crowdfunding.ts        # Campaign types + demo data
|   ├── crypto.ts              # Client-side SHA-256 (IIN hashing, vote commits)
|   ├── auth.ts                # Auth types, role nav, localStorage session
|   ├── tokens.ts              # ADL token engine (demo, localStorage)
|   ├── adl-token.ts           # Real SPL token mint/balance (server-side)
|   ├── api.ts                 # Centralized fetch functions with TTL cache
|   └── web3/                  # Solana integration
|       ├── constants.ts       # Program IDs, PDA seeds, tenge/SOL conversion
|       ├── onchain.ts         # Read GovernmentContract accounts from chain
|       ├── useContracts.ts    # Dual-mode hook (mock/onchain)
|       ├── useCrowdfunding.ts # Crowdfunding Anchor program hook
|       ├── useJuryMechanism.ts
|       ├── useContractRegistry.ts
|       └── ...
├── programs/                  # Solana smart contracts (Rust/Anchor)
|   ├── contract_registry/     # Government contract lifecycle
|   ├── citizen_registry/      # Soulbound citizen tokens
|   ├── jury_mechanism/        # Commit-reveal jury voting
|   ├── penalty_engine/        # Auto-penalty calculation + CPI
|   ├── district_treasury/     # District-level fund management
|   └── crowdfunding/          # Civic crowdfunding with state matching
├── prisma/
|   ├── schema.prisma          # 15+ models (full domain)
|   └── seed.ts                # Seed data for all modules
├── tests/
|   └── e2e/                   # Playwright flow tests
├── __tests__/                 # Vitest unit + API tests (169 tests)
└── scripts/                   # Deploy, seed, IDL verify scripts
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Production build
npm run build && npm start
```

### Environment Variables

```bash
# Required for AI research
OPENAI_API_KEY=sk-...

# Database (optional — app works with demo data without it)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/amanat

# Solana (optional — defaults to public devnet RPC)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_DATA_SOURCE=mock   # "mock" or "onchain"

# ADL Token (optional — for real SPL token minting)
NEXT_PUBLIC_ADL_MINT=<base58 mint address>
ADL_MINT_AUTHORITY_SECRET_KEY=<base64 keypair>

# External data (optional)
GOSZAKUP_TOKEN=<goszakup.gov.kz API token>
```

---

## Smart Contract Design

### Penalty Formula

```
time_penalty    = total_amount x days_overdue / 100       (1% per day)
quality_penalty = total_amount x rejection_count x 10/100 (10% per rejection)
ghost_penalty   = total_amount x ghost_count x 5/100      (5% per ghost site)

total_penalty   = min(time + quality + ghost, total_amount x 30/100)
                                                           ^ capped at 30%
```

### Commit-Reveal Jury Voting

```
Phase 1 — Commit (48 hours):
  Juror submits: hash(vote_byte || random_salt)    -> stored on-chain
  Vote is hidden from other jurors

Phase 2 — Reveal (24 hours):
  Juror reveals: vote + salt
  Contract verifies: SHA-256(vote || salt) == committed hash
  If mismatch -> vote rejected

Weighted scoring:
  Expert vote = 2 points, Citizen vote = 1 point
  Threshold = 3 of 5 weighted points
  Tie (2-2) -> auto-escalate to 5-person jury
```

### Crowdfunding State Matching

```
Category        | State Subsidy | Citizen Share
----------------|---------------|-------------
Playground      | 90%           | 10%
School          | 90%           | 10%
Roads           | 70%           | 30%
Landscaping     | 50%           | 50%
Commercial      | 0%            | 100%
```

---

## IIN Privacy Model

The citizen's IIN (Individual Identification Number) **never leaves the browser**.

```
Browser:  IIN "123456789012"
            |
            v
          SHA-256(IIN + PUBLIC_SALT)    <-- Web Crypto API, client-side only
            |
            v
          iinHash: Uint8Array[32]
            |
            v
          Sent to blockchain           <-- only the hash, never raw IIN
```

No server, API, or log ever sees the raw IIN. Uniqueness enforced on-chain via hash collision resistance.

---

## Reputation System

| Actor | Action | Score Change |
|-------|--------|-------------|
| Citizen | Voted with majority | +10 |
| Citizen | Voted against majority | -5 |
| Citizen | Missed jury deadline | -20 |
| Citizen | 3 misses | 30-day ban |
| Expert | Accurate assessment | +50 |
| Expert | >80% deviation from consensus | -100 |

**Tiers:** New (0-49) -> Active (50-149) -> Trusted (150-299) -> Guardian (300+)

---

## Demo Data

The app includes realistic demo data for all modules, based on actual Almaty infrastructure:

- **4 demo contracts** across different districts (sidewalk repair, pothole fix, electrical grid, kindergarten)
- **6 crowdfunding campaigns** (playground, road lighting, school repair, CCTV cameras)
- **8 district treasuries** with proposals and penalty history
- **3 demo roles** (Citizen, Contractor, Akimat) accessible from the login page

When the database is unavailable, all pages gracefully fall back to demo data.

---

## Deployment

```
Server: Ubuntu 24.04 (nginx + PM2)

Internet --> :80 --> nginx (reverse proxy) --> :3000 --> Next.js (PM2)
```

```bash
# On server
npm run build
pm2 restart amanat --update-env
```

---

## Team

Built for the Solana hackathon by the Amanat Protocol team (Almaty, Kazakhstan).

---

## License

This project is developed as a hackathon prototype. All rights reserved.
