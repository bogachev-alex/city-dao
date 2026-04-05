import { vi } from 'vitest'

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
  $transaction: vi.fn(async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg)
    return arg(prismaMock)
  }),
}

const DEFAULT_RETURN: Record<string, unknown> = {
  findMany: [],
  findUnique: null,
  findFirst: null,
  create: {},
  update: {},
  delete: {},
  deleteMany: { count: 0 },
  count: 0,
}

export function resetPrismaMock() {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === 'object' && model !== null) {
      for (const [key, method] of Object.entries(model)) {
        if (typeof method === 'function' && 'mockReset' in method) {
          ;(method as any).mockReset()
          if (key in DEFAULT_RETURN) {
            ;(method as any).mockResolvedValue(DEFAULT_RETURN[key])
          }
        }
      }
    }
  }
  prismaMock.$transaction.mockImplementation(async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg)
    return arg(prismaMock)
  })
}
