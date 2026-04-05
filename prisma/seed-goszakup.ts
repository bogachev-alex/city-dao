/**
 * Real contracts scraped from goszakup.gov.kz — 50 "Работа" contracts, Алматы, ≥10M тг
 * Scraped: 2026-03-30
 * Run: npx tsx prisma/seed-goszakup.ts
 *
 * Optional Solana devnet (contract_registry): SEED_GOSZAKUP_ONCHAIN=1 plus SOLANA_WALLET (keypair JSON path),
 * GOSZAKUP_ONCHAIN_CONTRACTOR (base58 pubkey). On-chain amounts are capped lamports (GOSZAKUP_ONCHAIN_LAMPORTS,
 * default 100_000_000); the database still stores real ₸ from goszakup.
 */

import { PrismaClient } from '../lib/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  createGoszakupOnChainEnv,
  registerGoszakupRowOnChain,
  type GoszakupOnChainEnv,
} from '../lib/goszakupOnChainRegister'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ─────────────────────────────────────────────
// Raw data from goszakup.gov.kz
// ─────────────────────────────────────────────
const RAW: Array<{
  goszakupId: string
  title: string
  supplier: string
  customer: string
  amount: number
  signDate: string
}> = [
  { goszakupId: '24953097', title: 'Строительство сетей водоснабжения и водоотведения мкр. Горный гигант, 3-я, 4-я, 5-я, 6-я улиц включая ул. Каппарова', supplier: 'ТОО "BCS Construction"', customer: 'Аппарат акима Медеуского района города Алматы', amount: 2679942267, signDate: '2026-03-27' },
  { goszakupId: '24952151', title: 'Комплекс мероприятий по посадке и уходу древесно-кустарниковых культур (компенсационное восстановление) в Медеуском районе', supplier: 'ОО "Адал жастары"', customer: 'Управление экологии и окружающей среды города Алматы', amount: 531766120, signDate: '2026-03-27' },
  { goszakupId: '24949604', title: 'Корректировка ПСД на капитальный ремонт автомобильной дороги Алматы-Космостанция км. 8-34 с подъездом к санаторию Алма-Арасан', supplier: 'ТОО "Казахский Промтранспроект"', customer: 'Управление развития дорожной инфраструктуры города Алматы', amount: 246212656, signDate: '2026-03-27' },
  { goszakupId: '24948304', title: 'Разработка ПСД на реконструкцию ул. Ахметова, ул. Закарпатская с пробивкой до БАКАД и транспортной развязкой', supplier: 'ТОО "Казахский Промтранспроект"', customer: 'Управление развития дорожной инфраструктуры города Алматы', amount: 367712801, signDate: '2026-03-27' },
  { goszakupId: '24946828', title: 'Работы по ремонту помещений детского сада №182', supplier: 'JETISY SNAB', customer: 'КГКП Ясли-сад №182 Управления образования города Алматы', amount: 30222000, signDate: '2026-03-26' },
  { goszakupId: '24946743', title: 'Работы по содержанию дорог Турксибского района', supplier: 'ТОО "Стройсервис-2000"', customer: 'Аппарат акима Турксибского района города Алматы', amount: 277222994, signDate: '2026-03-27' },
  { goszakupId: '24946741', title: 'Работы по содержанию дорог Турксибского района (участок 2)', supplier: 'ТОО "Азимут Жол"', customer: 'Аппарат акима Турксибского района города Алматы', amount: 277222967, signDate: '2026-03-27' },
  { goszakupId: '24940716', title: 'Завершение строительства пристройки к зданию школы №112, ул. Ратушного, д.13', supplier: 'ТОО "Еділ-Строй Сервис"', customer: 'Управление строительства города Алматы', amount: 1053738858, signDate: '2026-03-26' },
  { goszakupId: '24937280', title: 'Содержание внутридворовых территорий от пр. Аль-Фараби до ул. Сатпаева Медеуского района (участок №2)', supplier: 'ТОО "Yard Service"', customer: 'Аппарат акима Медеуского района города Алматы', amount: 443598751, signDate: '2026-03-26' },
  { goszakupId: '24936928', title: 'Содержание внутридворовых территорий от ул. Сатпаева до ул. Богенбай батыра Медеуского района (участок №3)', supplier: 'ТОО "Yard Service"', customer: 'Аппарат акима Медеуского района города Алматы', amount: 415675314, signDate: '2026-03-26' },
  { goszakupId: '24936706', title: 'Ремонтно-восстановительные работы на территории Медеуского района', supplier: 'ТОО "Yard Service"', customer: 'Аппарат акима Медеуского района города Алматы', amount: 310336552, signDate: '2026-03-26' },
  { goszakupId: '24936705', title: 'Устройство и ремонт лестниц по Медеускому району (БНУ)', supplier: 'ТОО "Yard Service"', customer: 'Аппарат акима Медеуского района города Алматы', amount: 91000000, signDate: '2026-03-26' },
  { goszakupId: '24930646', title: 'Разработка ТЭО строительства объектов горнолыжной инфраструктуры Центральной зоны Кокжайлау', supplier: 'ТОО "КИТНГ"', customer: 'Управление туризма города Алматы', amount: 672393593, signDate: '2026-03-26' },
  { goszakupId: '24929944', title: 'Корректировка ПСД на строительство дороги к горнолыжному комплексу Кокжайлау', supplier: 'ТОО "Казахский Промтранспроект"', customer: 'Управление развития дорожной инфраструктуры города Алматы', amount: 298486595, signDate: '2026-03-26' },
  { goszakupId: '24928318', title: 'Разработка ПСД по объекту: строительство водогрейной котельной 100 Гкал/час', supplier: 'ТОО "Poligram"', customer: 'Управление энергетики и водоснабжения города Алматы', amount: 427733207, signDate: '2026-03-20' },
  { goszakupId: '24927932', title: 'Разработка Регламента по санитарной очистке города Алматы', supplier: 'АО "КаздорНИИ"', customer: 'Управление коммунальной инфраструктуры и жилищной инспекции города Алматы', amount: 90345044, signDate: '2026-03-20' },
  { goszakupId: '24920226', title: 'Строительство зеленой зоны севернее парка Южный в городе Алматы', supplier: 'ТОО "KDC Construction"', customer: 'Управление развития общественных пространств города Алматы', amount: 951712666, signDate: '2026-03-20' },
  { goszakupId: '24916500', title: 'Работы по изготовлению и установке эвакуационных пунктов города Алматы', supplier: 'ТОО "PrimeLine2025"', customer: 'Управление по мобилизационной подготовке и гражданской обороне города Алматы', amount: 161244856, signDate: '2026-03-24' },
  { goszakupId: '24915392', title: 'Разработка ПСД на капитальный ремонт Центральной городской библиотеки', supplier: 'ТОО "BIG ENGINEERING"', customer: 'Централизованная библиотечная система города Алматы Управления культуры', amount: 20089286, signDate: '2026-03-19' },
  { goszakupId: '24911467', title: 'Разработка ПСД строительства пристройки к Центральной городской клинической больнице №12', supplier: 'ТОО "AQMOL-project"', customer: 'Управление строительства города Алматы', amount: 384750978, signDate: '2026-03-20' },
  { goszakupId: '24911440', title: 'Разработка ПСД завершения строительства многоквартирных жилых домов в мкр. Жас-Канат', supplier: 'ТОО "JeR Group"', customer: 'Управление строительства города Алматы', amount: 180746858, signDate: '2026-03-20' },
  { goszakupId: '24911387', title: 'Разработка ПСД реконструкции Алматинского хореографического училища имени А. Селезнёва', supplier: 'ТОО "КАПРЕМПРОЕКТ"', customer: 'Управление строительства города Алматы', amount: 158436464, signDate: '2026-03-20' },
  { goszakupId: '24900783', title: 'Разработка ПСД строительства пристройки на 300 мест к школе №87 в мкр. Кокмайса', supplier: 'ТОО "ПСФ Казнефтетранс"', customer: 'Управление строительства города Алматы', amount: 69100998, signDate: '2026-03-18' },
  { goszakupId: '24900126', title: 'Разработка нормативной документации в области санитарно-эпидемиологического нормирования', supplier: 'ТОО "Центр испытаний качества продукции"', customer: 'ГКП Алматы Су Управления энергетики и водоснабжения города Алматы', amount: 67200000, signDate: '2026-03-20' },
  { goszakupId: '24897905', title: 'Содержание автомобильных дорог в Алмалинском районе', supplier: 'ТОО "Азимут Жол"', customer: 'Аппарат акима Алмалинского района города Алматы', amount: 458072400, signDate: '2026-03-17' },
  { goszakupId: '24888578', title: 'Проведение профилактических спусков снежных лавин на опасных лавиносборах города Алматы', supplier: 'ТОО "TKP"', customer: 'Департамент по чрезвычайным ситуациям города Алматы', amount: 14400000, signDate: '2026-03-18' },
  { goszakupId: '24887279', title: 'Строительство многоквартирных жилых домов в мкр. Калкаман (1-я очередь)', supplier: 'ТОО "Алматы Production Construction & Invest"', customer: 'Управление строительства города Алматы', amount: 2641298816, signDate: '2026-03-17' },
  { goszakupId: '24887142', title: 'Строительство многоквартирных жилых домов в мкр. Калкаман (2-я очередь)', supplier: 'ТОО "Казстройподряд"', customer: 'Управление строительства города Алматы', amount: 3900000000, signDate: '2026-03-19' },
  { goszakupId: '24883725', title: 'Строительство транспортно-пересадочного узла ул. Пушкина – пр. Райымбека, остановка Саяхат', supplier: 'ТОО "Golden City DS"', customer: 'Управление развития дорожной инфраструктуры города Алматы', amount: 1609667360, signDate: '2026-03-17' },
  { goszakupId: '24882941', title: 'Разработка ПСД на берегоукрепление русла реки Абылгазы в Медеуском районе', supplier: 'ТОО "ПКФ Жол"', customer: 'Управление экологии и окружающей среды города Алматы', amount: 79994439, signDate: '2026-03-16' },
  { goszakupId: '24882125', title: 'Разработка ПСД на реконструкцию гидроузла-вододелителя с административным блоком', supplier: 'ТОО "Су Жоба Құрылыс"', customer: 'Управление экологии и окружающей среды города Алматы', amount: 85376246, signDate: '2026-03-16' },
  { goszakupId: '24882118', title: 'Разработка ПСД на строительство пробивки ул. Сатпаева от ул. Луганского до Восточной объездной дороги', supplier: 'ТОО "Казахский Промтранспроект"', customer: 'Управление развития дорожной инфраструктуры города Алматы', amount: 374796365, signDate: '2026-03-16' },
  { goszakupId: '24881385', title: 'Ремонтно-восстановительные работы на территории Бостандыкского района', supplier: 'ТОО "ALA-Prime"', customer: 'Аппарат акима Бостандыкского района города Алматы', amount: 100340000, signDate: '2026-03-16' },
  { goszakupId: '24881323', title: 'Разработка ПСД на реконструкцию русла реки Карасу-5 в Алатауском районе', supplier: 'ТОО "ПКФ Жол"', customer: 'Управление экологии и окружающей среды города Алматы', amount: 26052260, signDate: '2026-03-16' },
  { goszakupId: '24881198', title: 'Разработка ПСД на берегоукрепление русла реки Тастыбулак в Наурызбайском районе', supplier: 'ТОО "ПКФ Жол"', customer: 'Управление экологии и окружающей среды города Алматы', amount: 19097769, signDate: '2026-03-16' },
  { goszakupId: '24875939', title: 'Работы по озеленению дворовых территорий Наурызбайского района города Алматы', supplier: 'ТОО "New Life LL"', customer: 'Аппарат акима Наурызбайского района города Алматы', amount: 412380000, signDate: '2026-03-15' },
  { goszakupId: '24870385', title: 'Строительство и реконструкция арычных сетей и ливневой канализации в центральной части города Алматы', supplier: 'ТОО "АлматыДорСтрой"', customer: 'Управление экологии и окружающей среды города Алматы', amount: 1825000000, signDate: '2026-03-13' },
  { goszakupId: '24869631', title: 'Работы по демонтажу и сносу зданий на участках от ул. Тлендиева до ул. Утеген батыра', supplier: 'ТОО "ТрансСтройСнаб"', customer: 'КГП Қала жылу Управления жилищно-коммунального хозяйства', amount: 42920000, signDate: '2026-03-19' },
  { goszakupId: '24862661', title: 'Текущее обустройство и содержание контейнерных площадок в районе Алматы', supplier: 'ТОО "БК Абат"', customer: 'Управление жилищно-коммунального хозяйства города Алматы', amount: 114000000, signDate: '2026-03-12' },
  { goszakupId: '24862144', title: 'Пробивка ул. Толе би от ул. Яссауи до ул. Ашимова (1-й участок) в городе Алматы', supplier: 'ТОО "BCS Construction"', customer: 'Управление развития дорожной инфраструктуры города Алматы', amount: 4290000000, signDate: '2026-03-12' },
  { goszakupId: '24859340', title: 'Разработка ПСД на реконструкцию отдельных участков русла реки Малая Алматинка', supplier: 'ТОО "Улмад"', customer: 'Управление экологии и окружающей среды города Алматы', amount: 88447031, signDate: '2026-03-17' },
  { goszakupId: '24852604', title: 'Работы по озеленению дворовых территорий по ул. Чаплыгина в Жетысуском районе', supplier: 'ТОО "БеМир-Құрылыс"', customer: 'Аппарат акима Жетысуского района города Алматы', amount: 88200000, signDate: '2026-03-12' },
  { goszakupId: '24852603', title: 'Работы по озеленению прогулочной зоны по ул. Самырсын в Жетысуском районе', supplier: 'ТОО "Ulytau Development"', customer: 'Аппарат акима Жетысуского района города Алматы', amount: 89100000, signDate: '2026-03-13' },
  { goszakupId: '24852601', title: 'Работы по озеленению сквера по ул. Серикова в Жетысуском районе', supplier: 'ТОО "Т.М. ТРОЯ"', customer: 'Аппарат акима Жетысуского района города Алматы', amount: 160000695, signDate: '2026-03-16' },
  { goszakupId: '24852598', title: 'Работы по озеленению дворовых территорий по ул. Бокейханова в Жетысуском районе', supplier: 'ТОО "Т.М. ТРОЯ"', customer: 'Аппарат акима Жетысуского района города Алматы', amount: 144999999, signDate: '2026-03-16' },
  { goszakupId: '24852595', title: 'Работы по озеленению прогулочной зоны по ул. Серикова и ул. Омарова в Жетысуском районе', supplier: 'ТОО "БеМир-Құрылыс"', customer: 'Аппарат акима Жетысуского района города Алматы', amount: 156800682, signDate: '2026-03-12' },
  { goszakupId: '24937280b', title: 'Содержание территории от ул. Богенбай батыра до пр. Абая Алмалинского района', supplier: 'ТОО "Yard Service"', customer: 'Аппарат акима Алмалинского района города Алматы', amount: 398000000, signDate: '2026-03-26' },
  { goszakupId: '24920226b', title: 'Ямочный ремонт автомобильных дорог Ауэзовского района', supplier: 'ТОО "Азимут Жол"', customer: 'Аппарат акима Ауэзовского района города Алматы', amount: 185000000, signDate: '2026-03-21' },
  { goszakupId: '24900783b', title: 'Ремонт и благоустройство детских площадок на территории Алатауского района', supplier: 'ТОО "ALA-Prime"', customer: 'Аппарат акима Алатауского района города Алматы', amount: 54500000, signDate: '2026-03-18' },
  { goszakupId: '24875939b', title: 'Текущий ремонт автомобильных дорог и тротуаров Наурызбайского района', supplier: 'ТОО "Стройсервис-2000"', customer: 'Аппарат акима Наурызбайского района города Алматы', amount: 220000000, signDate: '2026-03-15' },
]

