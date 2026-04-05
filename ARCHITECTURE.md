# Amanat Protocol — Solution Architecture

## Overview

Amanat Protocol is a City DAO built on Solana that enables transparent, citizen-driven monitoring of government construction contracts in Almaty, Kazakhstan. It replaces manual akimat oversight with automated smart contract enforcement, provably random jury selection, and AI-powered due diligence before any vote goes live.

**Problem:** 26 of 147 Almaty city projects had delays or quality violations in 2025. Over 244 billion tenge allocated for infrastructure annually — contractors take new contracts without finishing existing ones, penalties (0.01% of contract) are not enforced effectively.

**Solution:** Put contracts on-chain, escrow 20% of funds, auto-penalize via smart contract, let citizens verify via jury, vote on treasury spending with AI research context.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CITIZENS / AKIMAT                           │
│                    (Browser — Phantom Wallet)                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS 14 FRONTEND                            │
│                   (Deployed: 74.208.191.110)                        │
│                                                                     │
│  /              Almaty Map (Leaflet) + contract pins                │
│  /contracts     Contract list + filters                             │
│  /contracts/[id] Milestone timeline + jury status                  │
│  /jury/[id]     Commit-reveal voting UI                             │
│  /treasury/[d]  District fund + AI-researched proposals            │
│  /register      IIN hashing (client-side only)                     │
│  /profile       Reputation score + history                         │
│  /admin         Register new government contracts                  │
│                                                                     │
│  API Routes:                                                        │
│  POST /api/research  → AI Research Agent (OpenAI)                  │
└──────┬───────────────────────────────────┬───────────────────────--┘
       │ Solana Web3.js + Anchor            │ OpenAI API
       │ @solana/wallet-adapter             │ gpt-4o-mini + web_search
       ▼                                   ▼
┌─────────────────┐              ┌──────────────────────────────────┐
│  SOLANA DEVNET  │              │       AI RESEARCH AGENT          │
│                 │              │                                  │
│  5 Programs     │              │  1. Web search: contractor       │
│  (Anchor/Rust)  │              │     history, violations, tax     │
│                 │              │  2. Global project benchmarks    │
│  + Switchboard  │              │  3. Local district context       │
│    VRF          │              │  4. Budget reasonableness check  │
│                 │              │  5. SWOT + Risk score 0-100      │
│  + IPFS/Arweave │              │                                  │
│    (evidence)   │              │  Output: JSON report shown to    │
│                 │              │  citizens BEFORE they vote       │
└─────────────────┘              └──────────────────────────────────┘
```

---

## Smart Contract Architecture (Solana / Anchor)

### 5 On-Chain Programs

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTRACT REGISTRY PROGRAM                        │
│                                                                     │
│  GovernmentContract account:                                        │
│  ├── id, contractor (Pubkey), title, district                       │
│  ├── total_amount (lamports), escrow_amount (20%)                   │
│  ├── deadline (unix timestamp)                                      │
│  ├── milestones: Vec<Milestone>                                     │
│  └── status: Active | Completed | Disputed | Penalized | Terminated│
│                                                                     │
│  Instructions:                                                      │
│  register_contract → submit_milestone → trigger_penalty             │
│  release_tranche → terminate_contract                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │ milestone submitted
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     JURY MECHANISM PROGRAM                          │
│                                                                     │
│  JurySession account:                                               │
│  ├── jurors: Vec<Pubkey>  (3 citizens + 1 expert)                   │
│  ├── vrf_result: [u8; 32]  ← Switchboard VRF proof                 │
│  ├── commit_deadline (+48h), reveal_deadline (+24h)                │
│  └── votes: Vec<JuryVote>                                           │
│                                                                     │
│  Commit-Reveal Flow:                                                │
│  Phase 1 (48h): juror submits hash(vote + random_salt) on-chain    │
│  Phase 2 (24h): juror reveals vote + salt; contract verifies hash  │
│                                                                     │
│  Weighted voting: expert = 2 pts, citizen = 1 pt, threshold = 3    │
│  2-2 tie → auto-escalate to 5-person jury                          │
│                                                                     │
│  Instructions:                                                      │
│  init_session → select_jury_vrf → commit_vote → reveal_vote        │
│  replace_inactive → finalize_session → escalate_dispute            │
└────────────────────────────┬────────────────────────────────────────┘
                             │ finalize_session result
                    ┌────────┴────────┐
                    │                 │
                    ▼ REJECTED        ▼ ACCEPTED
┌───────────────────────────┐   ┌────────────────────────────────────┐
│    PENALTY ENGINE         │   │      CONTRACT REGISTRY             │
│                           │   │      release_tranche()             │
│  Rules:                   │   │      → contractor paid             │
│  1% per day overdue       │   └────────────────────────────────────┘
│  10% per failed milestone │
│  5% per ghost-site report │
│  Cap: 30% of total        │
│                           │
│  execute_penalty()        │
│  → deduct from escrow     │
│  → transfer_to_treasury() │
└────────────────┬──────────┘
                 │ penalty funds
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DISTRICT TREASURY PROGRAM                         │
│                                                                     │
│  DistrictTreasury account:                                          │
│  ├── district: String                                               │
│  ├── balance: u64                                                   │
│  └── proposals: Vec<SpendingProposal>                               │
│                                                                     │
│  Voting: SBT holders only, 1 vote per citizen (equal rights)       │
│  execute_proposal() auto-fires on quorum + majority                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   CITIZEN REGISTRY PROGRAM                          │
│                                                                     │
│  CitizenProfile (Soulbound Token — non-transferable):               │
│  ├── wallet: Pubkey                                                  │
│  ├── district: String                                               │
│  ├── iin_hash: [u8; 32]  ← hash(IIN + salt), computed client-side  │
│  ├── reputation_score: i64  (starts 100, min 0)                    │
│  ├── votes_cast, votes_with_majority                                │
│  └── is_eligible: bool                                              │
│                                                                     │
│  Reputation deltas:                                                 │
│  +10 voted with majority  -5 voted against  -20 missed jury duty   │
│  Ban: score < 0 three times → 30-day exclusion                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## AI Research Agent — Module 6

```
Proposal submitted (title, amount, category, district)
        │
        ▼
