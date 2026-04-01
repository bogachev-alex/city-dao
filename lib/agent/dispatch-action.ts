import { prisma } from '@/lib/prisma'
import type { AgentRole } from '@/lib/agent/observe'
import { agentVoteJury } from '@/lib/agent/jury-vote-agent'
import { awardBidRound, openBidRound, submitBid } from '@/lib/bidding'
import { getGameDay } from '@/lib/agent/game-day'

type Params = Record<string, unknown>

function str(p: Params, k: string): string {
  const v = p[k]
  if (typeof v !== 'string' || !v) throw new Error(`Missing string param: ${k}`)
  return v
}

function big(p: Params, k: string): bigint {
  const v = p[k]
  if (typeof v === 'number') return BigInt(v)
  if (typeof v === 'string') return BigInt(v)
  throw new Error(`Missing bigint param: ${k}`)
}

export async function dispatchAgentAction(
  role: AgentRole,
  agentId: string,
  action: string,
  params: Params
) {
  switch (action) {
    case 'rate_satisfaction': {
      if (role !== 'CITIZEN') throw new Error('rate_satisfaction is for CITIZEN')
      const score = Number(params.score)
      if (!Number.isFinite(score) || score < 1 || score > 5) {
        throw new Error('score must be 1-5')
      }
      const gameDayOverride = typeof params.gameDay === 'number' ? params.gameDay : undefined
      const citizen = await prisma.citizen.findUnique({ where: { id: agentId } })
      if (!citizen) throw new Error('Citizen not found')

      const day = gameDayOverride ?? (await getGameDay())
      const existing = await prisma.satisfactionVote.findUnique({
        where: { citizenId_gameDay: { citizenId: agentId, gameDay: day } },
      })
      if (existing) throw new Error('Already rated satisfaction today')
      const vote = await prisma.satisfactionVote.create({
        data: {
          citizenId: agentId,
          gameDay: day,
          score: Math.floor(score),
          district: citizen.district,
        },
      })
      return { ok: true as const, result: { voteId: vote.id, gameDay: vote.gameDay } }
    }

    case 'vote_jury': {
      if (role !== 'CITIZEN') throw new Error('vote_jury is for CITIZEN')
      const sessionId = str(params, 'sessionId')
      const vote = str(params, 'vote') as 'ACCEPT' | 'REJECT'
      if (vote !== 'ACCEPT' && vote !== 'REJECT') throw new Error('vote must be ACCEPT or REJECT')
      const out = await agentVoteJury(agentId, sessionId, vote)
      return { ok: true as const, result: out }
    }

    case 'vote_proposal': {
      if (role !== 'CITIZEN') throw new Error('vote_proposal is for CITIZEN')
      const proposalId = str(params, 'proposalId')
      const inFavor = Boolean(params.inFavor)
      const proposal = await prisma.spendingProposal.findUnique({
        where: { id: proposalId },
        include: { treasury: true },
      })
      if (!proposal) throw new Error('Proposal not found')
      const existing = await prisma.proposalVote.findUnique({
        where: { proposalId_citizenId: { proposalId, citizenId: agentId } },
      })
      if (existing) throw new Error('Already voted')
      await prisma.$transaction([
        prisma.proposalVote.create({
          data: { proposalId, citizenId: agentId, inFavor },
        }),
        prisma.spendingProposal.update({
          where: { id: proposalId },
          data: inFavor ? { votesFor: { increment: 1 } } : { votesAgainst: { increment: 1 } },
        }),
      ])
      return { ok: true as const, result: { proposalId } }
    }

    case 'create_suggestion': {
      if (role !== 'CITIZEN') throw new Error('create_suggestion is for CITIZEN')
      const citizen = await prisma.citizen.findUnique({ where: { id: agentId } })
      if (!citizen) throw new Error('Citizen not found')
      if (citizen.reputationScore < 50) throw new Error('Minimum Tier 1 (rep >= 50) required')
      let upvotesNeeded = 10
      if (citizen.tier === 'TRUSTED') upvotesNeeded = 5
      if (citizen.tier === 'GUARDIAN') upvotesNeeded = 0
      const suggestion = await prisma.citizenSuggestion.create({
        data: {
          citizenId: agentId,
          title: str(params, 'title'),
          problemDesc: str(params, 'problemDesc'),
          suggestedFix: typeof params.suggestedFix === 'string' ? params.suggestedFix : null,
          district: str(params, 'district'),
          lat: Number(params.lat) || 43.25,
          lng: Number(params.lng) || 76.91,
          urgency: (params.urgency as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') || 'MEDIUM',
          budgetMin: params.budgetMin != null ? big(params, 'budgetMin') : null,
          budgetMax: params.budgetMax != null ? big(params, 'budgetMax') : null,
          upvotesNeeded,
          status: upvotesNeeded === 0 ? 'AI_RESEARCH' : 'PENDING_UPVOTES',
        },
      })
      return { ok: true as const, result: { suggestionId: suggestion.id } }
    }

    case 'upvote_suggestion': {
      if (role !== 'CITIZEN') throw new Error('upvote_suggestion is for CITIZEN')
      const suggestionId = str(params, 'suggestionId')
      const existing = await prisma.suggestionVote.findUnique({
        where: { suggestionId_citizenId: { suggestionId, citizenId: agentId } },
      })
      if (existing) throw new Error('Already upvoted')
      const out = await prisma.$transaction(async (tx) => {
        await tx.suggestionVote.create({
          data: { suggestionId, citizenId: agentId, isUpvote: true },
        })
        const s = await tx.citizenSuggestion.update({
          where: { id: suggestionId },
          data: { upvotesReceived: { increment: 1 } },
        })
        if (
          s.status === 'PENDING_UPVOTES' &&
          s.upvotesReceived >= s.upvotesNeeded
        ) {
          const updated = await tx.citizenSuggestion.update({
            where: { id: suggestionId },
            data: { status: 'AI_RESEARCH' },
          })
          return { suggestionId, status: updated.status }
        }
        return { suggestionId, status: s.status }
      })
      return { ok: true as const, result: out }
    }

    case 'contribute_crowdfunding': {
      if (role !== 'CITIZEN') throw new Error('contribute_crowdfunding is for CITIZEN')
      const campaignId = str(params, 'campaignId')
      const amount = big(params, 'amount')
      if (amount < BigInt(500)) throw new Error('Minimum contribution is 500 tenge')
      const campaign = await prisma.crowdfundingCampaign.findUnique({ where: { id: campaignId } })
      if (!campaign || campaign.status !== 'ACTIVE') throw new Error('Campaign not available')
      const newRaised = campaign.citizenRaised + amount
      const isFunded = newRaised >= campaign.citizenTarget
      const [contribution] = await prisma.$transaction([
        prisma.campaignContribution.create({
          data: {
            campaignId,
            citizenId: agentId,
            amount,
            anonymous: Boolean(params.anonymous),
          },
        }),
        prisma.crowdfundingCampaign.update({
          where: { id: campaignId },
          data: {
            citizenRaised: { increment: amount },
            donorCount: { increment: 1 },
            ...(isFunded ? { status: 'FUNDED' } : {}),
          },
        }),
      ])
      return { ok: true as const, result: { contributionId: contribution.id } }
    }

    case 'submit_work_log': {
      if (role !== 'CONTRACTOR') throw new Error('submit_work_log is for CONTRACTOR')
      const contractId = str(params, 'contractId')
      const contract = await prisma.contract.findUnique({ where: { id: contractId } })
      if (!contract || contract.contractorId !== agentId) throw new Error('Contract not yours')
      const log = await prisma.workLog.create({
        data: {
          contractId,
          contractorId: agentId,
          type: 'DAILY_LOG',
          title: str(params, 'title'),
          description: typeof params.description === 'string' ? params.description : '',
          completionPct: typeof params.completionPct === 'number' ? params.completionPct : null,
        },
      })
      return { ok: true as const, result: { workLogId: log.id } }
    }

    case 'claim_milestone': {
      if (role !== 'CONTRACTOR') throw new Error('claim_milestone is for CONTRACTOR')
      const contractId = str(params, 'contractId')
      const milestoneId = str(params, 'milestoneId')
      const contract = await prisma.contract.findUnique({ where: { id: contractId } })
      if (!contract || contract.contractorId !== agentId) throw new Error('Contract not yours')
      const m = await prisma.milestone.findFirst({
        where: { id: milestoneId, contractId },
      })
      if (!m) throw new Error('Milestone not on this contract')
      const updated = await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: 'SUBMITTED' },
      })
      return { ok: true as const, result: { milestoneId: updated.id } }
    }

    case 'report_blocker': {
      if (role !== 'CONTRACTOR') throw new Error('report_blocker is for CONTRACTOR')
      const contractId = str(params, 'contractId')
      const contract = await prisma.contract.findUnique({ where: { id: contractId } })
      if (!contract || contract.contractorId !== agentId) throw new Error('Contract not yours')
      const log = await prisma.workLog.create({
        data: {
          contractId,
          contractorId: agentId,
          type: 'BLOCKER',
          title: 'Blocker',
          description: str(params, 'description'),
        },
      })
      return { ok: true as const, result: { workLogId: log.id } }
    }

    case 'approve_suggestion': {
      if (role !== 'AKIMAT') throw new Error('approve_suggestion is for AKIMAT')
      const suggestionId = str(params, 'suggestionId')
      const s = await prisma.citizenSuggestion.findUnique({ where: { id: suggestionId } })
      if (!s || s.district !== agentId) throw new Error('Suggestion not in your district')
      const treasury = await prisma.districtTreasury.findUnique({
        where: { district: s.district },
      })
      if (!treasury) throw new Error(`District treasury not found for ${s.district}`)
      const amount =
        (s.budgetMax && s.budgetMax > BigInt(0) && s.budgetMax) ||
        (s.budgetMin && s.budgetMin > BigInt(0) && s.budgetMin) ||
        BigInt(1_000_000)
      const out = await prisma.$transaction(async (tx) => {
        const proposal = await tx.spendingProposal.create({
          data: {
            treasuryId: treasury.id,
            title: s.title,
            description: `[suggestion:${s.id}] ${s.problemDesc}`,
            amount,
            category: 'CITIZEN_SUGGESTION',
            status: 'VOTING',
            votingEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        })
        const updated = await tx.citizenSuggestion.update({
          where: { id: suggestionId },
          data: { status: 'ACTIVE_VOTE' },
        })
        return { suggestionId: updated.id, proposalId: proposal.id }
      })
      return { ok: true as const, result: out }
    }

    case 'open_bid_round': {
      if (role !== 'AKIMAT') throw new Error('open_bid_round is for AKIMAT')
      const contractId = str(params, 'contractId')
      const contract = await prisma.contract.findUnique({ where: { id: contractId } })
      if (!contract || contract.district !== agentId) throw new Error('Contract not in your district')
      let openedDay: number | undefined
      if (params.openedDay !== undefined && params.openedDay !== null) {
        const d =
          typeof params.openedDay === 'number' ? params.openedDay : Number(params.openedDay)
        if (!Number.isFinite(d)) throw new Error('openedDay must be a number')
        openedDay = Math.floor(d)
      }
      const round = await openBidRound(contractId, openedDay)
      return { ok: true as const, result: { bidRoundId: round.id } }
    }

    case 'bid_on_contract': {
      if (role !== 'CONTRACTOR') throw new Error('bid_on_contract is for CONTRACTOR')
      const bidRoundId = str(params, 'bidRoundId')
      const daysToComplete = Number(params.daysToComplete)
      if (!Number.isFinite(daysToComplete) || daysToComplete < 1) {
        throw new Error('daysToComplete must be a positive number')
      }
      const b = await submitBid({
        bidRoundId,
        contractorId: agentId,
        amount: big(params, 'amount'),
        daysToComplete: Math.floor(daysToComplete),
        qualityPledge: typeof params.qualityPledge === 'string' ? params.qualityPledge : null,
      })
      return { ok: true as const, result: { bidId: b.id } }
    }

    case 'select_bid_winner': {
      if (role !== 'AKIMAT') throw new Error('select_bid_winner is for AKIMAT')
      const bidRoundId = str(params, 'bidRoundId')
      const round = await prisma.bidRound.findUnique({
        where: { id: bidRoundId },
        include: { contract: true },
      })
      if (!round || round.contract.district !== agentId) throw new Error('Bid round not in your district')
      const winner =
        typeof params.winnerContractorId === 'string' && params.winnerContractorId
          ? params.winnerContractorId
          : undefined
      const out = await awardBidRound(bidRoundId, winner)
      return { ok: true as const, result: out }
    }

    default:
      throw new Error(`Unknown action: ${action}`)
  }
}