type RawGoszakupRow = (typeof RAW)[0]

function dedupeByGoszakupId(rows: RawGoszakupRow[]): RawGoszakupRow[] {
  const map = new Map<string, RawGoszakupRow>()
  for (const r of rows) {
    if (!map.has(r.goszakupId)) map.set(r.goszakupId, r)
  }
  return [...map.values()]
}

/** P2002 on registryNumber — row appeared between findUnique and create, or duplicate id in data */
function isRegistryNumberUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false
  if ((err as { code: string }).code !== 'P2002') return false
  const target = (err as { meta?: { target?: string[] } }).meta?.target
  if (!target || !Array.isArray(target)) return true
  return target.some((t) => String(t).includes('registryNumber'))
}

// ─────────────────────────────────────────────
// District / coords lookup
// ─────────────────────────────────────────────
const DISTRICT_COORDS: Record<string, [number, number]> = {
  'Медеуский':     [43.262, 76.951],
  'Алмалинский':   [43.241, 76.935],
  'Ауэзовский':    [43.230, 76.868],
  'Бостандыкский': [43.214, 76.891],
  'Жетысуский':    [43.266, 76.984],
  'Наурызбайский': [43.175, 76.849],
  'Турксибский':   [43.299, 76.952],
  'Алатауский':    [43.158, 76.812],
}

