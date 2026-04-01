import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

/** Agent-friendly jury vote: stores salt for reveal (agentCommitSalt). */
export async function agentVoteJury(
  citizenId: string,
  sessionId: string,
  vote: 'ACCEPT' | 'REJECT'
) {
  const voteRow = await prisma.juryVote.findFirst({
    where: { sessionId, citizenId },
  })
  if (!voteRow) throw new Error('Not a juror in this session')

  const session = await prisma.jurySession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Session not found')

  if (session.status === 'COMMIT_PHASE') {
    if (voteRow.commitHash) throw new Error('Already committed')
    const salt = randomBytes(16).toString('hex')
    const commitHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')
    await prisma.juryVote.update({
      where: { id: voteRow.id },
      data: { commitHash, agentCommitSalt: salt },
    })
    return { phase: 'commit' as const, sessionId }
  }

  if (session.status === 'REVEAL_PHASE') {
    if (!voteRow.commitHash) throw new Error('Must commit before reveal')
    if (voteRow.revealedVote) throw new Error('Already revealed')
    const salt = voteRow.agentCommitSalt
    if (!salt) throw new Error('Missing agent commit salt — recommit in COMMIT phase')
    const computed = createHash('sha256').update(`${vote}:${salt}`).digest('hex')
    if (computed !== voteRow.commitHash) throw new Error('Vote must match commit phase')

    await prisma.juryVote.update({
      where: { id: voteRow.id },
      data: { revealedVote: vote, revealedSalt: salt },
    })

    const allVotes = await prisma.juryVote.findMany({ where: { sessionId } })
    const allRevealed = allVotes.every((v) => v.revealedVote !== null)
    if (allRevealed) {
      let weightedAccept = 0
      let weightedReject = 0
      for (const v of allVotes) {
        if (v.revealedVote === 'ACCEPT') weightedAccept += v.weight
        else if (v.revealedVote === 'REJECT') weightedReject += v.weight
      }
      const result = weightedAccept >= weightedReject ? 'ACCEPT' : 'REJECT'
      const status = weightedAccept === 2 && weightedReject === 2 ? 'ESCALATED' : 'FINALIZED'
      await prisma.jurySession.update({
        where: { id: sessionId },
        data: { status, result, weightedAccept, weightedReject },
      })
    }
    return { phase: 'reveal' as const, sessionId }
  }

  throw new Error(`Session not in a voting phase (status=${session.status})`)
}
