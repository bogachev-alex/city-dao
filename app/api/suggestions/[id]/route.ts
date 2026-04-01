import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

function proposalAmountFromSuggestion(s: {
  budgetMax: bigint | null
  budgetMin: bigint | null
}) {
  if (s.budgetMax && s.budgetMax > BigInt(0)) return s.budgetMax
  if (s.budgetMin && s.budgetMin > BigInt(0)) return s.budgetMin
  return BigInt(1_000_000)
}

// PATCH /api/suggestions/[id] — approve/reject suggestion (AKIMAT only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireRole(req, ['AKIMAT'])
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
  const action = String(body.action || '').toLowerCase()

  const suggestion = await prisma.citizenSuggestion.findUnique({ where: { id } })
  if (!suggestion) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
  }
  if (suggestion.status === 'REJECTED' || suggestion.status === 'FUNDED') {
    return NextResponse.json(
      { error: `Suggestion already finalized with status ${suggestion.status}` },
      { status: 409 }
    )
  }

  if (action === 'reject') {
    const rejected = await prisma.citizenSuggestion.update({
      where: { id },
      data: { status: 'REJECTED' },
    })
    return NextResponse.json({ suggestion: rejected })
  }

  if (action === 'approve') {
    const treasury = await prisma.districtTreasury.findUnique({
      where: { district: suggestion.district },
    })
    if (!treasury) {
      return NextResponse.json(
        { error: `District treasury not found for ${suggestion.district}` },
        { status: 404 }
      )
    }

    const amount = proposalAmountFromSuggestion(suggestion)
    const out = await prisma.$transaction(async (tx) => {
      const proposal = await tx.spendingProposal.create({
        data: {
          treasuryId: treasury.id,
          title: suggestion.title,
          description: `[suggestion:${suggestion.id}] ${suggestion.problemDesc}`,
          amount,
          category: 'CITIZEN_SUGGESTION',
          status: 'VOTING',
          votingEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      })

      const updatedSuggestion = await tx.citizenSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'ACTIVE_VOTE' },
      })

      return { proposal, suggestion: updatedSuggestion }
    })

    return NextResponse.json(out)
  }

  return NextResponse.json(
    { error: "Invalid action. Use 'approve' or 'reject'." },
    { status: 400 }
  )
}
