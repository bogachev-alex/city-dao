import { vi } from 'vitest'

// Generates a mock Prisma model with common methods
function mockModel() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  }
}

export const prismaMock = {
  citizen: mockModel(),
  contract: mockModel(),
  contractor: mockModel(),
  milestone: mockModel(),
  jurySession: mockModel(),
  juryVote: mockModel(),
  penalty: mockModel(),
  workLog: mockModel(),
  districtTreasury: mockModel(),
  spendingProposal: mockModel(),
  proposalVote: mockModel(),
  aiResearchReport: mockModel(),
  citizenSuggestion: mockModel(),
  suggestionVote: mockModel(),
  citizenNft: mockModel(),
  crowdfundingCampaign: mockModel(),
  campaignContribution: mockModel(),
  $transaction: vi.fn(async (fn: any) => fn(prismaMock)),
}

// Reset all mocks between tests
export function resetPrismaMock() {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === 'object' && model !== null) {
      for (const method of Object.values(model)) {
        if (typeof method === 'function' && 'mockReset' in method) {
          ;(method as any).mockReset()
        }
      }
    }
  }
}
