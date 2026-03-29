'use client'

interface AmaniMascotProps {
  size?: number
  mood?: 'happy' | 'thinking' | 'waving' | 'surprised'
  className?: string
}

export default function AmaniMascot({ size = 120, mood = 'happy', className = '' }: AmaniMascotProps) {
  const eyeY = mood === 'surprised' ? 38 : 40
  const mouthD = mood === 'happy'
    ? 'M 40 52 Q 50 60 60 52'
    : mood === 'surprised'
    ? 'M 46 54 Q 50 58 54 54'
    : mood === 'thinking'
    ? 'M 42 54 Q 50 52 56 54'
    : 'M 40 52 Q 50 60 60 52'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Ears */}
      <path d="M 22 28 L 16 8 L 34 22 Z" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M 78 28 L 84 8 L 66 22 Z" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M 24 26 L 20 12 L 32 23 Z" fill="#fce7f3" />
      <path d="M 76 26 L 80 12 L 68 23 Z" fill="#fce7f3" />

      {/* Head */}
      <ellipse cx="50" cy="48" rx="32" ry="30" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />

      {/* Spots */}
      <circle cx="28" cy="36" r="3" fill="#d1d5db" />
      <circle cx="35" cy="28" r="2.5" fill="#d1d5db" />
      <circle cx="72" cy="36" r="3" fill="#d1d5db" />
      <circle cx="65" cy="28" r="2.5" fill="#d1d5db" />
      <circle cx="30" cy="52" r="2" fill="#d1d5db" />
      <circle cx="70" cy="52" r="2" fill="#d1d5db" />
      <circle cx="42" cy="24" r="2" fill="#d1d5db" />
      <circle cx="58" cy="24" r="2" fill="#d1d5db" />

      {/* Muzzle */}
      <ellipse cx="50" cy="50" rx="14" ry="10" fill="#f3f4f6" />

      {/* Eyes */}
      <ellipse cx="38" cy={eyeY} rx={mood === 'surprised' ? 4.5 : 4} ry={mood === 'surprised' ? 5 : 4.5} fill="#1f2937" />
      <ellipse cx="62" cy={eyeY} rx={mood === 'surprised' ? 4.5 : 4} ry={mood === 'surprised' ? 5 : 4.5} fill="#1f2937" />
      {/* Eye highlights */}
      <circle cx="36" cy={eyeY - 1.5} r="1.5" fill="white" />
      <circle cx="60" cy={eyeY - 1.5} r="1.5" fill="white" />

      {/* Nose */}
      <ellipse cx="50" cy="47" rx="3.5" ry="2.5" fill="#9ca3af" />
      <ellipse cx="50" cy="46.5" rx="1.5" ry="1" fill="#d1d5db" opacity="0.5" />

      {/* Mouth */}
      <path d={mouthD} stroke="#6b7280" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Whiskers */}
      <line x1="18" y1="46" x2="35" y2="48" stroke="#9ca3af" strokeWidth="0.8" />
      <line x1="18" y1="50" x2="35" y2="50" stroke="#9ca3af" strokeWidth="0.8" />
      <line x1="65" y1="48" x2="82" y2="46" stroke="#9ca3af" strokeWidth="0.8" />
      <line x1="65" y1="50" x2="82" y2="50" stroke="#9ca3af" strokeWidth="0.8" />

      {/* Waving hand */}
      {mood === 'waving' && (
        <g className="animate-wave origin-bottom-right">
          <circle cx="82" cy="68" r="6" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.2" />
          <circle cx="82" cy="62" r="2" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="0.8" />
          <circle cx="85" cy="64" r="2" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="0.8" />
          <circle cx="79" cy="64" r="2" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="0.8" />
        </g>
      )}

      {/* Tail hint */}
      <path d="M 78 72 Q 90 65 88 78 Q 86 88 78 85" stroke="#d1d5db" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="80" cy="76" r="1.5" fill="#9ca3af" opacity="0.5" />
    </svg>
  )
}