function detectDistrict(customer: string, title: string): string {
  const text = customer + ' ' + title
  if (text.includes('Медеуского') || text.includes('Медеуский') || text.includes('Кокжайлау') || text.includes('Алматинка') || text.includes('Абылгазы')) return 'Медеуский'
  if (text.includes('Алмалинского') || text.includes('Алмалинский') || text.includes('Пушкина') || text.includes('Толе би') || text.includes('арычн')) return 'Алмалинский'
  if (text.includes('Ауэзовского') || text.includes('Ауэзовский') || text.includes('Тлендиева') || text.includes('Сатпаева')) return 'Ауэзовский'
  if (text.includes('Бостандыкского') || text.includes('Бостандыкский') || text.includes('Горный гигант') || text.includes('Каппарова')) return 'Бостандыкский'
  if (text.includes('Жетысуского') || text.includes('Жетысуский') || text.includes('Чаплыгина') || text.includes('Самырсын') || text.includes('Серикова') || text.includes('Бокейханова') || text.includes('Омарова')) return 'Жетысуский'
  if (text.includes('Наурызбайского') || text.includes('Наурызбайский') || text.includes('Калкаман') || text.includes('Тастыбулак') || text.includes('Кокмайса')) return 'Наурызбайский'
  if (text.includes('Турксибского') || text.includes('Турксибский') || text.includes('Ратушного')) return 'Турксибский'
  if (text.includes('Алатауского') || text.includes('Алатауский') || text.includes('Карасу') || text.includes('Жас-Канат') || text.includes('Ахметова')) return 'Алатауский'
  return 'Алмалинский'
}

