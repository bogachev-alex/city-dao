export const DEMO_CONTRACTOR_ID = 'demo-contractor-1'
export const DEMO_CONTRACTOR_NAME = 'ТОО СтройАлматы'

export function ownsContract(
  authId: string,
  contractorId: string | null | undefined,
  contractorName?: string | null,
  contractorWalletAddress?: string | null,
): boolean {
  if (contractorId && contractorId === authId) return true
  if (contractorWalletAddress && contractorWalletAddress === authId) return true
  if (authId === DEMO_CONTRACTOR_ID && contractorName === DEMO_CONTRACTOR_NAME) return true
  return false
}
