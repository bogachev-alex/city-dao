type Props = {
  href: string
  label: string
  className?: string
  withIcon?: boolean
}

export default function ExternalLink({ href, label, className, withIcon = false }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {label}
      {withIcon ? (
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
        </svg>
      ) : null}
    </a>
  )
}