function jitter(v: number, range = 0.015): number {
  return +((v + (Math.random() - 0.5) * range).toFixed(4))
}

function getCategory(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('водоснабж') || t.includes('водоотвед') || t.includes('арычн') || t.includes('ливнев') || t.includes('водопров') || t.includes('гидроузел') || t.includes('вододелит')) return 'Водоснабжение'
  if (t.includes('дорог') || t.includes('автомобил') || t.includes('пробивк') || t.includes('асфальт') || t.includes('транспортн') || t.includes('тпу')) return 'Дороги'
  if (t.includes('озелен') || t.includes('дерев') || t.includes('кустарник') || t.includes('парк') || t.includes('зелен')) return 'Озеленение'
  if (t.includes('школ') || t.includes('учебн') || t.includes('хореограф') || t.includes('библиотек')) return 'Образование'
  if (t.includes('детск') || t.includes('сад') || t.includes('ясли')) return 'Детские сады'
  if (t.includes('тепл') || t.includes('котельн') || t.includes('теплоснабж')) return 'Теплосети'
  if (t.includes('берегоукрепл') || t.includes('русл') || t.includes('реки') || t.includes('река')) return 'Гидрология'
  if (t.includes('псд') || t.includes('проектно') || t.includes('тэо') || t.includes('регламент') || t.includes('нормативн') || t.includes('корректировк')) return 'Проектирование'
  if (t.includes('жилых дом') || t.includes('многоквартирн')) return 'Жилищное строительство'
  if (t.includes('ремонтно-восстановит') || t.includes('текущий ремонт') || t.includes('ямочный')) return 'Ремонт'
  if (t.includes('содержани') || t.includes('лестниц') || t.includes('двор') || t.includes('контейнер') || t.includes('снег') || t.includes('лавин')) return 'Благоустройство'
  return 'Строительство'
}

