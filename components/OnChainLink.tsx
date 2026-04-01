import { getSolanaExplorerAddressUrl } from '@/lib/contracts'
import ExternalLink from '@/components/ExternalLink'

type Props = {
  address?: string | null
  label: string
  className?: string
  withIcon?: boolean
}

export default function OnChainLink({ address, label, className, withIcon = false }: Props) {
  if (!address) return null

  const href = getSolanaExplorerAddressUrl(address)

  return (
    <ExternalLink
      href={href}
      label={label}
      className={className}
      withIcon={withIcon}
    />
  )
}
