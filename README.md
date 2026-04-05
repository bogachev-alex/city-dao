<p align="center">
  <img src="https://img.shields.io/badge/Solana-Devnet-blueviolet?logo=solana" alt="Solana Devnet" />
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/Anchor-0.32-blue" alt="Anchor" />
  <img src="https://img.shields.io/badge/License-Hackathon_Prototype-orange" alt="License" />
</p>

<h1 align="center"><a href="https://74-208-191-110.nip.io:4443/" target"_blank">Amanat Protocol</a></h1>
Dev server: https://74-208-191-110.nip.io:4443/
<p align="center">
  <b>City DAO для прозрачного мониторинга государственных строительных контрактов Алматы</b>
</p>

---

## Проблема

В 2025 году из **147 муниципальных строительных проектов** Алматы нарушения сроков и качества [выявлены на **26 объектах**](https://informburo.kz/novosti/ploxo-stroiat-i-sryvaiut-sroki-skolko-podriadcikov-narusitelei-i-problemnyx-obieektov-v-almaty). Бюджет города на инфраструктуру превышает **244 млрд тенге** в год, но:

- Подрядчики [получают авансы и исчезают](https://bes.media/news/poluchayut-avans-i-ischezayut-pochemu-ubirayut-predoplatu-podryadchikam-obyasnil-akim-satibaldi/), срывают сроки, передают заказы третьим лицам
- Текущий штраф — [0,01% от суммы контракта](https://informburo.kz/special/darxan-satybaldy-podriadciki-sryvaiushhie-sroki-budut-otstraneny-ot-goszakazov-v-almaty) — не работает как сдерживающий фактор
- 110 компаний привлечены к ответственности, 6 лишены лицензий, [26 переданы в правоохранительные органы](https://tengrinews.kz/kazakhstan_news/podryadchikov-v-almatyi-massovo-lishayut-litsenziy-584421/)
- У граждан нет инструмента для контроля расходования бюджета

## Решение

Amanat Protocol переносит государственные контракты на блокчейн Solana. **20% суммы контракта** замораживается в смарт-контракте (escrow). Штрафы начисляются автоматически. Граждане проверяют качество работ через **случайное жюри**, а расходы районной казны одобряются голосованием с **AI-аналитикой**.

---

## Как это работает

```mermaid
flowchart TD
    A["Акимат регистрирует контракт"] -->|20% в escrow| B["Смарт-контракт на Solana"]
    B --> C["Подрядчик выполняет этап"]
    C -->|фото + отчёт| D["Случайное жюри (VRF)"]
    D -->|3 гражданина + 1 эксперт| E{"Commit-Reveal голосование"}
    E -->|Принято| F["Транш подрядчику"]
    E -->|Отклонено| G["Штраф в казну района"]
    G --> H["Граждане голосуют за расходы"]
    H -->|AI-анализ перед голосованием| I["Проект реализован"]

    style A fill:#10b981,color:#fff
    style B fill:#6366f1,color:#fff
    style D fill:#f59e0b,color:#fff
    style G fill:#ef4444,color:#fff
    style H fill:#3b82f6,color:#fff
```

---

## Архитектура

### Общая схема

```mermaid
graph TB
    subgraph "Пользователи"
        CIT["Гражданин"]
        CON["Подрядчик"]
        AKI["Акимат"]
    end

    subgraph "Frontend — Next.js 14"
        MAP["Карта Алматы<br/>с контрактами"]
        CF["Краудфандинг"]
        JURY["Жюри<br/>Commit-Reveal"]
        TREAS["Казна районов<br/>+ AI анализ"]
        ADMIN["Регистрация<br/>контрактов"]
    end

    subgraph "Solana Devnet"
        CR["Contract Registry"]
        CITIZ["Citizen Registry<br/>(Soulbound Token)"]
        JM["Jury Mechanism"]
        PE["Penalty Engine"]
        DT["District Treasury"]
        CFP["Crowdfunding<br/>Program"]
        ADL["ADL Token<br/>(SPL)"]
    end

    subgraph "Данные"
        DB["PostgreSQL<br/>(Prisma)"]
        AI["OpenAI<br/>gpt-4o-mini<br/>+ web search"]
        GZ["goszakup.gov.kz<br/>(реестр закупок)"]
    end

    CIT --> MAP & CF & JURY & TREAS
    CON --> MAP & ADMIN
    AKI --> ADMIN & TREAS

    MAP --> CR
    CF --> CFP
    JURY --> JM
    TREAS --> DT & AI
    ADMIN --> CR

    CR --> DB
    CFP --> DB
    DT --> DB
    TREAS --> GZ

    PE -.->|CPI| DT
    JM -.->|результат| CR
    CR -.->|штраф| PE

    style CR fill:#6366f1,color:#fff
    style JM fill:#f59e0b,color:#fff
    style PE fill:#ef4444,color:#fff
    style DT fill:#3b82f6,color:#fff
    style CFP fill:#10b981,color:#fff
    style ADL fill:#8b5cf6,color:#fff
    style AI fill:#ec4899,color:#fff
```

### 6 смарт-контрактов (Anchor / Rust)

```mermaid
graph LR
    G["Crowdfunding"] -->|"финансирование<br/>проекта"| A
    A["Contract<br/>Registry"] -->|"этап сдан"| B["Jury<br/>Mechanism"]
    F["Citizen<br/>Registry"] -->|"пул жюри<br/>(SBT + репутация)"| B
    B -->|"принят"| E["Транш<br/>подрядчику"]
    B -->|"отклонён"| C["Penalty<br/>Engine"]
    A -->|"просрочка"| C
    C -->|"штраф (CPI)"| D["District<br/>Treasury"]

    style A fill:#6366f1,color:#fff
    style B fill:#f59e0b,color:#fff
    style C fill:#ef4444,color:#fff
    style D fill:#3b82f6,color:#fff
    style G fill:#10b981,color:#fff
    style F fill:#8b5cf6,color:#fff
```

> **Все 6 блоков — отдельные Anchor-программы на Solana.** Стрелки — CPI-вызовы (cross-program invocations) или потоки данных между ними. Contract Registry — центральный: в него приходят деньги из Crowdfunding, из него уходят этапы в Jury, а штрафы через Penalty Engine попадают в District Treasury.

| Программа | Назначение | Ключевые инструкции |
|-----------|-----------|---------------------|
| **Contract Registry** | Регистрация контрактов, escrow 20%, milestones | `register_contract`, `submit_milestone`, `accept_milestone`, `check_deadline` |
| **Citizen Registry** | Soulbound-токен гражданина, репутация | `register_citizen`, `update_reputation` |
| **Jury Mechanism** | Случайный отбор жюри (VRF), commit-reveal | `init_session`, `select_jury`, `commit_vote`, `reveal_vote`, `finalize` |
| **Penalty Engine** | Автоштрафы: 1%/день, 10%/брак, 5%/заброс | `execute_penalty` (CPI в District Treasury) |
| **District Treasury** | Казна района, предложения граждан | `create_proposal`, `vote_on_proposal`, `execute_proposal` |
| **Crowdfunding** | Гражданское софинансирование, гос. субсидия | `init_campaign`, `contribute`, `match_funds`, `refund_all` |

---

## Ключевые механизмы

### Штрафная формула

```mermaid
graph LR
    A["Просрочка<br/>1% в день"] --> D["Итого"]
    B["Брак этапа<br/>10% за отклонение"] --> D
    C["Заброшенный объект<br/>5% за жалобу"] --> D
    D -->|"max 30%<br/>от суммы контракта"| E["В казну района"]

    style A fill:#f59e0b,color:#fff
    style B fill:#ef4444,color:#fff
    style C fill:#991b1b,color:#fff
    style E fill:#3b82f6,color:#fff
```

> **Пример:** Контракт 45 000 000 ₸, просрочка 5 дней + 1 отклонённый этап = штраф 6 750 000 ₸ (15%)

### Commit-Reveal голосование

```mermaid
sequenceDiagram
    participant J as Жюри (4 человека)
    participant SC as Смарт-контракт
    participant V as VRF (Switchboard)

    V->>SC: Случайный отбор 3 граждан + 1 эксперт
    Note over V,SC: За 24ч до проверки (нельзя подкупить)

    rect rgb(59, 130, 246, 0.1)
        Note over J,SC: Фаза 1: Commit (48 часов)
        J->>SC: hash(голос + случайная_соль)
        Note right of SC: Голос скрыт от других
    end

    rect rgb(16, 185, 129, 0.1)
        Note over J,SC: Фаза 2: Reveal (24 часа)
        J->>SC: голос + соль
        SC->>SC: Проверка SHA-256
    end

    SC->>SC: Подсчёт (эксперт = 2 балла, гражданин = 1)
    alt Принято (>= 3 из 5)
        SC-->>J: Транш подрядчику
    else Отклонено
        SC-->>J: Штраф в казну
    end
```

### Краудфандинг с государственным софинансированием

| Категория | Гос. субсидия | Доля граждан |
|-----------|:------------:|:------------:|
| Детские площадки | 90% | 10% |
| Школы | 90% | 10% |
| Дороги | 70% | 30% |
| Озеленение | 50% | 50% |
| Коммерческие | 0% | 100% |

> Деньги граждан и государства хранятся в escrow смарт-контракте до завершения проекта. Если цель не достигнута к дедлайну — автоматический возврат.

---

## Приватность: хеширование ИИН

```mermaid
flowchart LR
    A["ИИН: 123456789012"] -->|"Только в браузере"| B["SHA-256(ИИН + соль)"]
    B -->|"Хеш"| C["Блокчейн"]


    style A fill:#ef4444,color:#fff
    style B fill:#f59e0b,color:#fff
    style C fill:#10b981,color:#fff
```

ИИН гражданина обрабатывается **исключительно на клиенте** через Web Crypto API. На блокчейн отправляется только SHA-256 хеш. Ни один сервер, API или лог никогда не видит исходный ИИН.

---

## Репутация граждан

```mermaid
graph LR
    A["Новичок<br/>0-49"] -->|"+10 за голос<br/>с большинством"| B["Активный<br/>50-149"]
    B --> C["Доверенный<br/>150-299"]
    C --> D["Хранитель<br/>300+"]

    A -.->|"-20 за пропуск<br/>жюри"| E["Бан 30 дней"]

    style A fill:#9ca3af,color:#fff
    style B fill:#3b82f6,color:#fff
    style C fill:#8b5cf6,color:#fff
    style D fill:#f59e0b,color:#fff
    style E fill:#ef4444,color:#fff
```

| Действие | Изменение |
|----------|:---------:|
| Голос совпал с большинством | **+10** |
| Голос против большинства | **-5** |
| Пропуск жюри | **-20** |
| 3 пропуска подряд | **Бан 30 дней** |

---

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Блокчейн | Solana (devnet), Rust, Anchor 0.32 |
| Токен | SPL Token (ADL — Adal Coin) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Карты | Leaflet + react-leaflet |
| Кошелёк | Phantom (wallet-adapter) |
| База данных | PostgreSQL + Prisma ORM |
| AI-агент | OpenAI gpt-4o-mini + web_search |
| i18n | Русский + Казахский (next-intl) |
| Тесты | Vitest (unit) + Playwright (e2e) |

---

## Быстрый старт

```bash
npm install        # Установка зависимостей
npm run dev        # Запуск dev-сервера (порт 3000)
npm test           # Юнит-тесты (Vitest)
npm run test:e2e   # E2E-тесты (Playwright)
npm run build      # Production-сборка
```

Приложение работает **без базы данных и кошелька** в demo-режиме с тестовыми данными. Для полной функциональности:

```bash
# .env.local
DATABASE_URL=postgresql://...          # PostgreSQL
OPENAI_API_KEY=sk-...                  # AI-анализ
NEXT_PUBLIC_DATA_SOURCE=onchain        # Чтение из Solana
```

---

## Демо-данные

Приложение включает реалистичные тестовые данные по Алматы:

- **22 контракта** (4 demo + 18 из реестра Госзакупок РК)
- **6 краудфандинг-кампаний** (детские площадки, дороги, освещение, школы)
- **8 районных казн** с предложениями по расходам и историей штрафов
- **3 роли** для тестирования: Гражданин, Подрядчик, Акимат (доступны на странице входа)

---

## Структура проекта

```
city-dao/
├── programs/          # 6 Solana смарт-контрактов (Rust/Anchor)
├── app/               # Next.js 14 App Router (страницы + API)
├── components/        # React-компоненты (карта, карточки, калькулятор штрафов)
├── lib/               # Бизнес-логика, Web3-хуки, типы данных
├── prisma/            # Схема БД (15+ моделей) + seed-данные
├── tests/             # E2E-тесты (Playwright)
├── __tests__/         # Юнит и API тесты (Vitest)
└── scripts/           # Деплой, seed, IDL-верификация
```

---

## Команда

Разработано командой **no fomo** (Алматы, Казахстан) для хакатона Decentrathon.

---

<p align="center">
  <sub>Hackathon prototype. All rights reserved.</sub>
</p>