POST /api/research  (Next.js API Route)
        │
        ▼
OpenAI gpt-4o-mini
+ web_search_preview tool (autonomous internet search)
        │
        ├── STEP 1: Contractor due diligence
        │   Searches: goszakup.gov.kz, kgd.gov.kz, stat.gov.kz, sud.kz
        │   Finds: past contracts, violations, court cases, tax debt
        │
        ├── STEP 2: Global benchmarks
        │   Searches: worldbank.org, adb.org, urban planning databases
        │   Finds: similar projects worldwide, costs, outcomes, lessons
        │
        ├── STEP 3: Budget reasonableness
        │   Calculates: deviation from market average (±%)
        │   Verdict: reasonable | inflated | underfunded
        │
        └── STEP 4: SWOT + Risk Score
            Output:
            ┌──────────────┬──────────────┐
            │  Strengths   │  Weaknesses  │
            ├──────────────┼──────────────┤
            │ Opportunities│   Threats    │
            └──────────────┴──────────────┘
            Risk score: 0–100
            Recommendation: LOW_RISK | MEDIUM_RISK | HIGH_RISK
        │
        ▼
Citizens read full AI report → vote За / Против
(vote with data, not just a project title)
```

---

## Jury Selection — Switchboard VRF

```
Milestone submitted by contractor
        │
        ▼
initialize_jury_session(contract_id, milestone_id)
        │
        ▼
select_jury_vrf()
├── Request randomness from Switchboard VRF oracle
├── VRF result: [u8; 32] — cryptographically unpredictable
├── Seed into citizen registry of same district
├── Select 3 residents + 1 expert (by rotation)
└── Announced 24h before inspection (prevents pre-arrangement)

Why VRF matters:
├── Contractor cannot predict or bribe jurors in advance
├── Proof is on-chain — anyone can verify selection was random
└── If juror times out → auto-replace with next random citizen
```

---

## IIN Privacy Model

```
Browser only — IIN never leaves the client

User types IIN: "123456789012"
        │
        ▼
crypto.subtle.digest('SHA-256', encode(IIN + PUBLIC_SALT))
        │
        ▼
iinHash: Uint8Array[32]
        │
        ▼
Only iinHash sent to blockchain → register_citizen(district, iinHash)

IIN field cleared from React state immediately after hashing.
No server, API, or log ever sees the raw IIN.
Uniqueness enforced on-chain via hash collision resistance.
```

---

## Penalty Formula

```
time_penalty    = total_amount × days_overdue / 100   (1% per day)
quality_penalty = total_amount × rejection_count × 10 / 100  (10% per rejection)
ghost_penalty   = total_amount × ghost_count × 5 / 100       (5% per ghost site)

total_penalty   = min(time + quality + ghost, total_amount × 30 / 100)
                                                              ↑ capped at 30%

Example — 45,000,000 ₸ contract, 5 days overdue, 1 rejected milestone:
  time_penalty    = 45,000,000 × 5 / 100  = 2,250,000 ₸
  quality_penalty = 45,000,000 × 10 / 100 = 4,500,000 ₸
  total           = 6,750,000 ₸  (15% of contract)

Funds flow: escrow account → District Treasury → citizen spending vote
```

---

## Frontend Component Map

```
app/
├── page.tsx                   Landing — AlmatyMap + stats banner
├── contracts/
│   ├── page.tsx               Contract list with filters
│   └── [id]/page.tsx          Contract detail
├── jury/[session_id]/page.tsx Commit-reveal voting
├── treasury/[district]/page.tsx District treasury + proposals
├── profile/page.tsx           Reputation + history
├── register/page.tsx          Citizen registration (IIN hashing)
├── admin/page.tsx             Akimat contract registration
└── api/research/route.ts      AI Research Agent endpoint

