import type { CrowdfundingCampaign, Prisma } from '@/lib/generated/prisma'
import { PLACEHOLDER_CONTRACTOR_NAME } from '@/lib/crowdfundingContractConstants'

const CATEGORY_LABEL: Record<string, string> = {
  PLAYGROUND: 'Детские площадки',
  SCHOOL: 'Школы и детсады',
  ROADS: 'Дороги и тротуары',
  LANDSCAPING: 'Озеленение',
  COMMERCIAL: 'Коммерческие проекты',
}

async function ensurePlaceholderContractor(tx: Prisma.TransactionClient) {
  let row = await tx.contractor.findFirst({
    where: { name: PLACEHOLDER_CONTRACTOR_NAME },
  })
  if (!row) {
    row = await tx.contractor.create({
      data: {
        name: PLACEHOLDER_CONTRACTOR_NAME,
        rating: 'C',
        reputationScore: 0,
        onTimeRate: 0,
        acceptanceRate: 0,
        updateFrequency: 0,
        gpsAccuracy: 0,
        blockerSpeed: 0,
      },
    })
  }
  return row
}

function milestoneTemplate(deadline: Date): { description: string; deadlineDays: number; tranchePct: number; sortOrder: number }[] {
  const start = Date.now()
  const daysTotal = Math.max(1, Math.ceil((deadline.getTime() - start) / 86_400_000))
  const d1 = Math.max(1, Math.floor(daysTotal * 0.25))
  const d2 = Math.max(1, Math.floor(daysTotal * 0.55))
  const d3 = Math.max(1, daysTotal - d1 - d2)
  return [
    { description: 'Подготовка и согласования', deadlineDays: d1, tranchePct: 25, sortOrder: 1 },
    { description: 'Основные работы', deadlineDays: d2, tranchePct: 50, sortOrder: 2 },
    { description: 'Приёмка и сдача', deadlineDays: d3, tranchePct: 25, sortOrder: 3 },
  ]
}

/**
 * Creates a Contract + links campaign when status is FUNDED and contractId is empty.
 * Idempotent. Call inside the same Prisma transaction as the contribution update.
 */
export async function promoteCrowdfundingToContract(
  tx: Prisma.TransactionClient,
  campaign: CrowdfundingCampaign
): Promise<{ contractId: string } | null> {
  if (campaign.contractId) return null
  if (campaign.status !== 'FUNDED') return null

  const placeholder = await ensurePlaceholderContractor(tx)
  const total = campaign.targetAmount
  const escrow = (total * BigInt(20)) / BigInt(100)
  const categoryLabel = CATEGORY_LABEL[campaign.category] || 'Краудфандинг'

  const contract = await tx.contract.create({
    data: {
      title: campaign.title,
      description: campaign.description || undefined,
      district: campaign.district,
      lat: campaign.lat,
      lng: campaign.lng,
      contractorId: placeholder.id,
      totalAmount: total,
      escrowAmount: escrow,
      deadline: campaign.deadline,
      category: categoryLabel,
      milestones: {
        create: milestoneTemplate(campaign.deadline).map((m) => ({
          description: m.description,
          deadlineDays: m.deadlineDays,
          tranchePct: m.tranchePct,
          sortOrder: m.sortOrder,
        })),
      },
    },
  })

  const commercialNoState = campaign.stateMatch === BigInt(0)

  await tx.crowdfundingCampaign.update({
    where: { id: campaign.id },
    data: {
      contractId: contract.id,
      ...(commercialNoState
        ? { status: 'MATCHED', stateDeposited: true }
        : {}),
    },
  })

  return { contractId: contract.id }
}
