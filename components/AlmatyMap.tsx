'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DEMO_CONTRACTS, getContractPinColor, getDaysUntilDeadline } from '../lib/contracts'
import Link from 'next/link'

// Fix default icon issue with Next.js
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

const PIN_LABELS = {
  green: 'В срок',
  yellow: 'Риск',
  red: 'Просрочен',
  checkmark: 'Завершён',
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
  return (
    <MapContainer
      center={[43.2551, 76.9126]}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <MapController />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      {DEMO_CONTRACTS.map((contract) => {
        const pinType = getContractPinColor(contract)
        const color = PIN_COLORS[pinType]
        const isOverdue = contract.status === 'penalized'
        const icon = createColoredIcon(color, isOverdue)
        const daysLeft = getDaysUntilDeadline(contract.deadline)

        return (
          <Marker
            key={contract.id}
            position={[contract.lat, contract.lng]}
            icon={icon}
          >
            <Popup
              className="amanat-popup"
              maxWidth={280}
            >
              <div style={{
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: '12px',
                padding: '16px',
                fontFamily: 'system-ui, sans-serif',
                minWidth: '240px',
              }}>
                <div style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: color + '20',
                  color: color,
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  border: `1px solid ${color}50`,
                }}>
                  {PIN_LABELS[pinType]}
                </div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '6px', lineHeight: 1.4 }}>
                  {contract.title}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>
                  {contract.contractor}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '12px' }}>
                  {daysLeft < 0
                    ? <span style={{ color: '#f87171' }}>Просрочен на {Math.abs(daysLeft)} дн.</span>
                    : <span style={{ color: daysLeft < 7 ? '#fbbf24' : '#9ca3af' }}>{daysLeft} дн. до дедлайна</span>
                  }
                </div>
                <a
                  href={`/contracts/${contract.id}`}
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
                  Подробнее →
                </a>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