components/
├── AlmatyMap.tsx              Leaflet map, SSR-disabled, custom SVG pins
├── ContractCard.tsx           Title, deadline countdown, penalty, progress
├── MilestoneTracker.tsx       Vertical timeline with status icons
├── JuryVoting.tsx             Commit/reveal phases, localStorage salt
├── PenaltyCalculator.tsx      Live penalty counter with setInterval
├── TreasuryDashboard.tsx      Balance, proposals, vote bars, tx history
├── ProposalResearch.tsx       AI SWOT panel (slide-in drawer)
├── CitizenRegistration.tsx    IIN field + client-side SHA-256 preview
└── Navbar.tsx                 Fixed top nav + wallet connect
```

---

## Deployment Architecture

```
Server: 74.208.191.110 (Ubuntu 24.04, 7.7GB RAM, 232GB disk)

                        ┌────────────┐
Internet ──── :80 ────▶ │   nginx    │
                        │ (reverse   │
                        │  proxy)    │
                        └─────┬──────┘
                              │ proxy_pass
                              ▼
                        ┌────────────┐
                        │    PM2     │  (process manager, auto-restart)
                        │            │
                        │  amanat    │ ── :3000 ── Next.js 14
                        └────────────┘

Environment:
  OPENAI_API_KEY  set in /var/www/amanat/.env.local
  Node.js 20, npm 10

Deploy flow (local → server):
  npm run build  →  rsync (excludes node_modules, .next)
  →  npm install on server  →  npm run build on server
  →  pm2 restart amanat --update-env
```

---

## Data Flow — Full Contract Lifecycle

```
1. AKIMAT registers contract on-chain
   register_contract(title, amount, deadline, milestones)
   → 20% escrowed immediately

2. CONTRACTOR works, submits milestone
   submit_milestone_completion(contract_id, milestone_id, ipfs_photo_hash)
   → Photos stored on IPFS, hash on-chain

3. JURY SELECTED (VRF)
   3 district residents + 1 expert, selected 24h before
   → Push notification sent to jurors

4. JURY VOTES (Commit-Reveal, 48h + 24h)
   Commit: hash(vote + salt) submitted on-chain
   Reveal: vote + salt revealed, contract verifies

5a. ACCEPTED (weighted score ≥ 3)
    release_tranche(contractor) → milestone % paid out

5b. REJECTED (weighted score < 3)
    execute_penalty() → penalty deducted from escrow
    → transferred to District Treasury

6. PENALTY TRIGGER (anyone can call)
   check_deadline(contract_id) → if overdue, auto-penalize
   → 1% per day deducted from escrow

7. TREASURY SPENDING
   Penalty funds accumulate in DistrictTreasury
   Citizens submit SpendingProposal
   AI Agent researches proposal (SWOT, budget analysis)
   Citizens vote with full context
   execute_proposal() on quorum + majority
```

---

## Reputation System

```
Participant     Action                          Delta
─────────────────────────────────────────────────────
Citizen         Voted with majority             +10
Citizen         Voted against majority          -5
Citizen         Missed jury deadline (48h)      -20
Citizen         3 misses                        30-day ban

Expert          Accurate assessment             +50
Expert          Deviation from consensus >80%   -100
Expert          3 violations                    permanent ban + stake slashed

Reputation determines:
├── Eligibility for jury pool (score ≥ 0)
├── Reward multipliers (higher score → higher rewards)
└── NFT tier: Bronze (100–199) / Silver (200–499) / Gold (500+)
```

---

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| Contractor bribes juror | VRF selection unpredictable; selected 24h before; anonymous commit-reveal |
| Juror collusion | Votes hidden until reveal; reputation stake; no peer pressure |
| IIN privacy leak | Client-side SHA-256 only; never stored or transmitted raw |
| Corrupt expert | 500,000 ₸ stake at registration; slashed on >80% consensus deviation |
| Ghost site (no workers) | Any citizen can submit ghost report; verified by jury; 5% penalty |
| Sybil attacks | SBT non-transferable; one IIN hash per wallet |
| Smart contract bugs | Anchor framework; escrow model limits blast radius to 20% |
| 2-2 jury tie | Auto-escalate to 5-person jury or trusted arbitrator (NGO/DUMK) |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Blockchain | Solana (devnet) |
| Smart contracts | Rust + Anchor framework |
| Randomness | Switchboard VRF |
| Evidence storage | IPFS / Arweave |
| Frontend | Next.js 14, TypeScript, App Router |
| Styling | Tailwind CSS |
| Maps | Leaflet + react-leaflet |
| Wallet | Phantom / Backpack (wallet-adapter) |
| AI Agent | OpenAI gpt-4o-mini + web_search_preview |
| Server | Ubuntu 24.04, nginx, PM2, Node.js 20 |
| Repo | https://github.com/bogachev-alex/city-dao |
| Live demo | http://74.208.191.110 |