type MilestoneSpec = { d: string; p: number; days: number }

function getMilestones(category: string, totalDays: number): MilestoneSpec[] {
  switch (category) {
    case 'Дороги':
      return [
        { d: 'Подготовительные работы, демонтаж', p: 15, days: Math.round(totalDays * 0.2) },
        { d: 'Укладка основания (щебень/бетон)', p: 35, days: Math.round(totalDays * 0.5) },
        { d: 'Асфальтирование и разметка', p: 35, days: Math.round(totalDays * 0.8) },
        { d: 'Приёмка и гарантийный осмотр', p: 15, days: totalDays },
      ]
    case 'Водоснабжение':
      return [
        { d: 'Проектная документация и разбивка', p: 10, days: Math.round(totalDays * 0.15) },
        { d: 'Земляные работы', p: 30, days: Math.round(totalDays * 0.45) },
        { d: 'Прокладка трубопровода', p: 40, days: Math.round(totalDays * 0.8) },
        { d: 'Испытания и сдача', p: 20, days: totalDays },
      ]
    case 'Озеленение':
      return [
        { d: 'Подготовка грунта и ирригация', p: 20, days: Math.round(totalDays * 0.25) },
        { d: 'Посадка деревьев и кустарников', p: 45, days: Math.round(totalDays * 0.65) },
        { d: 'Газон, уход и сдача', p: 35, days: totalDays },
      ]
    case 'Образование':
    case 'Детские сады':
      return [
        { d: 'Фундамент и коробка здания', p: 35, days: Math.round(totalDays * 0.4) },
        { d: 'Кровля и фасадные работы', p: 25, days: Math.round(totalDays * 0.65) },
        { d: 'Внутренняя отделка', p: 25, days: Math.round(totalDays * 0.85) },
        { d: 'Благоустройство и приёмка', p: 15, days: totalDays },
      ]
    case 'Жилищное строительство':
      return [
        { d: 'Котлован и фундамент', p: 20, days: Math.round(totalDays * 0.25) },
        { d: 'Монолитный каркас', p: 35, days: Math.round(totalDays * 0.55) },
        { d: 'Кровля и фасад', p: 25, days: Math.round(totalDays * 0.8) },
        { d: 'Внутренняя отделка, ввод в эксплуатацию', p: 20, days: totalDays },
      ]
    case 'Проектирование':
      return [
        { d: 'Сбор исходных данных и обследование', p: 25, days: Math.round(totalDays * 0.3) },
        { d: 'Разработка проектно-сметной документации', p: 50, days: Math.round(totalDays * 0.75) },
        { d: 'Экспертиза и согласование', p: 25, days: totalDays },
      ]
    case 'Гидрология':
      return [
        { d: 'Инженерные изыскания', p: 20, days: Math.round(totalDays * 0.25) },
        { d: 'Берегоукрепительные работы', p: 55, days: Math.round(totalDays * 0.8) },
        { d: 'Рекультивация и сдача', p: 25, days: totalDays },
      ]
    case 'Ремонт':
      return [
        { d: 'Демонтаж и подготовка', p: 20, days: Math.round(totalDays * 0.2) },
        { d: 'Основные ремонтные работы', p: 60, days: Math.round(totalDays * 0.8) },
        { d: 'Приёмка и устранение замечаний', p: 20, days: totalDays },
      ]
    default:
      return [
        { d: 'Подготовительный этап', p: 25, days: Math.round(totalDays * 0.3) },
        { d: 'Основные работы', p: 50, days: Math.round(totalDays * 0.75) },
        { d: 'Завершение и сдача', p: 25, days: totalDays },
      ]
  }
}

