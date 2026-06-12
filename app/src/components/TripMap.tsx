'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'

interface GpsPoint {
  lat: number
  lng: number
  speed: number
  timestamp: number
}

interface TripMapProps {
  points: GpsPoint[]
  tk: string
}

export default function TripMap({ points, tk }: TripMapProps) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!points?.length || !mapEl.current) return

    const map = L.map(mapEl.current).setView(
      [points[0].lat, points[0].lng], 14
    )

    // Tianditu tile layer with OpenStreetMap fallback
    const addTileLayers = (key: string) => {
      if (key) {
        L.tileLayer(`https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${key}`, {
          subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
          maxZoom: 18,
          attribution: '© 天地图',
        }).addTo(map)
        L.tileLayer(`https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${key}`, {
          subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
          maxZoom: 18,
        }).addTo(map)
      } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map)
      }
    }
    addTileLayers(tk)

    // Draw route with speed-based colors
    const routePoints = points.map(p => [p.lat, p.lng] as [number, number])
    const polyline = L.polyline(routePoints, { color: '#2563EB', weight: 4, opacity: 0.7 }).addTo(map)

    // Start marker (green)
    const start = points[0]
    L.circleMarker([start.lat, start.lng], { radius: 8, color: '#10B981', fillColor: '#10B981', fillOpacity: 1 }).addTo(map)
      .bindPopup('<b>起点</b><br/>' + new Date(start.timestamp).toLocaleString('zh-CN'))

    // End marker (red)
    const end = points[points.length - 1]
    L.circleMarker([end.lat, end.lng], { radius: 8, color: '#EF4444', fillColor: '#EF4444', fillOpacity: 1 }).addTo(map)
      .bindPopup('<b>终点</b><br/>' + new Date(end.timestamp).toLocaleString('zh-CN'))

    map.fitBounds(polyline.getBounds().pad(0.1))
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, [points, tk])

  return <div ref={mapEl} className="h-[500px] w-full" />
}
