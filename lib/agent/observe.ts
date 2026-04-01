import { prisma } from '@/lib/prisma'
import { getGameDay } from '@/lib/agent/game-day'

export type AgentRole = 'CITIZEN' | 'CONTRACTOR' | 'AKIMAT'

export async function buildObserve(role: AgentRole, id: string) {
  const gameDay = await getGameDay()

  if (role === 'CITIZEN') {
    const citizen = await prisma.citizen.findUnique({
      where: { id },
      include: {
        juryVotes: {
          include: {
            session: {
              include: {
                contract: { select: { id: true, title: true, district: true } },
                milestone: { select: { id: true, description: true } },
              },
            },
          },
        },
      },
    })
    if (!citizen) return { error: 'Citizen not found' as const }

    const treasury = await prisma.districtTreasury.findUnique({
      where: { district: citizen.district },
      include: {
        proposals: {
          where: { status: 'VOTING' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    const contracts = await prisma.contract.findMany({
      where: { district: citizen.district },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, district: true },
    })

    const juryActions = citizen.juryVotes
      .filter((v) =>
        ['COMMIT_PHASE', 'REVEAL_PHASE'].includes(v.session.status)
      )
      .map((v) => ({
        action: 'vote_jury' as const,
        sessionId: v.sessionId,
        contractTitle: v.session.contract.title,
        milestoneDesc: v.session.milestone.description,
        phase: v.session.status,
      }))

    const proposalActions =
      treasury?.proposals.map((p) => ({
        action: 'vote_proposal' as const,
        proposalId: p.id,
        title: p.title,
        amount: p.amount.toString(),
      })) ?? []

    const suggestions = await prisma.citizenSuggestion.findMany({
      where: { district: citizen.district, status: 'PENDING_UPVOTES' },
      take: 15,
      orderBy: { createdAt: 'desc' },
    })

    const campaigns = await prisma.crowdfundingCampaign.findMany({
      where: { district: citizen.district, status: 'ACTIVE' },
      take: 10,
    })

    const existingSatisfaction = await prisma.satisfactionVote.findUnique({
      where: { citizenId_gameDay: { citizenId: citizen.id, gameDay } },
    })

    return {
      role: 'CITIZEN' as const,
      gameDay,
      profile: {
        reputation: citizen.reputationScore,
        tier: citizen.tier,
        district: citizen.district,
      },
      availableActions: [
        ...juryActions,
        ...proposalActions,
        ...(existingSatisfaction
          ? []
          : [
              {
                action: 'rate_satisfaction' as const,
                scoreHint: 4,
                description: 'Rate district satisfaction (1-5)',
              },
            ]),
        { action: 'create_suggestion' as const, description: 'Propose a new project for your district' },
        ...suggestions.map((s) => ({
          action: 'upvote_suggestion' as const,
          suggestionId: s.id,
          title: s.title,
          currentVotes: s.upvotesReceived,
        })),
        ...campaigns.map((c) => ({
          action: 'contribute_crowdfunding' as const,
          campaignId: c.id,
          title: c.title,
          progress: Math.min(
            100,
            c.citizenTarget > BigInt(0)
              ? Number((c.citizenRaised * BigInt(100)) / c.citizenTarget)
              : 0
          ),
        })),
      ],
      context: {
        districtTreasury: treasury
          ? { balance: treasury.balance.toString(), activeProposals: treasury.proposals.length }
          : null,
        activeContracts: contracts,
        pendingJurySessions: citizen.juryVotes.filter((v) =>
          ['COMMIT_PHASE', 'REVEAL_PHASE'].includes(v.session.status)
        ).length,
      },
    }
  }

  if (role === 'CONTRACTOR') {
    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: {
        contracts: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          include: { milestones: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    })
    if (!contractor) return { error: 'Contractor not found' as const }

    const districts = Array.from(new Set(contractor.contracts.map((c) => c.district)))
    const myBidRoundIds = new Set(
      (
        await prisma.bid.findMany({
          where: { contractorId: id },
          select: { bidRoundId: true },
        })
      ).map((b) => b.bidRoundId)
    )
    const openBidRoundRows = await prisma.bidRound.findMany({
      where: {
        status: 'OPEN',
        ...(districts.length > 0 ? { contract: { district: { in: districts } } } : {}),
      },
      include: {
        contract: { select: { id: true, title: true, district: true, totalAmount: true } },
      },
      take: 25,
    })
    const openBidRounds = openBidRoundRows.filter((r) => !myBidRoundIds.has(r.id))
    const bidActions = openBidRounds.map((r) => ({
      action: 'bid_on_contract' as const,
      bidRoundId: r.id,
      contractId: r.contract.id,
      title: r.contract.title,
      budget: r.contract.totalAmount.toString(),
      closesDay: r.closesDay,
    }))

    return {
      role: 'CONTRACTOR' as const,
      gameDay,
      profile: {
        name: contractor.name,
        rating: contractor.rating,
        reputationScore: contractor.reputationScore,
      },
      availableActions: [
        ...bidActions,
        ...contractor.contracts.flatMap((c) => {
        const cur = c.milestones.find((m) => m.status === 'PENDING' || m.status === 'SUBMITTED')
        return [
          {
            action: 'submit_work_log' as const,
            contractId: c.id,
            title: c.title,
            milestoneCurrent: cur?.description ?? '—',
          },
          ...(cur
            ? [
                {
                  action: 'claim_milestone' as const,
                  contractId: c.id,
                  milestoneId: cur.id,
                  description: cur.description,
                },
              ]
            : []),
          {
            action: 'report_blocker' as const,
            contractId: c.id,
            description: 'Report a delay or blocker',
          },
        ]
      }),
      ],
      context: {
        myContracts: contractor.contracts.map((c) => ({
          id: c.id,
          title: c.title,
          penaltyAmount: c.penaltyAmount.toString(),
          milestones: c.milestones.map((m) => ({ id: m.id, status: m.status, description: m.description })),
        })),
        openBidRounds: openBidRounds.map((r) => ({
          bidRoundId: r.id,
          contractId: r.contract.id,
          title: r.contract.title,
          district: r.contract.district,
          closesDay: r.closesDay,
        })),
        reputation: {
          rating: contractor.rating,
          score: contractor.reputationScore,
          onTimeRate: contractor.onTimeRate,
        },
      },
    }
  }

  // AKIMAT: id is district name
  const district = decodeURIComponent(id)
  const treasury = await prisma.districtTreasury.findUnique({
    where: { district },
    include: { proposals: { take: 20 } },
  })

  const satisfactionAgg = await prisma.satisfactionVote.aggregate({
    where: { district, gameDay: { gte: Math.max(0, gameDay - 6), lte: gameDay } },
    _avg: { score: true },
  })
  const citizenSatisfaction =
    satisfactionAgg._avg.score != null
      ? Math.round((Number(satisfactionAgg._avg.score) / 5) * 100)
      : null
  const pendingSuggestions = await prisma.citizenSuggestion.findMany({
    where: { district, status: { in: ['PENDING_UPVOTES', 'READY_FOR_BALLOT'] } },
    take: 20,
  })
  const atRisk = await prisma.contract.findMany({
    where: {
      district,
      OR: [{ status: 'PENALIZED' }, { penaltyAmount: { gt: BigInt(0) } }],
    },
    take: 15,
    select: { id: true, title: true, status: true, penaltyAmount: true },
  })

  const unassignedContracts = await prisma.contract.findMany({
    where: { district, contractorId: null },
    take: 15,
    select: { id: true, title: true, totalAmount: true },
  })

  const closedRoundsWithBids = await prisma.bidRound.findMany({
    where: {
      status: 'CLOSED',
      contract: { district },
    },
    include: {
      contract: { select: { id: true, title: true } },
      bids: { select: { id: true } },
    },
    take: 20,
  })
  const roundsToAward = closedRoundsWithBids.filter((r) => r.bids.length > 0)

  return {
    role: 'AKIMAT' as const,
    gameDay,
    district,
    availableActions: [
      ...pendingSuggestions.map((s) => ({
        action: 'approve_suggestion' as const,
        suggestionId: s.id,
        title: s.title,
        upvotes: s.upvotesReceived,
      })),
      ...unassignedContracts.map((c) => ({
        action: 'open_bid_round' as const,
        contractId: c.id,
        title: c.title,
        budget: c.totalAmount.toString(),
      })),
      ...roundsToAward.map((r) => ({
        action: 'select_bid_winner' as const,
        bidRoundId: r.id,
        contractId: r.contract.id,
        title: r.contract.title,
        bidCount: r.bids.length,
      })),
      { action: 'register_contract' as const, description: 'Create contract via /api/contracts' },
    ],
    context: {
      pendingSuggestions,
      districtTreasuries: treasury
        ? [{ district: treasury.district, balance: treasury.balance.toString(), proposals: treasury.proposals.length }]
        : [],
      contractsAtRisk: atRisk,
      unassignedContracts,
      bidRoundsPendingAward: roundsToAward.map((r) => ({
        bidRoundId: r.id,
        contractId: r.contract.id,
        title: r.contract.title,
        bidCount: r.bids.length,
      })),
      citizenSatisfaction,
    },
  }
}

