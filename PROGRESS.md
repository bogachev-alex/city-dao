# Backend & Web3 Implementation Progress

**Branch:** `feature/backend`
**PRD:** `AMANAT_PRD.md` (8 модулей, дедлайн 7 апреля 2026)

---

## 1. Prisma + PostgreSQL (индексер/кеш)

### [x] Schema — 16 моделей, 12 enum
| Модуль PRD | Модели |
|---|---|
| 1. Contract Registry | `Contract`, `Milestone` |
| 2. Citizen Registry | `Citizen` (SBT, reputation, tiers) |
| 3. Jury Mechanism | `JurySession`, `JuryVote` (commit-reveal) |
| 4. Penalty Engine | `Penalty` (time/quality/ghost types) |
| 5. District Treasury | `DistrictTreasury`, `SpendingProposal`, `ProposalVote` |
| 6. AI Research Agent | `AiResearchReport` (SWOT, risk score) |
| 7. Contractor Work Log | `Contractor`, `WorkLog` (daily/milestone/blocker) |
| 8. Citizen Suggestions | `CitizenSuggestion`, `SuggestionVote` |
| NFTs | `CitizenNft` (7 types) |

### [x] Seed script — `prisma/seed.ts`
4 подрядчика, 4 контракта, 8 казначейств, 3 гражданина, jury session, пенальти, work logs, AI report

### [x] API Routes — 9 endpoints
| Route | Methods | Описание |
|---|---|---|
| `/api/contracts` | GET, POST | Список + фильтры, регистрация |
| `/api/contracts/[id]` | GET, PATCH | Детали + milestones/jury/penalties/logs |
| `/api/citizens` | GET, POST, PATCH | Wallet lookup, регистрация, reputation |
| `/api/jury` | GET, POST, PATCH | Сессии, commit, reveal + auto-finalize |
| `/api/treasury` | GET | Все казначейства |
| `/api/treasury/[district]` | GET, POST | Район + proposals |
| `/api/work-logs` | GET, POST | Лог работ с GPS-валидацией (500м) |
| `/api/suggestions` | GET, POST | Предложения, проверка tier |
| `/api/contractors` | GET | Лидерборд |

### [ ] Подключение фронтенда к API (замена DEMO_CONTRACTS)

---

## 2. Anchor Smart Contracts (Solana / Rust)

### [x] Workspace — `Anchor.toml` + `Cargo.toml`
5 программ в `programs/`, workspace с release-оптимизациями

### [x] 5 программ написаны:

| Программа | Файл | Инструкции | Аккаунты |
|---|---|---|---|
| **citizen_registry** | `programs/citizen_registry/src/lib.rs` | `register_citizen`, `update_reputation`, `record_missed_jury`, `check_eligibility` | `CitizenProfile` (PDA: `citizen + wallet`) |
| **contract_registry** | `programs/contract_registry/src/lib.rs` | `register_contract`, `submit_milestone`, `accept_milestone`, `reject_milestone`, `check_deadline`, `terminate_contract` | `GovernmentContract` (PDA: `contract + authority + title`), Escrow PDA |
| **jury_mechanism** | `programs/jury_mechanism/src/lib.rs` | `init_session`, `select_jury`, `commit_vote`, `reveal_vote`, `start_reveal_phase`, `finalize_session` | `JurySession` (PDA: `jury + contract + milestone`), `JuryVoteAccount` (PDA: `vote + session + juror`) |
| **penalty_engine** | `programs/penalty_engine/src/lib.rs` | `execute_penalty` | `PenaltyRecord` (PDA: `penalty + contract + timestamp`) |
| **district_treasury** | `programs/district_treasury/src/lib.rs` | `init_treasury`, `deposit`, `create_proposal`, `vote_on_proposal`, `execute_proposal` | `DistrictTreasuryAccount`, `SpendingProposalAccount`, `VoterBallot` |

### Ключевые фичи в контрактах:
- **Escrow:** 20% от суммы контракта лочится при регистрации
- **Commit-Reveal:** SHA-256(vote + salt) → двухфазное голосование
- **Auto-penalty:** `check_deadline()` — любой гражданин может вызвать
- **Penalty cap:** 30% от суммы контракта
- **Tie-breaker:** 2-2 → автоэскалация к 5 присяжным
- **Ban system:** 3 пропуска jury duty → 30 дней бан
- **Quorum + majority:** Для исполнения treasury proposal