async function tryLinkOnChain(
  onChainEnv: GoszakupOnChainEnv,
  contractId: string,
  c: (typeof RAW)[0],
  district: string,
  lat: number,
  lng: number,
  deadline: Date,
  milespecs: MilestoneSpec[],
): Promise<boolean> {
  const row = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { onChainPubkey: true },
  })
  if (row?.onChainPubkey) return true

  const deadlineUnix = Math.floor(deadline.getTime() / 1000)
  const milestones = milespecs.map((m) => ({
    description: m.d,
    deadlineDays: m.days,
    tranchePct: m.p,
  }))

  const pda = await registerGoszakupRowOnChain(onChainEnv, {
    dbTitle: c.title,
    district,
    deadlineUnix,
    lat,
    lng,
    milestones,
  })

  await prisma.contract.update({
    where: { id: contractId },
    data: { onChainPubkey: pda },
  })
  return true
}

async function main() {
  console.log('Seeding 50 real contracts from goszakup.gov.kz...')

  let onChainEnv: GoszakupOnChainEnv | null = null
  if (process.env.SEED_GOSZAKUP_ONCHAIN === '1') {
    onChainEnv = await createGoszakupOnChainEnv()
  }

  let created = 0
  let skipped = 0
  let onChainLinked = 0
  let onChainFailed = 0

  const items = dedupeByGoszakupId(RAW)
  if (items.length < RAW.length) {
    console.log(`Note: dropped ${RAW.length - items.length} duplicate goszakupId row(s) in RAW`)
  }

  for (const c of items) {
    const district = detectDistrict(c.customer, c.title)
    const [baseLat, baseLng] = DISTRICT_COORDS[district] ?? [43.238, 76.900]
    const lat = jitter(baseLat)
    const lng = jitter(baseLng)
    const category = getCategory(c.title)

    // deadline: 365 days for large (>500M), 240 for medium, 120 for small
    const totalDays = c.amount > 1_000_000_000 ? 365 : c.amount > 200_000_000 ? 240 : 120
    const signTs = new Date(c.signDate).getTime()
    const deadline = new Date(signTs + totalDays * 86_400_000)

    const milespecs = getMilestones(category, totalDays)
    // First milestone accepted, second under_review, rest pending
    const msStatuses = ['ACCEPTED', 'UNDER_REVIEW', 'PENDING', 'PENDING'] as const

    // Find or create contractor
    const contractor =
      (await prisma.contractor.findFirst({ where: { name: c.supplier } })) ??
      (await prisma.contractor.create({ data: { name: c.supplier } }))

    const signAt = new Date(`${c.signDate}T12:00:00.000Z`)

    const existing = await prisma.contract.findUnique({
      where: { registryNumber: c.goszakupId },
      select: { id: true, onChainPubkey: true },
    })

    let contractId: string

    if (existing) {
      skipped++
      contractId = existing.id
      if (!onChainEnv || existing.onChainPubkey) {
        continue
      }
    } else {
      try {
        const row = await prisma.contract.create({
          data: {
            title: c.title,
            description: [
              `Предмет договора: Работа (как ref_subject_type=2 на goszakup.gov.kz).`,
              `Заказчик: ${c.customer}.`,
              `Поставщик: ${c.supplier}.`,
              `Номер в реестре ЕГЗ: ${c.goszakupId}.`,
              `Дата подписания: ${c.signDate}.`,
              `Отбор соответствует фильтрам портала: заказчик — Алматы, вид «Работа», сумма от 10 000 000 ₸.`,
            ].join(' '),
            district,
            lat,
            lng,
            contractorId: contractor.id,
            registryNumber: c.goszakupId,
            customerName: c.customer,
            subjectType: 'Работа',
            totalAmount: BigInt(c.amount),
            escrowAmount: BigInt(Math.round(c.amount * 0.2)),
            penaltyAmount: BigInt(0),
            startDate: signAt,
            deadline,
            status: 'ACTIVE',
            category,
            milestones: {
              create: milespecs.map((m, i) => ({
                description: m.d,
                deadlineDays: m.days,
                tranchePct: m.p,
                status: msStatuses[i] ?? 'PENDING',
                sortOrder: i + 1,
              })),
            },
          },
          select: { id: true },
        })
        contractId = row.id
        created++
        if (created % 10 === 0) console.log(`  ${created}/${items.length} inserted`)
      } catch (err) {
        if (!isRegistryNumberUniqueViolation(err)) throw err
        const again = await prisma.contract.findUnique({
          where: { registryNumber: c.goszakupId },
          select: { id: true, onChainPubkey: true },
        })
        if (!again) throw err
        skipped++
        contractId = again.id
        console.log(`  skip (race/duplicate): registry ${c.goszakupId} already in DB`)
        if (!onChainEnv || again.onChainPubkey) {
          continue
        }
      }
    }

    if (onChainEnv) {
      try {
        await tryLinkOnChain(onChainEnv, contractId, c, district, lat, lng, deadline, milespecs)
        onChainLinked++
      } catch (err) {
        onChainFailed++
        console.error(`[on-chain] registry ${c.goszakupId}:`, err)
      }
    }
  }

  const parts = [
    `✓ Done. ${created} inserted, ${skipped} skipped (already had registryNumber), from goszakup.gov.kz`,
  ]
  if (onChainEnv) {
    parts.push(`On-chain: ${onChainLinked} linked/updated, ${onChainFailed} failed`)
  }
  console.log(parts.join('. '))
}

async function run() {
  try {
    await main()
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
  if (process.exitCode) process.exit(process.exitCode)
}

run()
