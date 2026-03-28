import { PrismaClient } from '../lib/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Clean existing data
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

  // ─── Contractors ───
  const contractors = await Promise.all([
    prisma.contractor.create({
      data: {
        name: 'ТОО СтройАлматы',
        rating: 'AA',
        reputationScore: 82,
        onTimeRate: 0.85,
        acceptanceRate: 0.9,
      },
    }),
    prisma.contractor.create({
      data: {
        name: 'ТОО АлматыДорСтрой',
        rating: 'B',
        reputationScore: 48,
        onTimeRate: 0.6,
        acceptanceRate: 0.7,
      },
    }),
    prisma.contractor.create({
      data: {
        name: 'ТОО ЭнергоСервис',
        rating: 'AAA',
        reputationScore: 95,
        onTimeRate: 0.95,
        acceptanceRate: 0.98,
      },
    }),
    prisma.contractor.create({
      data: {
        name: 'ТОО МегаСтрой',
        rating: 'AA',
        reputationScore: 78,
        onTimeRate: 0.8,
        acceptanceRate: 0.88,
      },
    }),
  ])

  console.log(`Created ${contractors.length} contractors`)

  // ─── Contracts (from DEMO_CONTRACTS) ───
  const now = Date.now()

  const contract1 = await prisma.contract.create({
    data: {
      title: 'Ремонт тротуара, набережная Весновки',
      district: 'Медеуский',
      lat: 43.2711,
      lng: 76.9388,
      contractorId: contractors[0].id,
      totalAmount: 45_000_000,
      escrowAmount: 9_000_000,
      penaltyAmount: 0,
      deadline: new Date(now + 7 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      category: 'Тротуары',
      milestones: {
        create: [
          { description: 'Демонтаж старой плитки', deadlineDays: 3, tranchePct: 25, status: 'ACCEPTED', sortOrder: 1 },
          { description: 'Укладка основания', deadlineDays: 6, tranchePct: 50, status: 'UNDER_REVIEW', sortOrder: 2 },
          { description: 'Финальная укладка + бордюры', deadlineDays: 10, tranchePct: 25, status: 'PENDING', sortOrder: 3 },
        ],
      },
    },
  })

  const contract2 = await prisma.contract.create({
    data: {
      title: 'Ямочный ремонт ул. Яссауи',
      district: 'Ауэзовский',
      lat: 43.2395,
      lng: 76.8742,
      contractorId: contractors[1].id,
      totalAmount: 120_000_000,
      escrowAmount: 24_000_000,
      penaltyAmount: 6_000_000,
      deadline: new Date(now - 5 * 24 * 60 * 60 * 1000),
      status: 'PENALIZED',
      category: 'Дороги',
      milestones: {
        create: [
          { description: 'Подготовительные работы', deadlineDays: 2, tranchePct: 30, status: 'ACCEPTED', sortOrder: 1 },
          { description: 'Асфальтирование', deadlineDays: 5, tranchePct: 70, status: 'OVERDUE', sortOrder: 2 },
        ],
      },
    },
  })

  const contract3 = await prisma.contract.create({
    data: {
      title: 'Замена электросетей мкр. Акжар',
      district: 'Наурызбайский',
      lat: 43.1897,
      lng: 76.8456,
      contractorId: contractors[2].id,
      totalAmount: 380_000_000,
      escrowAmount: 76_000_000,
      penaltyAmount: 0,
      deadline: new Date(now + 35 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      category: 'Электросети',
      milestones: {
        create: [
          { description: 'Проектная документация', deadlineDays: 5, tranchePct: 10, status: 'ACCEPTED', sortOrder: 1 },
          { description: 'Демонтаж старых сетей', deadlineDays: 15, tranchePct: 30, status: 'PENDING', sortOrder: 2 },
          { description: 'Прокладка новых кабелей', deadlineDays: 25, tranchePct: 40, status: 'PENDING', sortOrder: 3 },
          { description: 'Пусконаладочные работы', deadlineDays: 35, tranchePct: 20, status: 'PENDING', sortOrder: 4 },
        ],
      },
    },
  })

  const contract4 = await prisma.contract.create({
    data: {
      title: 'Строительство детского сада мкр. Курамыс',
      district: 'Бостандыкский',
      lat: 43.2156,
      lng: 76.8892,
      contractorId: contractors[3].id,
      totalAmount: 250_000_000,
      escrowAmount: 50_000_000,
      penaltyAmount: 0,
      deadline: new Date(now + 60 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      category: 'Социальные объекты',
      milestones: {
        create: [
          { description: 'Фундамент', deadlineDays: 20, tranchePct: 30, status: 'UNDER_REVIEW', sortOrder: 1 },
          { description: 'Стены и перекрытия', deadlineDays: 40, tranchePct: 40, status: 'PENDING', sortOrder: 2 },
          { description: 'Отделка и сдача', deadlineDays: 60, tranchePct: 30, status: 'PENDING', sortOrder: 3 },
        ],
      },
    },
  })

  console.log(`Created 4 contracts with milestones`)

  // ─── District Treasuries ───
  const districts = [
    'Алатауский', 'Алмалинский', 'Ауэзовский', 'Бостандыкский',
    'Жетысуский', 'Медеуский', 'Наурызбайский', 'Турксибский',
  ]

  const treasuries = await Promise.all(
    districts.map((district) =>
      prisma.districtTreasury.create({
        data: { district, balance: 0 },
      })
    )
  )

  // Add penalty funds to Auezov treasury (from contract2)
  await prisma.districtTreasury.update({
    where: { district: 'Ауэзовский' },
    data: { balance: 6_000_000 },
  })

  console.log(`Created ${treasuries.length} district treasuries`)

  // ─── Sample citizens ───
  const citizens = await Promise.all([
    prisma.citizen.create({
      data: {
        walletAddress: 'DemoWallet1111111111111111111111111111111111',
        district: 'Медеуский',
        iinHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        reputationScore: 215,
        tier: 'TRUSTED',
        votesCast: 12,
        votesWithMajority: 10,
      },
    }),
    prisma.citizen.create({
      data: {
        walletAddress: 'DemoWallet2222222222222222222222222222222222',
        district: 'Ауэзовский',
        iinHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        reputationScore: 85,
        tier: 'ACTIVE',
        votesCast: 5,
        votesWithMajority: 4,
      },
    }),
    prisma.citizen.create({
      data: {
        walletAddress: 'DemoWallet3333333333333333333333333333333333',
        district: 'Бостандыкский',
        iinHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        reputationScore: 350,
        tier: 'GUARDIAN',
        votesCast: 28,
        votesWithMajority: 25,
      },
    }),
  ])

  console.log(`Created ${citizens.length} demo citizens`)

  // ─── Sample jury session (for contract1, milestone2) ───
  const milestones1 = await prisma.milestone.findMany({
    where: { contractId: contract1.id },
    orderBy: { sortOrder: 'asc' },
  })

  const jurySession = await prisma.jurySession.create({
    data: {
      contractId: contract1.id,
      milestoneId: milestones1[1].id, // "Укладка основания"
      status: 'COMMIT_PHASE',
      commitDeadline: new Date(now + 48 * 60 * 60 * 1000),
      revealDeadline: new Date(now + 72 * 60 * 60 * 1000),
      votes: {
        create: [
          { citizenId: citizens[0].id, isExpert: false, weight: 1 },
          { citizenId: citizens[1].id, isExpert: false, weight: 1 },
          { citizenId: citizens[2].id, isExpert: true, weight: 2 },
        ],
      },
    },
  })

  console.log(`Created jury session: ${jurySession.id}`)

  // ─── Sample penalty ───
  await prisma.penalty.create({
    data: {
      contractId: contract2.id,
      type: 'TIME_OVERDUE',
      amountTenge: 6_000_000,
      daysOverdue: 5,
    },
  })

  console.log('Created sample penalty')

  // ─── Sample work logs ───
  await prisma.workLog.createMany({
    data: [
      {
        contractId: contract1.id,
        contractorId: contractors[0].id,
        type: 'DAILY_LOG',
        title: 'Демонтаж завершён на 100%',
        description: 'Полностью убрана старая плитка на участке 200м. Мусор вывезен.',
        completionPct: 100,
        workersOnSite: 8,
        equipmentCount: 2,
        gpsLat: 43.2711,
        gpsLng: 76.9388,
        gpsValid: true,
      },
      {
        contractId: contract1.id,
        contractorId: contractors[0].id,
        type: 'MILESTONE_CLAIM',
        title: 'Этап 2: Укладка основания завершена',
        description: 'Песчано-гравийная подушка уложена, утрамбована. Готово к финальной укладке.',
        completionPct: 100,
        workersOnSite: 12,
        equipmentCount: 3,
        gpsLat: 43.2712,
        gpsLng: 76.9390,
        gpsValid: true,
      },
      {
        contractId: contract2.id,
        contractorId: contractors[1].id,
        type: 'BLOCKER',
        title: 'Задержка поставки асфальтобетонной смеси',
        description: 'Поставщик задерживает на 3 дня. Ищем альтернативного.',
        completionPct: 45,
        workersOnSite: 3,
        equipmentCount: 1,
        gpsLat: 43.2395,
        gpsLng: 76.8742,
        gpsValid: true,
      },
    ],
  })

  console.log('Created sample work logs')

  // ─── Spending proposal with AI research ───
  const auezovTreasury = await prisma.districtTreasury.findUnique({
    where: { district: 'Ауэзовский' },
  })

  if (auezovTreasury) {
    const proposal = await prisma.spendingProposal.create({
      data: {
        treasuryId: auezovTreasury.id,
        title: 'Установка освещения во дворах мкр. 11',
        description: 'Жители жалуются на отсутствие освещения в 5 дворах. Предлагается установить 20 LED-фонарей.',
        amount: 3_500_000,
        category: 'Освещение',
        status: 'VOTING',
        votingEnds: new Date(now + 14 * 24 * 60 * 60 * 1000),
        votesFor: 23,
        votesAgainst: 4,
      },
    })

    await prisma.aiResearchReport.create({
      data: {
        proposalId: proposal.id,
        swot: {
          strengths: ['Высокий спрос жителей', 'Снижение криминогенности'],
          weaknesses: ['Ограниченный бюджет', 'Требует согласования с КСК'],
          opportunities: ['Программа "Светлый двор" акимата'],
          threats: ['Вандализм', 'Рост цен на оборудование'],
        },
        costAnalysis: {
          proposed: 3_500_000,
          market_average: 3_200_000,
          deviation_pct: 9.4,
          verdict: 'reasonable',
        },
        similarProjects: [
          {
            city: 'Астана',
            country: 'Казахстан',
            year: 2024,
            budget_usd: 8500,
            outcome: 'success',
            lessons: 'LED-фонари окупились за 2 года за счёт экономии электричества',
          },
        ],
        riskScore: 28,
        riskLevel: 'LOW_RISK',
        keyConcerns: ['Бюджет на 9.4% выше рынка', 'Нет гарантии обслуживания'],
        keyPositives: ['Высокий спрос', 'Аналогичные проекты успешны'],
        sourcesUsed: ['stat.gov.kz', 'tengrinews.kz'],
      },
    })

    console.log('Created spending proposal with AI research report')
  }

  console.log('\nSeed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