---

## 3. Web3 Layer (Frontend ↔ Solana)

### [x] Пакеты установлены:
`@solana/web3.js`, `@solana/wallet-adapter-*`, `@coral-xyz/anchor`

### [x] Провайдер + хуки:
| Файл | Назначение |
|---|---|
| `lib/web3/provider.tsx` | `SolanaProvider` — Connection + Wallet + Modal |
| `lib/web3/useAnchorProgram.ts` | `useAnchorProvider()`, `useProgram()` — Anchor Program hooks |
| `lib/web3/pda.ts` | PDA деривация для всех 5 программ |
| `lib/web3/constants.ts` | Program IDs, RPC URL, seeds, districts |
| `components/SolanaProviderWrapper.tsx` | Client-only wrapper для layout.tsx |

### [x] Navbar — Phantom wallet connect
Заменён mock-кнопка на `WalletMultiButton` из `@solana/wallet-adapter-react-ui`

### [x] CSS — стили wallet adapter под dark theme

---

## 4. Тулчейн (установлен)

| Компонент | Версия | Статус |
|---|---|---|
| Rust | 1.94.1 (stable-msvc) | installed |
| Solana CLI | 3.1.11 (Agave) | installed, devnet |
| Anchor CLI | 0.32.1 | installed |
| VS Build Tools | MSVC 14.44 | installed |
| Developer Mode | enabled | for symlinks |

### [x] `anchor build` — все 5 программ скомпилированы!

| Программа | .so | IDL |
|---|---|---|
| citizen_registry | 214 KB | target/idl/citizen_registry.json |
| contract_registry | 254 KB | target/idl/contract_registry.json |
| district_treasury | 259 KB | target/idl/district_treasury.json |
| jury_mechanism | 255 KB | target/idl/jury_mechanism.json |
| penalty_engine | 205 KB | target/idl/penalty_engine.json |

### Program IDs (keypairs generated):
```
contract_registry: GGtDAGtHMRd6BxDGyoSXXVfevDDjhj8XnTnAYftnGmBU
citizen_registry:  Ckghe1MiBJEX9DLHHMqtXaczXQyCNHrimq9GixjFiyE6
jury_mechanism:    F2wfSrALyt3qqUrV7pP2XqCm6mLN8rPLQ5UDTXz3C68w
penalty_engine:    DBMPFjrt7aaiCh4s56wrsge2uMcu8zn9Wb7o6LE28E7z
district_treasury: 44SAVcK4BVrKQvX1WAgHPCcov1vBnNpMWhFbVJCziGwy
```

---

## 5. БД подключена + Голосование через API

### [x] PostgreSQL подключена
- БД `amanat` на localhost, миграция применена
- Seed: 4 подрядчика, 4 контракта, 8 казначейств, 3 гражданина, jury session, penalties, work logs, AI report
- `prisma-client-js` с `@prisma/adapter-pg` (driver adapter)
- `normalizeContract()` — правильный маппинг UPPER_CASE enum → lowercase frontend types

### [x] Фронтенд подключён к API
- AlmatyMap, Contracts list, Contract detail — данные из PostgreSQL
- Fallback на DEMO_CONTRACTS если БД недоступна

### [x] Jury Voting → PostgreSQL
- JuryVoting компонент: загрузка сессии из API, commit hash → БД, reveal → БД
- Автоматический finalize при полном reveal (weighted accept/reject)
- Результаты: взвешенные голоса (expert x2), эскалация при tie

### [x] Treasury Voting → PostgreSQL
- `PATCH /api/treasury/[district]` — голосование за/против proposal
- Optimistic UI update + сохранение в БД
- Защита от повторного голосования (unique constraint)
- Баланс и proposals из БД

---

## Следующие шаги:
- [ ] `anchor deploy` на devnet (нужен airdrop SOL: faucet.solana.com)
- [ ] On-chain voting: wallet подпись → Solana tx + БД sync
- [ ] Интеграция AI Research Agent на Claude (Anthropic SDK)
- [ ] Anchor тесты (`tests/amanat.test.ts`)
