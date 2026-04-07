# Test Scenarios — Amanat Protocol

## User Types
1. **Akimat** (Government Officer) — registers contracts, triggers penalties, manages treasury
2. **Contractor** — submits milestones, provides evidence, receives payments
3. **Citizen** — votes as jury, votes on treasury proposals, contributes to crowdfunding

---

## Akimat Scenarios

### A1. Contract Registration Flow
- Register contract with milestones → verify escrow = 20% of totalAmount
- Reject registration without onChainPubkey (400)
- Reject registration without contractor info (400)
- Find-or-create contractor by name
- Idempotent re-registration with same onChainPubkey returns existing (200)
- Conflict on PDA collision with different title/district (409)

### A2. Penalty Triggering
- TIME_OVERDUE: amount = totalAmount × 1% × daysOverdue
- QUALITY_REJECTED: amount = totalAmount × 10% × rejectionCount
- GHOST_SITE: amount = totalAmount × 5% × ghostCount
- Cap at 30% of totalAmount → status changes to PENALIZED
- Cap already reached → 409
- Penalty transfers to district treasury balance
- Contract penaltyAmount incremented atomically

### A3. Treasury Management
- Create spending proposal (14-day voting window)
- Treasury balance accumulated from penalties
- Proposals list with AI research reports

---

## Contractor Scenarios

### B1. Contractor Registration
- Register with name + walletAddress → defaults (rating=A, reputationScore=50)
- Reject duplicate wallet (409)
- Reject missing fields (400)

### B2. Milestone Submission
- Submit milestone → status changes PENDING→UNDER_REVIEW
- Creates JurySession with 3 jurors (COMMIT_PHASE)
- Creates WorkLog entry with evidence photos
- Cleans up stale jury sessions before creating new one
- Reject if not contract owner (403)
- Reject if milestone not in submittable status (400)
- Fail if not enough citizens for jury (503)

### B3. Payment on Milestone Acceptance
- Jury accepts → contractor receives tranche % of totalAmount
- Multiple milestones → sequential payments

---

## Citizen Scenarios

### C1. Citizen Registration
- Register with wallet + district + iinHash → tier=NEW
- Reject duplicate wallet (409)
- Reputation tiers: 0-49=NEW, 50-149=ACTIVE, 150-299=TRUSTED, 300+=GUARDIAN

### C2. Jury Commit-Reveal Voting
- Commit phase: submit SHA256(vote:salt) → stored as commitHash
- Reveal phase: submit vote + salt → server verifies hash match
- Hash mismatch → reject (400, vote manipulation)
- Vote weighting: expert=2, citizen=1
- Finalize: weightedAccept ≥ 1 → ACCEPT (milestone ACCEPTED)
- Finalize: reject majority → REJECT (milestone REJECTED)
- Escalation: tied → ESCALATED (5-person jury)
- Already committed → 409
- Not yet committed → 400 on reveal

### C3. Token Rewards (ADL)
- registration: 100 ADL
- jury_vote: 25 ADL
- jury_reveal: 25 ADL
- crowdfunding_donation: 15 ADL
- treasury_vote: 20 ADL
- contract_report: 30 ADL
- daily_login: 5 ADL
- proposal_created: 50 ADL

### C4. Treasury Proposal Voting
- Vote for/against proposal → increment votesFor/votesAgainst
- Require on-chain tx signature
- Reject duplicate vote (409)

### C5. Crowdfunding
- Contribute to campaign (min 500, max 500,000 tenge)
- Auto-promote to FUNDED when citizen target reached
- Auto-create linked contract on funding
- State match percentages by category

---

## Cross-Role Money Flow Scenarios

### D1. Full Contract Lifecycle
1. Akimat registers 100M₸ contract → 20M₸ escrow locked
2. Contractor submits milestone 1 (30% tranche)
3. Citizens vote as jury → ACCEPT
4. Contractor paid 30M₸
5. Milestone 2 submitted → jury REJECTS
6. Penalty triggered: 10% quality rejection = 10M₸
7. 10M₸ deducted from escrow → treasury balance +10M₸
8. Citizens create proposal to spend 10M₸ → vote → approved

### D2. Penalty Cascade
1. Contractor misses deadline by 10 days
2. TIME_OVERDUE: 100M × 1% × 10 = 10M₸
3. Milestone rejected
4. QUALITY_REJECTED: 100M × 10% × 1 = 10M₸
5. Total penalties: 20M₸ (of 30M₸ cap)
6. Ghost site reported
7. GHOST_SITE: 100M × 5% × 2 = 10M₸ → capped to 30M₸ total
8. Contract status → PENALIZED

### D3. Address Redistribution
- Escrow PDA → Contractor wallet (on acceptance)
- Escrow PDA → Treasury PDA (on penalty)
- Treasury PDA → Vendor wallet (on proposal execution)
- Crowdfunding escrow → Campaign contract
