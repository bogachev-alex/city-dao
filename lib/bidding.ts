import { prisma } from '@/lib/prisma'
import { getGameDay } from '@/lib/agent/game-day'

export async function openBidRound(contractId: string, openedDay?: number) {
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) throw new Error('Contract not found')
  if (contract.contractorId) throw new Error('Contract already has a contractor assigned')
  const open = await prisma.bidRound.findFirst({
    where: { contractId, status: 'OPEN' },
  })
  if (open) throw new Error('An open bid round already exists for this contract')
  const day = openedDay ?? (await getGameDay())
  return prisma.bidRound.create({
    data: {
      contractId,
      openedDay: day,
      closesDay: day + 3,
      status: 'OPEN',
    },
  })
}

export async function submitBid(input: {
  bidRoundId: string
  contractorId: string
  amount: bigint
  daysToComplete: number
  qualityPledge?: string | null
}) {
  const round = await prisma.bidRound.findUnique({
    where: { id: input.bidRoundId },
    include: { contract: true },
  })
  if (!round || round.status !== 'OPEN') throw new Error('Bid round is not open')
  const nowDay = await getGameDay()
  if (nowDay > round.closesDay) throw new Error('Bid round is closed for new bids')
  const contractor = await prisma.contractor.findUnique({ where: { id: input.contractorId } })
  if (!contractor) throw new Error('Contractor not found')
  if (contractor.rating === 'BLACKLISTED') throw new Error('Blacklisted contractors cannot bid')
  return prisma.bid.create({
    data: {
      bidRoundId: input.bidRoundId,
      contractorId: input.contractorId,
      amount: input.amount,
      daysToComplete: input.daysToComplete,
      qualityPledge: input.qualityPledge ?? null,
    },
  })
}

export async function closeBidRound(roundId: string) {
  const r = await prisma.bidRound.findUnique({ where: { id: roundId } })
  if (!r) throw new Error('Bid round not found')
  if (r.status !== 'OPEN') throw new Error('Round is not open')
  return prisma.bidRound.update({
    where: { id: roundId },
    data: { status: 'CLOSED' },
  })
}

/** Lowest amount wins; ties broken by higher reputationScore. */
export async function awardBidRound(roundId: string, winnerContractorId?: string) {
  const round = await prisma.bidRound.findUnique({
    where: { id: roundId },
    include: {
      bids: { include: { contractor: true } },
      contract: true,
    },
  })
  if (!round) throw new Error('Bid round not found')
  if (round.status === 'AWARDED') throw new Error('Already awarded')
  if (round.bids.length === 0) throw new Error('No bids to award')

  let winner = winnerContractorId
  if (!winner) {
    const sorted = [...round.bids].sort((a, b) => {
      if (a.amount < b.amount) return -1
      if (a.amount > b.amount) return 1
      return b.contractor.reputationScore - a.contractor.reputationScore
    })
    winner = sorted[0].contractorId
  } else {
    const ok = round.bids.some((b) => b.contractorId === winner)
    if (!ok) throw new Error('Winner must be one of the bidders')
  }

  await prisma.$transaction([
    prisma.bidRound.update({
      where: { id: roundId },
      data: { status: 'AWARDED', winnerContractorId: winner },
    }),
    prisma.contract.update({
      where: { id: round.contractId },
      data: { contractorId: winner },
    }),
  ])

  return { bidRoundId: roundId, winnerContractorId: winner }
}
