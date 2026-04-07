# Straita — Test Report

**Дата:** 2026-03-29
**Ветка:** `test/e2e-coverage`
**Стэк:** Vitest 4.1 + @testing-library/react + jsdom
**Результат:** 69 тестов, 8 файлов, все проходят

---

## Исправленные баги (найдены тестами)

### 1. normalizeContract делил totalAmount на 1000
- **Файл:** `lib/contracts.ts:143`
- **Было:** `Number(c.totalAmount) / 1000` — суммы контрактов отображались в 1000 раз меньше
- **Стало:** `Number(c.totalAmount)` — полная сумма в тенге
- **Тест:** `contracts.test.ts` → "preserves full tenge amount without division"

### 2. TIER_MAP: TRUSTED и GUARDIAN маппились одинаково → 'Gold'
- **Файл:** `lib/crowdfunding.ts:275`
- **Было:** `TRUSTED: 'Gold', GUARDIAN: 'Gold'` — два разных уровня неразличимы
- **Стало:** `TRUSTED: 'Gold', GUARDIAN: 'Platinum'`
- **Тест:** `crowdfunding.test.ts` → "TRUSTED and GUARDIAN map to DIFFERENT tiers"

### 3. Jury reveal НЕ проверял hash — можно было менять голос
- **Файл:** `app/api/jury/route.ts:76`
- **Было:** `// TODO: verify hash` — клиент мог отправить любой vote при reveal
- **Стало:** SHA-256 верификация `hash(vote:salt) === commitHash`, 400 при несовпадении
- **Тест:** `jury.test.ts` → "REJECTS reveal when hash does NOT match (vote manipulation)"

### 4. Profile tier thresholds не совпадали с API computeTier
- **Файл:** `app/[locale]/profile/page.tsx:20-25`
- **Было:** NEW:0-100, ACTIVE:100-200, TRUSTED:200-350, GUARDIAN:350+
- **Стало:** NEW:0-50, ACTIVE:50-150, TRUSTED:150-300, GUARDIAN:300+ (совпадает с API)
- **Тест:** `citizens.test.ts` → "score + delta → tier" (параметризованный тест на все границы)

### 5. Валюта показывалась как "USDC" вместо "₸"
- **Файлы:** ContractCard, admin page, contract detail, PenaltyCalculator
- **Было:** `formatAmount(amount) USDC`
- **Стало:** `formatAmount(amount) ₸`

### 6. Frontend-backend hash format совпадение
- **Тест:** `crypto.test.ts` → "uses vote:salt format matching backend verification"
- Проверяет что `hashVoteCommitment('accept', salt)` в браузере даёт тот же hash что `createHash('sha256').update('accept:salt')` на сервере.

---

## Покрытие тестами

| Файл | Тестов | Категория | Что проверяется |
|------|--------|-----------|-----------------|
| `contracts.test.ts` | 10 | Unit | normalizeContract (без /1000!), pin colors, deadlines, milestones |
| `crowdfunding.test.ts` | 14 | Unit | citizen/state split (5 категорий), donor tiers, TIER_MAP уникальность |
| `crypto.test.ts` | 8 | Unit | hashIIN, generateSalt, hashVoteCommitment, frontend-backend hash match |
| `pda.test.ts` | 9 | Unit | Все 11 PDA-функций, детерминизм, уникальность, anti-double-voting |
| `citizens.test.ts` | 8 | API | CRUD, дупликаты, computeTier на всех границах |
| `crowdfunding.test.ts` | 7 | API | Create с split, contribute валидация (500-500k), expired campaign rejection |
| `treasury.test.ts` | 4 | API | GET/PATCH, duplicate vote 409 |
| `jury.test.ts` | 9 | API | Commit-reveal: commit, non-juror 403, already-committed 409, hash verification, hash mismatch 400 |

---

## Как запускать

```bash
npm test          # Один прогон (69 тестов, ~1.3 сек)
npm run test:watch  # Watch mode
```

CI: тесты запускаются в GitHub Actions перед билдом.
