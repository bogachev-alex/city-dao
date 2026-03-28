import { PrismaClient } from '../lib/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Clean existing data (order matters for FK constraints)
  await prisma.campaignContribution.deleteMany()
  await prisma.crowdfundingCampaign.deleteMany()
  await prisma.suggestionVote.deleteMany()
  await prisma.citizenSuggestion.deleteMany()
  await prisma.citizenNft.deleteMany()
  await prisma.proposalVote.deleteMany()
  await prisma.aiResearchReport.deleteMany()
  await prisma.spendingProposal.deleteMany()
  await prisma.districtTreasury.deleteMany()
  await prisma.penalty.deleteMany()
  await prisma.juryVote.deleteMany()
  await prisma.jurySession.deleteMany()
  await prisma.workLog.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.contract.deleteMany()
  await prisma.citizen.deleteMany()
  await prisma.contractor.deleteMany()

  console.log('Cleared existing data')

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const hour = 60 * 60 * 1000

  // ═══════════════════════════════════════════════
  // CONTRACTORS (8)
  // ═══════════════════════════════════════════════
  const contractors = await Promise.all([
    prisma.contractor.create({
      data: { name: 'ТОО СтройАлматы', rating: 'AA', reputationScore: 82, onTimeRate: 0.85, acceptanceRate: 0.9, updateFrequency: 0.88, gpsAccuracy: 0.95, blockerSpeed: 0.7 },
    }),
    prisma.contractor.create({
      data: { name: 'ТОО АлматыДорСтрой', rating: 'B', reputationScore: 48, onTimeRate: 0.6, acceptanceRate: 0.7, updateFrequency: 0.5, gpsAccuracy: 0.6, blockerSpeed: 0.4 },
    }),
    prisma.contractor.create({
      data: { name: 'ТОО ЭнергоСервис', rating: 'AAA', reputationScore: 95, onTimeRate: 0.95, acceptanceRate: 0.98, updateFrequency: 0.97, gpsAccuracy: 0.99, blockerSpeed: 0.9 },
    }),
    prisma.contractor.create({
      data: { name: 'ТОО МегаСтрой', rating: 'AA', reputationScore: 78, onTimeRate: 0.8, acceptanceRate: 0.88, updateFrequency: 0.82, gpsAccuracy: 0.9, blockerSpeed: 0.75 },
    }),
    prisma.contractor.create({
      data: { name: 'ТОО ГорСтройПроект', rating: 'A', reputationScore: 65, onTimeRate: 0.72, acceptanceRate: 0.78, updateFrequency: 0.65, gpsAccuracy: 0.82, blockerSpeed: 0.6 },
    }),
    prisma.contractor.create({
      data: { name: 'ТОО АлматыЖолдары', rating: 'AAA', reputationScore: 91, onTimeRate: 0.92, acceptanceRate: 0.95, updateFrequency: 0.9, gpsAccuracy: 0.96, blockerSpeed: 0.88 },
    }),
    prisma.contractor.create({
      data: { name: 'ТОО КазСтройИнвест', rating: 'C', reputationScore: 32, onTimeRate: 0.45, acceptanceRate: 0.5, updateFrequency: 0.3, gpsAccuracy: 0.4, blockerSpeed: 0.2 },
    }),
    prisma.contractor.create({
      data: { name: 'ТОО GreenBuild', rating: 'AA', reputationScore: 80, onTimeRate: 0.83, acceptanceRate: 0.87, updateFrequency: 0.85, gpsAccuracy: 0.92, blockerSpeed: 0.78 },
    }),
  ])

  console.log(`Created ${contractors.length} contractors`)

  // ═══════════════════════════════════════════════
  // CONTRACTS (10)
  // ═══════════════════════════════════════════════
  const contract1 = await prisma.contract.create({
    data: {
      title: 'Ремонт тротуара, набережная Весновки',
      description: 'Замена тротуарной плитки вдоль набережной р. Весновка на участке 500м. Текущее покрытие разрушено, создаёт опасность для пешеходов.',
      district: 'Медеуский', lat: 43.2711, lng: 76.9388,
      contractorId: contractors[0].id,
      totalAmount: 45_000_000, escrowAmount: 9_000_000, penaltyAmount: 0,
      deadline: new Date(now + 7 * day), status: 'ACTIVE', category: 'Тротуары',
      milestones: { create: [
        { description: 'Демонтаж старой плитки', deadlineDays: 3, tranchePct: 25, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Укладка основания', deadlineDays: 6, tranchePct: 50, status: 'UNDER_REVIEW', sortOrder: 2 },
        { description: 'Финальная укладка + бордюры', deadlineDays: 10, tranchePct: 25, status: 'PENDING', sortOrder: 3 },
      ]},
    },
  })

  const contract2 = await prisma.contract.create({
    data: {
      title: 'Ямочный ремонт ул. Яссауи',
      description: 'Ямочный ремонт дорожного покрытия на участке ул. Яссауи от пр. Абая до ул. Толе Би. 47 ям общей площадью 120 м².',
      district: 'Ауэзовский', lat: 43.2395, lng: 76.8742,
      contractorId: contractors[1].id,
      totalAmount: 120_000_000, escrowAmount: 24_000_000, penaltyAmount: 6_000_000,
      deadline: new Date(now - 5 * day), status: 'PENALIZED', category: 'Дороги',
      milestones: { create: [
        { description: 'Подготовительные работы', deadlineDays: 2, tranchePct: 30, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Асфальтирование', deadlineDays: 5, tranchePct: 70, status: 'OVERDUE', sortOrder: 2 },
      ]},
    },
  })

  const contract3 = await prisma.contract.create({
    data: {
      title: 'Замена электросетей мкр. Акжар',
      description: 'Полная замена воздушных линий 0.4 кВ на подземные кабели в мкр. Акжар. Протяжённость 3.2 км, обслуживает 1800 домохозяйств.',
      district: 'Наурызбайский', lat: 43.1897, lng: 76.8456,
      contractorId: contractors[2].id,
      totalAmount: 380_000_000, escrowAmount: 76_000_000, penaltyAmount: 0,
      deadline: new Date(now + 35 * day), status: 'ACTIVE', category: 'Электросети',
      milestones: { create: [
        { description: 'Проектная документация', deadlineDays: 5, tranchePct: 10, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Демонтаж старых сетей', deadlineDays: 15, tranchePct: 30, status: 'PENDING', sortOrder: 2 },
        { description: 'Прокладка новых кабелей', deadlineDays: 25, tranchePct: 40, status: 'PENDING', sortOrder: 3 },
        { description: 'Пусконаладочные работы', deadlineDays: 35, tranchePct: 20, status: 'PENDING', sortOrder: 4 },
      ]},
    },
  })

  const contract4 = await prisma.contract.create({
    data: {
      title: 'Строительство детского сада мкр. Курамыс',
      description: 'Строительство детского сада на 280 мест в мкр. Курамыс. Двухэтажное здание, 2400 м², включая игровые площадки и бассейн.',
      district: 'Бостандыкский', lat: 43.2156, lng: 76.8892,
      contractorId: contractors[3].id,
      totalAmount: 250_000_000, escrowAmount: 50_000_000, penaltyAmount: 0,
      deadline: new Date(now + 60 * day), status: 'ACTIVE', category: 'Социальные объекты',
      milestones: { create: [
        { description: 'Фундамент', deadlineDays: 20, tranchePct: 30, status: 'UNDER_REVIEW', sortOrder: 1 },
        { description: 'Стены и перекрытия', deadlineDays: 40, tranchePct: 40, status: 'PENDING', sortOrder: 2 },
        { description: 'Отделка и сдача', deadlineDays: 60, tranchePct: 30, status: 'PENDING', sortOrder: 3 },
      ]},
    },
  })

  const contract5 = await prisma.contract.create({
    data: {
      title: 'Капитальный ремонт ул. Розыбакиева (от Аль-Фараби до Сатпаева)',
      description: 'Фрезеровка и укладка нового асфальтобетона на участке 2.8 км. Замена бордюрного камня, нанесение разметки, установка 12 светофоров.',
      district: 'Бостандыкский', lat: 43.2280, lng: 76.8950,
      contractorId: contractors[5].id,
      totalAmount: 520_000_000, escrowAmount: 104_000_000, penaltyAmount: 0,
      deadline: new Date(now + 90 * day), status: 'ACTIVE', category: 'Дороги',
      milestones: { create: [
        { description: 'Демонтаж старого покрытия', deadlineDays: 15, tranchePct: 15, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Укладка основания', deadlineDays: 35, tranchePct: 25, status: 'SUBMITTED', sortOrder: 2 },
        { description: 'Верхний слой асфальтобетона', deadlineDays: 55, tranchePct: 30, status: 'PENDING', sortOrder: 3 },
        { description: 'Разметка и светофоры', deadlineDays: 75, tranchePct: 20, status: 'PENDING', sortOrder: 4 },
        { description: 'Приёмка и гарантия', deadlineDays: 90, tranchePct: 10, status: 'PENDING', sortOrder: 5 },
      ]},
    },
  })

  const contract6 = await prisma.contract.create({
    data: {
      title: 'Строительство пешеходного моста через р. Большая Алматинка',
      description: 'Металлический пешеходный мост длиной 45м, шириной 3.5м. Связывает ЖК «Алматы Тауэрс» с парком Первого Президента.',
      district: 'Медеуский', lat: 43.2345, lng: 76.9456,
      contractorId: contractors[3].id,
      totalAmount: 180_000_000, escrowAmount: 36_000_000, penaltyAmount: 0,
      deadline: new Date(now + 120 * day), status: 'ACTIVE', category: 'Инфраструктура',
      milestones: { create: [
        { description: 'Проект и экспертиза', deadlineDays: 20, tranchePct: 10, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Фундаменты опор', deadlineDays: 45, tranchePct: 25, status: 'PENDING', sortOrder: 2 },
        { description: 'Монтаж пролётного строения', deadlineDays: 80, tranchePct: 40, status: 'PENDING', sortOrder: 3 },
        { description: 'Отделка и освещение', deadlineDays: 110, tranchePct: 15, status: 'PENDING', sortOrder: 4 },
        { description: 'Сдача в эксплуатацию', deadlineDays: 120, tranchePct: 10, status: 'PENDING', sortOrder: 5 },
      ]},
    },
  })

  const contract7 = await prisma.contract.create({
    data: {
      title: 'Ремонт теплосети мкр. Жетысу-2',
      description: 'Замена 1.5 км изношенных теплотрасс в мкр. Жетысу-2. Текущие трубы 1987 года, аварии каждую зиму.',
      district: 'Ауэзовский', lat: 43.2480, lng: 76.8620,
      contractorId: contractors[6].id,
      totalAmount: 95_000_000, escrowAmount: 19_000_000, penaltyAmount: 9_500_000,
      deadline: new Date(now - 12 * day), status: 'PENALIZED', category: 'Теплосети',
      milestones: { create: [
        { description: 'Раскопка и демонтаж', deadlineDays: 10, tranchePct: 20, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Прокладка новых труб', deadlineDays: 25, tranchePct: 50, status: 'REJECTED', sortOrder: 2 },
        { description: 'Изоляция и засыпка', deadlineDays: 35, tranchePct: 20, status: 'PENDING', sortOrder: 3 },
        { description: 'Гидравлические испытания', deadlineDays: 40, tranchePct: 10, status: 'PENDING', sortOrder: 4 },
      ]},
    },
  })

  const contract8 = await prisma.contract.create({
    data: {
      title: 'Озеленение бульвара Бухар Жырау',
      description: 'Высадка 120 деревьев и 500 кустарников, укладка 8000 м² газона, установка системы автоматического полива. Участок от Байтурсынова до Ауэзова.',
      district: 'Алмалинский', lat: 43.2380, lng: 76.9210,
      contractorId: contractors[7].id,
      totalAmount: 42_000_000, escrowAmount: 8_400_000, penaltyAmount: 0,
      deadline: new Date(now + 45 * day), status: 'ACTIVE', category: 'Озеленение',
      milestones: { create: [
        { description: 'Подготовка почвы', deadlineDays: 10, tranchePct: 20, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Высадка деревьев', deadlineDays: 25, tranchePct: 35, status: 'UNDER_REVIEW', sortOrder: 2 },
        { description: 'Газон и кустарники', deadlineDays: 35, tranchePct: 25, status: 'PENDING', sortOrder: 3 },
        { description: 'Система полива', deadlineDays: 45, tranchePct: 20, status: 'PENDING', sortOrder: 4 },
      ]},
    },
  })

  const contract9 = await prisma.contract.create({
    data: {
      title: 'Реконструкция школьного стадиона №135',
      description: 'Замена асфальтового покрытия на резиновое, установка футбольных ворот, баскетбольных щитов, беговых дорожек. Школа обслуживает 1500 учеников.',
      district: 'Бостандыкский', lat: 43.2200, lng: 76.8830,
      contractorId: contractors[4].id,
      totalAmount: 68_000_000, escrowAmount: 13_600_000, penaltyAmount: 0,
      deadline: new Date(now + 50 * day), status: 'ACTIVE', category: 'Социальные объекты',
      milestones: { create: [
        { description: 'Демонтаж старого покрытия', deadlineDays: 7, tranchePct: 15, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Укладка резинового покрытия', deadlineDays: 25, tranchePct: 45, status: 'SUBMITTED', sortOrder: 2 },
        { description: 'Установка оборудования', deadlineDays: 40, tranchePct: 30, status: 'PENDING', sortOrder: 3 },
        { description: 'Разметка и сдача', deadlineDays: 50, tranchePct: 10, status: 'PENDING', sortOrder: 4 },
      ]},
    },
  })

  const contract10 = await prisma.contract.create({
    data: {
      title: 'Установка детских площадок в 5 дворах мкр. Орбита',
      description: 'Установка сертифицированных детских площадок (3-12 лет) с безопасным покрытием в 5 дворах мкр. Орбита-1 и Орбита-2.',
      district: 'Бостандыкский', lat: 43.2250, lng: 76.8970,
      contractorId: contractors[0].id,
      totalAmount: 35_000_000, escrowAmount: 7_000_000, penaltyAmount: 0,
      deadline: new Date(now + 30 * day), status: 'COMPLETED', category: 'Детские площадки',
      milestones: { create: [
        { description: 'Демонтаж старых конструкций', deadlineDays: 5, tranchePct: 15, status: 'ACCEPTED', sortOrder: 1 },
        { description: 'Укладка покрытия', deadlineDays: 15, tranchePct: 35, status: 'ACCEPTED', sortOrder: 2 },
        { description: 'Монтаж площадок', deadlineDays: 25, tranchePct: 40, status: 'ACCEPTED', sortOrder: 3 },
        { description: 'Приёмка комиссией', deadlineDays: 30, tranchePct: 10, status: 'ACCEPTED', sortOrder: 4 },
      ]},
    },
  })

  console.log('Created 10 contracts with milestones')

  // ═══════════════════════════════════════════════
  // DISTRICT TREASURIES (8) — with varied balances
  // ═══════════════════════════════════════════════
  const districtData = [
    { district: 'Алатауский',     balance: 2_800_000 },
    { district: 'Алмалинский',    balance: 12_500_000 },
    { district: 'Ауэзовский',    balance: 15_500_000 },
    { district: 'Бостандыкский',  balance: 8_200_000 },
    { district: 'Жетысуский',    balance: 4_100_000 },
    { district: 'Медеуский',     balance: 18_900_000 },
    { district: 'Наурызбайский', balance: 3_600_000 },
    { district: 'Турксибский',   balance: 5_400_000 },
  ]

  const treasuries = await Promise.all(
    districtData.map((d) =>
      prisma.districtTreasury.create({ data: { district: d.district, balance: d.balance } })
    )
  )

  console.log(`Created ${treasuries.length} district treasuries`)

  // ═══════════════════════════════════════════════
  // CITIZENS (10)
  // ═══════════════════════════════════════════════
  const citizens = await Promise.all([
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet1111111111111111111111111111111111', district: 'Медеуский',
        iinHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        reputationScore: 215, tier: 'TRUSTED', votesCast: 12, votesWithMajority: 10 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet2222222222222222222222222222222222', district: 'Ауэзовский',
        iinHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        reputationScore: 85, tier: 'ACTIVE', votesCast: 5, votesWithMajority: 4 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet3333333333333333333333333333333333', district: 'Бостандыкский',
        iinHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        reputationScore: 350, tier: 'GUARDIAN', votesCast: 28, votesWithMajority: 25 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet4444444444444444444444444444444444', district: 'Алмалинский',
        iinHash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
        reputationScore: 170, tier: 'TRUSTED', votesCast: 15, votesWithMajority: 13 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet5555555555555555555555555555555555', district: 'Наурызбайский',
        iinHash: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        reputationScore: 42, tier: 'NEW', votesCast: 2, votesWithMajority: 1 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet6666666666666666666666666666666666', district: 'Алатауский',
        iinHash: 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
        reputationScore: 310, tier: 'GUARDIAN', votesCast: 35, votesWithMajority: 31 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet7777777777777777777777777777777777', district: 'Жетысуский',
        iinHash: 'a7b7c7d7e7f7a7b7c7d7e7f7a7b7c7d7e7f7a7b7c7d7e7f7a7b7c7d7e7f7a7b7',
        reputationScore: 120, tier: 'ACTIVE', votesCast: 9, votesWithMajority: 7 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet8888888888888888888888888888888888', district: 'Турксибский',
        iinHash: 'a8b8c8d8e8f8a8b8c8d8e8f8a8b8c8d8e8f8a8b8c8d8e8f8a8b8c8d8e8f8a8b8',
        reputationScore: 65, tier: 'ACTIVE', votesCast: 4, votesWithMajority: 3 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWallet9999999999999999999999999999999999', district: 'Медеуский',
        iinHash: 'a9b9c9d9e9f9a9b9c9d9e9f9a9b9c9d9e9f9a9b9c9d9e9f9a9b9c9d9e9f9a9b9',
        reputationScore: 280, tier: 'TRUSTED', votesCast: 22, votesWithMajority: 19 },
    }),
    prisma.citizen.create({
      data: { walletAddress: 'DemoWalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', district: 'Бостандыкский',
        iinHash: 'aabbccddeeaabbccddeeaabbccddeeaabbccddeeaabbccddeeaabbccddeeaabb',
        reputationScore: 25, tier: 'NEW', votesCast: 1, votesWithMajority: 0 },
    }),
  ])

  console.log(`Created ${citizens.length} citizens`)

  // ═══════════════════════════════════════════════
  // CITIZEN NFTs (12)
  // ═══════════════════════════════════════════════
  await prisma.citizenNft.createMany({
    data: [
      { citizenId: citizens[0].id, type: 'ACTIVE_CITIZEN', metadata: { achievedAt: '2025-03-15' } },
      { citizenId: citizens[0].id, type: 'TRUSTED_CITIZEN', metadata: { achievedAt: '2025-08-22' } },
      { citizenId: citizens[2].id, type: 'ACTIVE_CITIZEN', metadata: { achievedAt: '2025-01-10' } },
      { citizenId: citizens[2].id, type: 'TRUSTED_CITIZEN', metadata: { achievedAt: '2025-05-04' } },
      { citizenId: citizens[2].id, type: 'GUARDIAN_CITIZEN', metadata: { achievedAt: '2025-11-17' } },
      { citizenId: citizens[2].id, type: 'FAIR_JUDGE', metadata: { juryVotes: 15, accuracy: 0.92 } },
      { citizenId: citizens[3].id, type: 'ACTIVE_CITIZEN', metadata: { achievedAt: '2025-06-20' } },
      { citizenId: citizens[3].id, type: 'TRUSTED_CITIZEN', metadata: { achievedAt: '2025-12-01' } },
      { citizenId: citizens[5].id, type: 'ACTIVE_CITIZEN', metadata: { achievedAt: '2025-02-28' } },
      { citizenId: citizens[5].id, type: 'GUARDIAN_CITIZEN', metadata: { achievedAt: '2025-09-14' } },
      { citizenId: citizens[5].id, type: 'DISTRICT_CHAMPION', metadata: { month: '2026-01', district: 'Алатауский' } },
      { citizenId: citizens[8].id, type: 'ACTIVE_CITIZEN', metadata: { achievedAt: '2025-07-30' } },
    ],
  })

  console.log('Created 12 citizen NFTs')

  // ═══════════════════════════════════════════════
  // JURY SESSIONS (4)
  // ═══════════════════════════════════════════════
  const milestones1 = await prisma.milestone.findMany({ where: { contractId: contract1.id }, orderBy: { sortOrder: 'asc' } })
  const milestones4 = await prisma.milestone.findMany({ where: { contractId: contract4.id }, orderBy: { sortOrder: 'asc' } })
  const milestones8 = await prisma.milestone.findMany({ where: { contractId: contract8.id }, orderBy: { sortOrder: 'asc' } })
  const milestones7 = await prisma.milestone.findMany({ where: { contractId: contract7.id }, orderBy: { sortOrder: 'asc' } })

  const jury1 = await prisma.jurySession.create({
    data: {
      contractId: contract1.id, milestoneId: milestones1[1].id,
      status: 'COMMIT_PHASE',
      commitDeadline: new Date(now + 48 * hour), revealDeadline: new Date(now + 72 * hour),
      votes: { create: [
        { citizenId: citizens[0].id, isExpert: false, weight: 1 },
        { citizenId: citizens[1].id, isExpert: false, weight: 1 },
        { citizenId: citizens[2].id, isExpert: true, weight: 2 },
      ]},
    },
  })

  const jury2 = await prisma.jurySession.create({
    data: {
      contractId: contract4.id, milestoneId: milestones4[0].id,
      status: 'REVEAL_PHASE',
      commitDeadline: new Date(now - 24 * hour), revealDeadline: new Date(now + 24 * hour),
      votes: { create: [
        { citizenId: citizens[3].id, isExpert: false, weight: 1, commitHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1' },
        { citizenId: citizens[5].id, isExpert: true, weight: 2, commitHash: 'def456abc123def456abc123def456abc123def456abc123def456abc123def4' },
        { citizenId: citizens[8].id, isExpert: false, weight: 1, commitHash: 'fff999aaa111bbb222ccc333ddd444eee555fff666aaa777bbb888ccc999ddd0' },
        { citizenId: citizens[6].id, isExpert: false, weight: 1, commitHash: '111222333444555666777888999aaabbbcccdddeeefff000111222333444555' },
      ]},
    },
  })

  const jury3 = await prisma.jurySession.create({
    data: {
      contractId: contract8.id, milestoneId: milestones8[1].id,
      status: 'COMMIT_PHASE',
      commitDeadline: new Date(now + 36 * hour), revealDeadline: new Date(now + 60 * hour),
      votes: { create: [
        { citizenId: citizens[3].id, isExpert: false, weight: 1 },
        { citizenId: citizens[0].id, isExpert: true, weight: 2 },
        { citizenId: citizens[7].id, isExpert: false, weight: 1 },
      ]},
    },
  })

  const jury4 = await prisma.jurySession.create({
    data: {
      contractId: contract7.id, milestoneId: milestones7[1].id,
      status: 'FINALIZED', result: 'REJECT', weightedAccept: 1, weightedReject: 4,
      commitDeadline: new Date(now - 5 * day), revealDeadline: new Date(now - 4 * day),
      votes: { create: [
        { citizenId: citizens[1].id, isExpert: false, weight: 1, commitHash: 'aa11bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66', revealedVote: 'REJECT', revealedSalt: 'salt1' },
        { citizenId: citizens[5].id, isExpert: true, weight: 2, commitHash: 'bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66ee77', revealedVote: 'REJECT', revealedSalt: 'salt2' },
        { citizenId: citizens[8].id, isExpert: false, weight: 1, commitHash: 'cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55dd66ee77ff88', revealedVote: 'ACCEPT', revealedSalt: 'salt3' },
      ]},
    },
  })

  console.log('Created 4 jury sessions')

  // ═══════════════════════════════════════════════
  // PENALTIES (4)
  // ═══════════════════════════════════════════════
  await prisma.penalty.createMany({
    data: [
      { contractId: contract2.id, type: 'TIME_OVERDUE', amountTenge: 6_000_000, daysOverdue: 5 },
      { contractId: contract7.id, type: 'TIME_OVERDUE', amountTenge: 5_700_000, daysOverdue: 6 },
      { contractId: contract7.id, type: 'QUALITY_REJECTED', amountTenge: 9_500_000, triggeredBy: citizens[5].id },
      { contractId: contract7.id, type: 'GHOST_SITE', amountTenge: 4_750_000, triggeredBy: citizens[1].id },
    ],
  })

  console.log('Created 4 penalties')

  // ═══════════════════════════════════════════════
  // WORK LOGS (15)
  // ═══════════════════════════════════════════════
  await prisma.workLog.createMany({
    data: [
      // Contract 1 — sidewalk
      { contractId: contract1.id, contractorId: contractors[0].id, type: 'DAILY_LOG', title: 'Демонтаж завершён на 100%', description: 'Полностью убрана старая плитка на участке 200м. Мусор вывезен.', completionPct: 100, workersOnSite: 8, equipmentCount: 2, gpsLat: 43.2711, gpsLng: 76.9388, gpsValid: true },
      { contractId: contract1.id, contractorId: contractors[0].id, type: 'MILESTONE_CLAIM', title: 'Этап 2: Укладка основания завершена', description: 'Песчано-гравийная подушка уложена, утрамбована.', completionPct: 100, workersOnSite: 12, equipmentCount: 3, gpsLat: 43.2712, gpsLng: 76.9390, gpsValid: true },
      { contractId: contract1.id, contractorId: contractors[0].id, type: 'DAILY_LOG', title: 'Доставка плитки', description: 'Завезена тротуарная плитка «Старый город» — 1200 м².', completionPct: 65, workersOnSite: 5, equipmentCount: 1, gpsLat: 43.2710, gpsLng: 76.9389, gpsValid: true },
      // Contract 2 — road repair (overdue)
      { contractId: contract2.id, contractorId: contractors[1].id, type: 'BLOCKER', title: 'Задержка поставки асфальтобетонной смеси', description: 'Поставщик задерживает на 3 дня. Ищем альтернативного.', completionPct: 45, workersOnSite: 3, equipmentCount: 1, gpsLat: 43.2395, gpsLng: 76.8742, gpsValid: true },
      { contractId: contract2.id, contractorId: contractors[1].id, type: 'DAILY_LOG', title: 'Частичное асфальтирование', description: 'Уложено 200 м² из планируемых 800 м².', completionPct: 25, workersOnSite: 6, equipmentCount: 2, gpsLat: 43.2396, gpsLng: 76.8741, gpsValid: true },
      // Contract 3 — power grid
      { contractId: contract3.id, contractorId: contractors[2].id, type: 'MILESTONE_CLAIM', title: 'Проектная документация сдана', description: 'ПСД прошла экспертизу. Получено разрешение на строительство.', completionPct: 100, workersOnSite: 2, equipmentCount: 0, gpsLat: 43.1897, gpsLng: 76.8456, gpsValid: true },
      { contractId: contract3.id, contractorId: contractors[2].id, type: 'MATERIAL_DELIVERY', title: 'Доставка кабеля ВВГнг 4x95', description: '3200 м силового кабеля доставлено на площадку. Сертификаты в комплекте.', completionPct: 10, workersOnSite: 4, equipmentCount: 1, gpsLat: 43.1898, gpsLng: 76.8455, gpsValid: true },
      // Contract 5 — major road
      { contractId: contract5.id, contractorId: contractors[5].id, type: 'DAILY_LOG', title: 'Фрезеровка старого покрытия', description: 'Снято 2800 м² старого асфальта на участке от Аль-Фараби до Жамбыла.', completionPct: 40, workersOnSite: 15, equipmentCount: 5, gpsLat: 43.2280, gpsLng: 76.8950, gpsValid: true },
      { contractId: contract5.id, contractorId: contractors[5].id, type: 'MILESTONE_CLAIM', title: 'Этап 1: Демонтаж завершён', description: 'Полностью снято старое покрытие на всём участке 2.8 км.', completionPct: 100, workersOnSite: 18, equipmentCount: 6, gpsLat: 43.2281, gpsLng: 76.8951, gpsValid: true },
      // Contract 7 — ghost site
      { contractId: contract7.id, contractorId: contractors[6].id, type: 'DAILY_LOG', title: 'Начало земляных работ', description: 'Вскрыта траншея 200м. Обнаружены неучтённые коммуникации.', completionPct: 15, workersOnSite: 4, equipmentCount: 1, gpsLat: 43.2480, gpsLng: 76.8620, gpsValid: true },
      { contractId: contract7.id, contractorId: contractors[6].id, type: 'BLOCKER', title: 'Обнаружены неучтённые газовые трубы', description: 'Необходимо согласование с Интергаз. Работы приостановлены.', completionPct: 15, workersOnSite: 0, equipmentCount: 0, gpsLat: 43.2481, gpsLng: 76.8621, gpsValid: false },
      // Contract 8 — landscaping
      { contractId: contract8.id, contractorId: contractors[7].id, type: 'DAILY_LOG', title: 'Подготовка почвы завершена', description: 'Вспашка, внесение удобрений, выравнивание на площади 8000 м².', completionPct: 100, workersOnSite: 10, equipmentCount: 3, gpsLat: 43.2380, gpsLng: 76.9210, gpsValid: true },
      { contractId: contract8.id, contractorId: contractors[7].id, type: 'MILESTONE_CLAIM', title: 'Высадка 120 деревьев', description: 'Высажены клёны (40), берёзы (40), ели (40). Все саженцы приживаемостью > 85%.', completionPct: 100, workersOnSite: 14, equipmentCount: 2, gpsLat: 43.2381, gpsLng: 76.9211, gpsValid: true },
      // Contract 9 — school stadium
      { contractId: contract9.id, contractorId: contractors[4].id, type: 'DAILY_LOG', title: 'Старое покрытие снято', description: 'Снят асфальт на площади 3200 м². Площадка выровнена.', completionPct: 100, workersOnSite: 8, equipmentCount: 2, gpsLat: 43.2200, gpsLng: 76.8830, gpsValid: true },
      { contractId: contract9.id, contractorId: contractors[4].id, type: 'MILESTONE_CLAIM', title: 'Резиновое покрытие — укладка', description: 'Начата укладка резинового покрытия Mondo. Завершено 60%.', completionPct: 60, workersOnSite: 12, equipmentCount: 3, gpsLat: 43.2201, gpsLng: 76.8831, gpsValid: true },
    ],
  })

  console.log('Created 15 work logs')

  // ═══════════════════════════════════════════════
  // SPENDING PROPOSALS (8) with votes & AI research
  // ═══════════════════════════════════════════════
  const auezovTreasury = treasuries.find(t => t.district === 'Ауэзовский')!
  const medeuskiyTreasury = treasuries.find(t => t.district === 'Медеуский')!
  const bostTreasury = treasuries.find(t => t.district === 'Бостандыкский')!
  const almTreasury = treasuries.find(t => t.district === 'Алмалинский')!

  const proposal1 = await prisma.spendingProposal.create({
    data: {
      treasuryId: auezovTreasury.id, title: 'Установка освещения во дворах мкр. 11',
      description: 'Жители жалуются на отсутствие освещения в 5 дворах. Предлагается установить 20 LED-фонарей.',
      amount: 3_500_000, category: 'Освещение', status: 'VOTING',
      votingEnds: new Date(now + 14 * day), votesFor: 23, votesAgainst: 4,
    },
  })
  const proposal2 = await prisma.spendingProposal.create({
    data: {
      treasuryId: auezovTreasury.id, title: 'Ремонт подъездов в домах по ул. Маречека',
      description: 'Побелка, замена почтовых ящиков, ремонт входных дверей в 8 подъездах. Дома 1982 года постройки.',
      amount: 5_200_000, category: 'ЖКХ', status: 'VOTING',
      votingEnds: new Date(now + 10 * day), votesFor: 15, votesAgainst: 8,
    },
  })
  const proposal3 = await prisma.spendingProposal.create({
    data: {
      treasuryId: medeuskiyTreasury.id, title: 'Велодорожка вдоль пр. Достык',
      description: 'Строительство выделенной велодорожки от ул. Курмангазы до Аль-Фараби (4.2 км). Ширина 2м, разметка, ограждения.',
      amount: 15_000_000, category: 'Инфраструктура', status: 'VOTING',
      votingEnds: new Date(now + 12 * day), votesFor: 42, votesAgainst: 11,
    },
  })
  const proposal4 = await prisma.spendingProposal.create({
    data: {
      treasuryId: medeuskiyTreasury.id, title: 'Реставрация фонтана в Парке 28 Панфиловцев',
      description: 'Восстановление фонтана 1975 года: замена насосов, облицовка, LED-подсветка.',
      amount: 8_800_000, category: 'Культура', status: 'APPROVED',
      votingEnds: new Date(now - 2 * day), votesFor: 56, votesAgainst: 3, quorumMet: true,
    },
  })
  const proposal5 = await prisma.spendingProposal.create({
    data: {
      treasuryId: bostTreasury.id, title: 'Пандусы для МГН в 12 зданиях',
      description: 'Установка пандусов, тактильных указателей и кнопок вызова для маломобильных граждан.',
      amount: 4_600_000, category: 'Доступная среда', status: 'VOTING',
      votingEnds: new Date(now + 8 * day), votesFor: 31, votesAgainst: 1,
    },
  })
  const proposal6 = await prisma.spendingProposal.create({
    data: {
      treasuryId: bostTreasury.id, title: 'Контейнерные площадки для раздельного сбора мусора',
      description: 'Оборудование 15 контейнерных площадок с разделением на пластик, стекло, бумагу и органику.',
      amount: 2_800_000, category: 'Экология', status: 'EXECUTED',
      votingEnds: new Date(now - 10 * day), votesFor: 28, votesAgainst: 5, quorumMet: true,
    },
  })
  const proposal7 = await prisma.spendingProposal.create({
    data: {
      treasuryId: almTreasury.id, title: 'Wi-Fi в парке им. Ганди',
      description: 'Установка 8 точек доступа для бесплатного Wi-Fi. Покрытие: основные аллеи и зоны отдыха.',
      amount: 1_900_000, category: 'Цифровизация', status: 'VOTING',
      votingEnds: new Date(now + 5 * day), votesFor: 19, votesAgainst: 12,
    },
  })
  const proposal8 = await prisma.spendingProposal.create({
    data: {
      treasuryId: almTreasury.id, title: 'Памятник жертвам землетрясения 1911 года',
      description: 'Установка мемориальной стелы в сквере на пересечении Гоголя и Байтурсынова.',
      amount: 6_500_000, category: 'Культура', status: 'REJECTED',
      votingEnds: new Date(now - 7 * day), votesFor: 8, votesAgainst: 24, quorumMet: true,
    },
  })

  // Fresh proposals with 0 votes — for testing voting flow
  await prisma.spendingProposal.create({
    data: {
      treasuryId: auezovTreasury.id, title: 'Строительство скейт-парка в мкр. 12',
      description: 'Молодёжь просит оборудовать скейт-парк на пустыре за ТРЦ. Проект включает рампы, рейлы и зону отдыха.',
      amount: 7_200_000, category: 'Спорт', status: 'VOTING',
      votingEnds: new Date(now + 14 * day), votesFor: 0, votesAgainst: 0,
    },
  })
  await prisma.spendingProposal.create({
    data: {
      treasuryId: auezovTreasury.id, title: 'Замена водопроводных труб на ул. Жубанова',
      description: 'Трубы 1978 года, постоянные прорывы. Замена 1.8 км трубопровода на полиэтиленовый.',
      amount: 12_500_000, category: 'ЖКХ', status: 'VOTING',
      votingEnds: new Date(now + 12 * day), votesFor: 0, votesAgainst: 0,
    },
  })
  await prisma.spendingProposal.create({
    data: {
      treasuryId: medeuskiyTreasury.id, title: 'Бесплатные курсы IT для школьников',
      description: 'Организация курсов программирования в ДК Железнодорожников. 3 группы по 20 человек, 6 месяцев.',
      amount: 3_800_000, category: 'Образование', status: 'VOTING',
      votingEnds: new Date(now + 14 * day), votesFor: 0, votesAgainst: 0,
    },
  })
  await prisma.spendingProposal.create({
    data: {
      treasuryId: bostTreasury.id, title: 'Ремонт детской площадки в мкр. Орбита-3',
      description: 'Площадка в аварийном состоянии: сломанные качели, ржавые горки. Полная замена оборудования.',
      amount: 4_100_000, category: 'Благоустройство', status: 'VOTING',
      votingEnds: new Date(now + 10 * day), votesFor: 0, votesAgainst: 0,
    },
  })
  await prisma.spendingProposal.create({
    data: {
      treasuryId: almTreasury.id, title: 'Ярмарка фермерских продуктов по выходным',
      description: 'Еженедельная ярмарка на площади перед ЦУМом. Аренда палаток, логистика, охрана.',
      amount: 2_400_000, category: 'Экономика', status: 'VOTING',
      votingEnds: new Date(now + 14 * day), votesFor: 0, votesAgainst: 0,
    },
  })

  console.log('Created 13 spending proposals (8 with votes + 5 fresh for testing)')

  // ─── AI Research Reports (4) ───
  await prisma.aiResearchReport.create({
    data: {
      proposalId: proposal1.id,
      swot: { strengths: ['Высокий спрос жителей', 'Снижение криминогенности'], weaknesses: ['Ограниченный бюджет', 'Требует согласования с КСК'], opportunities: ['Программа "Светлый двор" акимата'], threats: ['Вандализм', 'Рост цен на оборудование'] },
      costAnalysis: { proposed: 3_500_000, market_average: 3_200_000, deviation_pct: 9.4, verdict: 'reasonable' },
      similarProjects: [{ city: 'Астана', country: 'Казахстан', year: 2024, budget_usd: 8500, outcome: 'success', lessons: 'LED-фонари окупились за 2 года' }],
      riskScore: 28, riskLevel: 'LOW_RISK',
      keyConcerns: ['Бюджет на 9.4% выше рынка', 'Нет гарантии обслуживания'],
      keyPositives: ['Высокий спрос', 'Аналогичные проекты успешны'],
      sourcesUsed: ['stat.gov.kz', 'tengrinews.kz'],
    },
  })
  await prisma.aiResearchReport.create({
    data: {
      proposalId: proposal3.id,
      swot: { strengths: ['Мировой тренд', 'Снижение трафика', 'Экология'], weaknesses: ['Сезонность', 'Алматинский рельеф'], opportunities: ['Программа «Green City 2030»', 'Спонсорство Kaspi'], threats: ['Автомобилисты против', 'Кража элементов'] },
      costAnalysis: { proposed: 15_000_000, market_average: 12_000_000, deviation_pct: 25.0, verdict: 'above_market' },
      similarProjects: [{ city: 'Бишкек', country: 'Кыргызстан', year: 2023, budget_usd: 28000, outcome: 'partial', lessons: 'Зимой почти не используется — нужна защита от снега' }, { city: 'Тбилиси', country: 'Грузия', year: 2022, budget_usd: 45000, outcome: 'success', lessons: 'Интеграция с прокатом самокатов увеличила использование в 3 раза' }],
      riskScore: 52, riskLevel: 'MEDIUM_RISK',
      keyConcerns: ['Бюджет на 25% выше рынка', 'Узкие тротуары создают конфликт', 'Низкий спрос зимой'],
      keyPositives: ['Мировой тренд', 'Поддержка акимата', 'Экологический эффект'],
      sourcesUsed: ['stat.gov.kz', 'vlast.kz', 'World Bank Urban Transport Report 2024'],
    },
  })
  await prisma.aiResearchReport.create({
    data: {
      proposalId: proposal5.id,
      swot: { strengths: ['Социальная значимость', 'Требование закона'], weaknesses: ['Обслуживание зимой'], opportunities: ['Грант от ЮНИСЕФ'], threats: ['Вандализм'] },
      costAnalysis: { proposed: 4_600_000, market_average: 4_800_000, deviation_pct: -4.2, verdict: 'below_market' },
      similarProjects: [{ city: 'Астана', country: 'Казахстан', year: 2024, budget_usd: 12000, outcome: 'success', lessons: 'Обязательно предусмотреть антиобледенение' }],
      riskScore: 15, riskLevel: 'LOW_RISK',
      keyConcerns: ['Обслуживание зимой'],
      keyPositives: ['Ниже рынка на 4%', 'Законодательное требование', 'Высокий социальный импакт'],
      sourcesUsed: ['stat.gov.kz', 'unicef.org/kazakhstan'],
    },
  })
  await prisma.aiResearchReport.create({
    data: {
      proposalId: proposal7.id,
      swot: { strengths: ['Востребованность у молодёжи', 'Низкая стоимость'], weaknesses: ['Обслуживание и трафик', 'Безопасность данных'], opportunities: ['Партнёрство с Beeline/Kcell'], threats: ['Технологическое устаревание'] },
      costAnalysis: { proposed: 1_900_000, market_average: 2_100_000, deviation_pct: -9.5, verdict: 'below_market' },
      similarProjects: [{ city: 'Шымкент', country: 'Казахстан', year: 2024, budget_usd: 5000, outcome: 'success', lessons: 'Нагрузка до 500 устройств одновременно — предусмотреть пропускную способность' }],
      riskScore: 22, riskLevel: 'LOW_RISK',
      keyConcerns: ['Ежемесячная оплата трафика ~80 000 ₸'],
      keyPositives: ['Ниже рынка', 'Аналоги в КЗ успешны'],
      sourcesUsed: ['digital.gov.kz', 'forbes.kz'],
    },
  })

  console.log('Created 4 AI research reports')

  // ─── Proposal Votes (20) ───
  await prisma.proposalVote.createMany({
    data: [
      { proposalId: proposal1.id, citizenId: citizens[1].id, inFavor: true },
      { proposalId: proposal1.id, citizenId: citizens[2].id, inFavor: true },
      { proposalId: proposal1.id, citizenId: citizens[5].id, inFavor: true },
      { proposalId: proposal1.id, citizenId: citizens[7].id, inFavor: false },
      { proposalId: proposal2.id, citizenId: citizens[1].id, inFavor: true },
      { proposalId: proposal2.id, citizenId: citizens[6].id, inFavor: false },
      { proposalId: proposal3.id, citizenId: citizens[0].id, inFavor: true },
      { proposalId: proposal3.id, citizenId: citizens[8].id, inFavor: true },
      { proposalId: proposal3.id, citizenId: citizens[3].id, inFavor: true },
      { proposalId: proposal3.id, citizenId: citizens[4].id, inFavor: false },
      { proposalId: proposal5.id, citizenId: citizens[2].id, inFavor: true },
      { proposalId: proposal5.id, citizenId: citizens[9].id, inFavor: true },
      { proposalId: proposal5.id, citizenId: citizens[3].id, inFavor: true },
      { proposalId: proposal7.id, citizenId: citizens[3].id, inFavor: true },
      { proposalId: proposal7.id, citizenId: citizens[6].id, inFavor: false },
      { proposalId: proposal7.id, citizenId: citizens[7].id, inFavor: false },
      { proposalId: proposal7.id, citizenId: citizens[0].id, inFavor: true },
      { proposalId: proposal8.id, citizenId: citizens[3].id, inFavor: false },
      { proposalId: proposal8.id, citizenId: citizens[5].id, inFavor: false },
      { proposalId: proposal8.id, citizenId: citizens[0].id, inFavor: true },
    ],
  })

  console.log('Created 20 proposal votes')

  // ═══════════════════════════════════════════════
  // CITIZEN SUGGESTIONS (6)
  // ═══════════════════════════════════════════════
  const suggestion1 = await prisma.citizenSuggestion.create({
    data: {
      citizenId: citizens[0].id, title: 'Пешеходный переход у школы №56',
      problemDesc: 'Дети перебегают ул. Кабанбай Батыра без перехода. Ближайший — в 400м. Уже было 2 ДТП с участием детей.',
      suggestedFix: 'Установить регулируемый пешеходный переход с «лежачим полицейским».',
      district: 'Медеуский', lat: 43.2650, lng: 76.9320, urgency: 'CRITICAL',
      budgetMin: 2_000_000, budgetMax: 4_000_000, affectedCount: 1200,
      status: 'READY_FOR_BALLOT', upvotesNeeded: 5, upvotesReceived: 14,
    },
  })
  const suggestion2 = await prisma.citizenSuggestion.create({
    data: {
      citizenId: citizens[2].id, title: 'Парковка-перехватчик у ст. метро «Байконыр»',
      problemDesc: 'Жители паркуются на тротуарах и газонах — нет парковочных мест. У метро 500+ машин в день без мест.',
      suggestedFix: 'Организовать перехватывающую парковку на 200 мест на пустыре за метро.',
      district: 'Бостандыкский', lat: 43.2220, lng: 76.8900, urgency: 'HIGH',
      budgetMin: 8_000_000, budgetMax: 15_000_000, affectedCount: 5000,
      status: 'AI_RESEARCH', upvotesNeeded: 5, upvotesReceived: 8,
    },
  })
  const suggestion3 = await prisma.citizenSuggestion.create({
    data: {
      citizenId: citizens[3].id, title: 'Ливневая канализация на ул. Жарокова',
      problemDesc: 'При каждом дожде улицу затапливает на 30-50 см. Машины глохнут, подвалы затоплены. Проблема с 2019 года.',
      suggestedFix: 'Прочистить и расширить ливнеприёмники, проложить дополнительный коллектор.',
      district: 'Алмалинский', lat: 43.2350, lng: 76.9150, urgency: 'HIGH',
      budgetMin: 12_000_000, budgetMax: 25_000_000, affectedCount: 3000,
      status: 'PENDING_UPVOTES', upvotesNeeded: 5, upvotesReceived: 3,
    },
  })
  const suggestion4 = await prisma.citizenSuggestion.create({
    data: {
      citizenId: citizens[5].id, title: 'Площадка для выгула собак в мкр. Алгабас',
      problemDesc: 'Во дворах 12 многоэтажек живут ~200 собак. Нет ни одной оборудованной площадки. Конфликты с соседями.',
      suggestedFix: 'Огородить и оборудовать площадку 30x50м с покрытием, урнами и освещением.',
      district: 'Алатауский', lat: 43.1850, lng: 76.8400, urgency: 'MEDIUM',
      budgetMin: 1_500_000, budgetMax: 3_000_000, affectedCount: 800,
      status: 'PENDING_UPVOTES', upvotesNeeded: 10, upvotesReceived: 6,
    },
  })
  const suggestion5 = await prisma.citizenSuggestion.create({
    data: {
      citizenId: citizens[6].id, title: 'Остановочный павильон «Рынок Болашак»',
      problemDesc: 'Автобусная остановка без навеса и лавочки. 800+ человек в день ждут под дождём/снегом/солнцем.',
      suggestedFix: 'Установить современный павильон с крышей, лавочками и электронным табло.',
      district: 'Жетысуский', lat: 43.2550, lng: 76.8800, urgency: 'MEDIUM',
      budgetMin: 800_000, budgetMax: 2_000_000, affectedCount: 800,
      status: 'FUNDED', upvotesNeeded: 5, upvotesReceived: 11,
    },
  })
  const suggestion6 = await prisma.citizenSuggestion.create({
    data: {
      citizenId: citizens[8].id, title: 'Шумозащитные экраны вдоль ВОАД (мкр. Самал-2)',
      problemDesc: 'Уровень шума в квартирах до 75 дБ при норме 55 дБ. Жители не могут открывать окна.',
      suggestedFix: 'Установить шумозащитные экраны высотой 4м на участке 500м.',
      district: 'Медеуский', lat: 43.2300, lng: 76.9550, urgency: 'HIGH',
      budgetMin: 20_000_000, budgetMax: 35_000_000, affectedCount: 2500,
      status: 'ACTIVE_VOTE', upvotesNeeded: 0, upvotesReceived: 22,
    },
  })

  console.log('Created 6 citizen suggestions')

  // ─── Suggestion Votes (15) ───
  await prisma.suggestionVote.createMany({
    data: [
      { suggestionId: suggestion1.id, citizenId: citizens[1].id, isUpvote: true },
      { suggestionId: suggestion1.id, citizenId: citizens[2].id, isUpvote: true },
      { suggestionId: suggestion1.id, citizenId: citizens[5].id, isUpvote: true },
      { suggestionId: suggestion1.id, citizenId: citizens[8].id, isUpvote: true },
      { suggestionId: suggestion2.id, citizenId: citizens[0].id, isUpvote: true },
      { suggestionId: suggestion2.id, citizenId: citizens[3].id, isUpvote: true },
      { suggestionId: suggestion2.id, citizenId: citizens[9].id, isUpvote: true },
      { suggestionId: suggestion3.id, citizenId: citizens[0].id, isUpvote: true },
      { suggestionId: suggestion3.id, citizenId: citizens[6].id, isUpvote: true },
      { suggestionId: suggestion4.id, citizenId: citizens[0].id, isUpvote: true },
      { suggestionId: suggestion4.id, citizenId: citizens[2].id, isUpvote: true },
      { suggestionId: suggestion4.id, citizenId: citizens[7].id, isUpvote: false },
      { suggestionId: suggestion5.id, citizenId: citizens[0].id, isUpvote: true },
      { suggestionId: suggestion5.id, citizenId: citizens[3].id, isUpvote: true },
      { suggestionId: suggestion6.id, citizenId: citizens[0].id, isUpvote: true },
    ],
  })

  console.log('Created 15 suggestion votes')

  // ═══════════════════════════════════════════════
  // CROWDFUNDING CAMPAIGNS (6) + CONTRIBUTIONS (14)
  // ═══════════════════════════════════════════════
  const campaign1 = await prisma.crowdfundingCampaign.create({
    data: {
      title: 'Детская площадка во дворе ЖК «Алтын Булак»',
      description: 'Установка современной детской площадки с безопасным покрытием, качелями, горками и спортивным уголком для детей 3–12 лет. Старая площадка демонтирована в 2024 году из-за аварийного состояния, двор обслуживает 4 многоэтажных дома (~800 семей).',
      district: 'Ауэзовский', lat: 43.2395, lng: 76.8742, category: 'PLAYGROUND',
      targetAmount: 8_500_000, citizenTarget: 850_000, stateMatch: 7_650_000,
      citizenRaised: 623_000, donorCount: 47,
      deadline: new Date(now + 18 * day), creatorId: citizens[2].id,
    },
  })
  const campaign2 = await prisma.crowdfundingCampaign.create({
    data: {
      title: 'Ремонт тротуара по ул. Жандосова (от Манаса до Тимирязева)',
      description: 'Замена разрушенной тротуарной плитки на участке 1.2 км. Основной пешеходный маршрут к школе №135 и поликлинике №7.',
      district: 'Бостандыкский', lat: 43.2156, lng: 76.8892, category: 'ROADS',
      targetAmount: 15_000_000, citizenTarget: 4_500_000, stateMatch: 10_500_000,
      citizenRaised: 1_230_000, donorCount: 23,
      deadline: new Date(now + 34 * day), creatorId: citizens[1].id,
    },
  })
  const campaign3 = await prisma.crowdfundingCampaign.create({
    data: {
      title: 'Озеленение сквера на пересечении Абая и Байтурсынова',
      description: 'Высадка 40 деревьев и 200 кустарников, установка системы капельного полива, укладка газона 2000 м².',
      district: 'Алмалинский', lat: 43.2401, lng: 76.9198, category: 'LANDSCAPING',
      status: 'FUNDED', targetAmount: 6_000_000, citizenTarget: 3_000_000, stateMatch: 3_000_000,
      citizenRaised: 3_000_000, stateDeposited: true, donorCount: 89,
      deadline: new Date(now + 5 * day), creatorId: citizens[2].id,
    },
  })
  const campaign4 = await prisma.crowdfundingCampaign.create({
    data: {
      title: 'Ремонт спортзала школы №92 (мкр. Алгабас)',
      description: 'Капитальный ремонт спортивного зала: замена полового покрытия, обновление освещения (LED), установка вентиляции, покупка нового спортинвентаря.',
      district: 'Алатауский', lat: 43.1897, lng: 76.8456, category: 'SCHOOL',
      targetAmount: 12_000_000, citizenTarget: 1_200_000, stateMatch: 10_800_000,
      citizenRaised: 890_000, donorCount: 62,
      deadline: new Date(now + 22 * day), creatorId: citizens[0].id,
    },
  })
  const campaign5 = await prisma.crowdfundingCampaign.create({
    data: {
      title: 'Освещение пешеходной аллеи вдоль р. Есентай',
      description: 'Установка 35 LED-фонарей вдоль пешеходной аллеи протяжённостью 1.5 км. После 18:00 зимой полностью тёмный участок.',
      district: 'Медеуский', lat: 43.2311, lng: 76.9488, category: 'LANDSCAPING',
      targetAmount: 9_200_000, citizenTarget: 4_600_000, stateMatch: 4_600_000,
      citizenRaised: 2_150_000, donorCount: 34,
      deadline: new Date(now + 28 * day), creatorId: citizens[2].id,
    },
  })
  const campaign6 = await prisma.crowdfundingCampaign.create({
    data: {
      title: 'Установка камер видеонаблюдения (мкр. Орбита-2)',
      description: 'Монтаж 20 камер видеонаблюдения на ключевых точках микрорайона. Интеграция с системой «Сергек».',
      district: 'Бостандыкский', lat: 43.2256, lng: 76.8992, category: 'COMMERCIAL',
      status: 'EXPIRED', targetAmount: 4_800_000, citizenTarget: 4_800_000, stateMatch: 0,
      citizenRaised: 1_900_000, donorCount: 15,
      deadline: new Date(now - 3 * day), creatorId: citizens[1].id,
    },
  })

  await prisma.campaignContribution.createMany({
    data: [
      { campaignId: campaign1.id, citizenId: citizens[0].id, amount: 50_000, anonymous: false },
      { campaignId: campaign1.id, citizenId: citizens[1].id, amount: 15_000, anonymous: true },
      { campaignId: campaign1.id, citizenId: citizens[2].id, amount: 5_000, anonymous: false },
      { campaignId: campaign2.id, citizenId: citizens[2].id, amount: 500_000, anonymous: false },
      { campaignId: campaign2.id, citizenId: citizens[0].id, amount: 25_000, anonymous: false },
      { campaignId: campaign3.id, citizenId: citizens[0].id, amount: 100_000, anonymous: false },
      { campaignId: campaign3.id, citizenId: citizens[1].id, amount: 50_000, anonymous: false },
      { campaignId: campaign3.id, citizenId: citizens[2].id, amount: 5_000, anonymous: false },
      { campaignId: campaign4.id, citizenId: citizens[2].id, amount: 75_000, anonymous: false },
      { campaignId: campaign4.id, citizenId: citizens[0].id, amount: 30_000, anonymous: true },
      { campaignId: campaign5.id, citizenId: citizens[1].id, amount: 300_000, anonymous: false },
      { campaignId: campaign5.id, citizenId: citizens[0].id, amount: 20_000, anonymous: false },
      { campaignId: campaign6.id, citizenId: citizens[2].id, amount: 100_000, anonymous: false },
      { campaignId: campaign6.id, citizenId: citizens[0].id, amount: 50_000, anonymous: true },
    ],
  })

  console.log('Created 6 crowdfunding campaigns + 14 contributions')

  console.log('\n✓ Seed completed successfully!')
  console.log('  8 contractors, 10 contracts, 8 treasuries, 10 citizens')
  console.log('  4 jury sessions, 4 penalties, 15 work logs, 12 NFTs')
  console.log('  13 proposals, 4 AI reports, 20 proposal votes')
  console.log('  6 suggestions, 15 suggestion votes')
  console.log('  6 crowdfunding campaigns, 14 contributions')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
