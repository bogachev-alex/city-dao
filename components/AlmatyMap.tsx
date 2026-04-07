'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { useConnection } from '@solana/wallet-adapter-react'
import { Contract, getContractPinColor, getDaysUntilDeadline, normalizeContract, DEMO_CONTRACTS, getContractDetailHref } from '@/lib/contracts'
import { mergeContractsWithOnChain } from '@/lib/mergeContractsOnChain'
import { fetchContracts } from '@/lib/api'
import { useDataSource } from '@/lib/web3/useDataSource'
import { fetchAllContractsOnChain } from '@/lib/web3/onchain'
import { useTheme } from './ThemeProvider'

/** Spread markers that share the same rounded lat/lng so every contract stays visible. */
function mapPinsWithSpread(contracts: Contract[]): { contract: Contract; position: [number, number] }[] {
  const bucketKey = (c: Contract) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`
  const counts = new Map<string, number>()
  for (const c of contracts) {
    const k = bucketKey(c)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const indexInBucket = new Map<string, number>()
  return contracts.map((contract) => {
    const k = bucketKey(contract)
    const total = counts.get(k) ?? 1
    const idx = indexInBucket.get(k) ?? 0
    indexInBucket.set(k, idx + 1)
    if (total <= 1 || idx === 0) {
      return { contract, position: [contract.lat, contract.lng] as [number, number] }
    }
    const angle = (2 * Math.PI * idx) / total
    const r = 0.00028 * idx
    return {
      contract,
      position: [contract.lat + Math.cos(angle) * r, contract.lng + Math.sin(angle) * r] as [number, number],
    }
  })
}

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const PIN_COLORS = {
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  checkmark: '#3b82f6',
}

function createColoredIcon(color: string, isOverdue: boolean = false) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${color}" flood-opacity="0.5"/>
        </filter>
      </defs>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24S32 26 32 16C32 7.163 24.837 0 16 0z" fill="${color}" filter="url(#shadow)"/>
      <circle cx="16" cy="16" r="7" fill="white" opacity="0.95"/>
      <circle cx="16" cy="16" r="4" fill="${color}"/>
      ${isOverdue ? `<circle cx="16" cy="16" r="12" fill="${color}" opacity="0.2"><animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite"/></circle>` : ''}
    </svg>
  `
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  })
}

function MapController() {
  const map = useMap()
  useEffect(() => {
    map.setView([43.2551, 76.9126], 12)
  }, [map])
  return null
}

export default function AlmatyMap() {
  const t = useTranslations('components.almatyMap')
  const locale = useLocale()
  const dataSource = useDataSource()
  const { connection } = useConnection()
  const connectionRef = useRef(connection)
  connectionRef.current = connection
  const [contracts, setContracts] = useState<Contract[]>([])
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const PIN_LABELS = {
    green: t('onTime'),
    yellow: t('risk'),
    red: t('overdue'),
    checkmark: t('completed'),
  }

  const markers = useMemo(
    () => mapPinsWithSpread(contracts.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))),
    [contracts]
  )

  useEffect(() => {
    let cancelled = false
    const conn = connectionRef.current

    async function load() {
      // Same as /contracts: Postgres (goszakup seed, admin) is the registry; Solana overlays state.
      // Pure on-chain list only when the DB returns no rows.
      if (dataSource === 'onchain') {
        try {
          const data: unknown = await fetchContracts()
          if (cancelled) return
          if (Array.isArray(data) && data.length > 0) {
            const normalized = data.map(normalizeContract)
            setContracts(await mergeContractsWithOnChain(normalized, conn))
            return
          }
          const onChain = await fetchAllContractsOnChain(conn)
          if (!cancelled) {
            setContracts(onChain.length > 0 ? onChain : DEMO_CONTRACTS)
          }
        } catch {
          if (!cancelled) setContracts(DEMO_CONTRACTS)
        }
        return
      }

      try {
        const data: unknown = await fetchContracts()
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          const normalized = data.map(normalizeContract)
          setContracts(await mergeContractsWithOnChain(normalized, conn))
        } else {
          setContracts(await mergeContractsWithOnChain(DEMO_CONTRACTS, conn))
        }
      } catch {
        if (!cancelled) {
          setContracts(await mergeContractsWithOnChain(DEMO_CONTRACTS, conn))
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [dataSource])

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

  return (
    <MapContainer
      center={[43.2551, 76.9126]}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <MapController />
      <TileLayer
        key={theme}
        url={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      {markers.map(({ contract, position }) => {
        const pinType = getContractPinColor(contract)
        const color = PIN_COLORS[pinType]
        const isOverdue = contract.status === 'penalized'
        const icon = createColoredIcon(color, isOverdue)
        const daysLeft = getDaysUntilDeadline(contract.deadline)

        return (
          <Marker
            key={contract.id}
            position={position}
            icon={icon}
          >
            <Popup className="straita-popup" maxWidth={280}>
              <div style={{
                background: isDark ? '#111827' : '#ffffff',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                borderRadius: '12px',
                padding: '16px',
                fontFamily: 'system-ui, sans-serif',
                minWidth: '240px',
                boxShadow: isDark ? '0 25px 50px -12px rgba(0,0,0,0.8)' : '0 4px 12px rgba(0,0,0,0.08)',
              }}>
                <div style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: color + (isDark ? '20' : '15'),
                  color: color,
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  border: `1px solid ${color}${isDark ? '50' : '30'}`,
                }}>
                  {PIN_LABELS[pinType]}
                </div>
                <div style={{ color: isDark ? '#fff' : '#111827', fontWeight: 600, fontSize: '14px', marginBottom: '6px', lineHeight: 1.4 }}>
                  {contract.title}
                </div>
                {contract.registryNumber && (
                  <div style={{ color: isDark ? '#6ee7b7' : '#059669', fontSize: '11px', fontFamily: 'ui-monospace, monospace', marginBottom: '4px' }}>
                    ЕГЗ №{contract.registryNumber}
                  </div>
                )}
                <div style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
                  {contract.contractor}
                </div>
                {contract.customerName && (
                  <div style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: '11px', marginBottom: '4px', lineHeight: 1.35 }}>
                    {contract.customerName.length > 80 ? `${contract.customerName.slice(0, 80)}…` : contract.customerName}
                  </div>
                )}
                <div style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: '12px', marginBottom: '12px' }}>
                  {daysLeft < 0
                    ? <span style={{ color: isDark ? '#f87171' : '#ef4444' }}>{t('overdueBy', { days: Math.abs(daysLeft) })}</span>
                    : <span style={{ color: daysLeft < 7 ? (isDark ? '#fbbf24' : '#d97706') : (isDark ? '#9ca3af' : '#6b7280') }}>{t('daysUntilDeadline', { days: daysLeft })}</span>
                  }
                </div>
                <a
                  href={`/${locale}${getContractDetailHref(contract.id, contract.onChainPubkey)}`}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '8px 16px',
                    background: '#10b981',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  {t('details')}
                </a>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
