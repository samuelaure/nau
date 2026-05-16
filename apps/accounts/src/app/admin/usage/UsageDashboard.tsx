'use client'

import { useState } from 'react'
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react'
import Link from 'next/link'

type Bucket = { count: number; costUsd: number; tokens: number }
type ServiceBucket = Bucket & { service: string }
type OperationBucket = Bucket & { operation: string }
type WorkspaceBucket = Bucket & { id: string; name: string }
type BrandBucket = Bucket & { id: string; name: string; workspaceId?: string }
type UserBucket = Bucket & { id: string; name: string }

export interface UsageSummary {
  count: number
  totalCostUsd: number
  totalTokens: number
  byService: ServiceBucket[]
  byOperation: OperationBucket[]
  byWorkspace: WorkspaceBucket[]
  byBrand: BrandBucket[]
  byUser: UserBucket[]
}

interface Props {
  initialData: UsageSummary | null
  accessToken: string
  apiUrl: string
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 1)}M`
  if (n >= 1_000) return `${fmt(n / 1_000, 1)}K`
  return String(n)
}

function BucketTable<T extends Bucket>({
  title,
  rows,
  labelKey,
  labelHeader,
}: {
  title: string
  rows: T[]
  labelKey: keyof T
  labelHeader: string
}) {
  const sorted = [...rows].sort((a, b) => b.costUsd - a.costUsd)
  return (
    <div className="bg-panel border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-secondary border-b border-border">
            <th className="text-left px-5 py-2 font-medium">{labelHeader}</th>
            <th className="text-right px-5 py-2 font-medium">Calls</th>
            <th className="text-right px-5 py-2 font-medium">Tokens</th>
            <th className="text-right px-5 py-2 font-medium">Cost (USD)</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center px-5 py-4 text-text-secondary text-xs">No data</td>
            </tr>
          ) : sorted.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02] transition-colors">
              <td className="px-5 py-2.5 text-white font-medium truncate max-w-[200px]">{String(row[labelKey])}</td>
              <td className="px-5 py-2.5 text-right text-text-secondary">{row.count.toLocaleString()}</td>
              <td className="px-5 py-2.5 text-right text-text-secondary">{fmtTokens(row.tokens)}</td>
              <td className="px-5 py-2.5 text-right text-accent font-mono">${fmt(row.costUsd, 4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function UsageDashboard({ initialData, accessToken, apiUrl }: Props) {
  const [data, setData] = useState<UsageSummary | null>(initialData)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)

  async function load(d: number) {
    setLoading(true)
    try {
      const from = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString()
      const res = await fetch(`${apiUrl}/admin/usage/summary?from=${from}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  function selectPreset(d: number) {
    setDays(d)
    load(d)
  }

  return (
    <div className="min-h-screen bg-background text-white p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-text-secondary hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Token Usage</h1>
          <p className="text-xs text-text-secondary mt-0.5">LLM consumption by workspace, brand, and operation</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => selectPreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${days === p.days ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary hover:text-white'}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => load(days)}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/5 text-text-secondary hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {!data ? (
        <div className="text-center py-20 text-text-secondary text-sm">No data available.</div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total LLM Calls', value: data.count.toLocaleString() },
              { label: 'Total Tokens', value: fmtTokens(data.totalTokens) },
              { label: 'Total Cost', value: `$${fmt(data.totalCostUsd, 4)}` },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-panel border border-border rounded-2xl p-5">
                <div className="text-xs text-text-secondary mb-1">{kpi.label}</div>
                <div className="text-2xl font-semibold text-white">{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <BucketTable title="By Service" rows={data.byService} labelKey="service" labelHeader="Service" />
            <BucketTable title="By Operation" rows={data.byOperation} labelKey="operation" labelHeader="Operation" />
          </div>

          <BucketTable title="By Workspace" rows={data.byWorkspace} labelKey="name" labelHeader="Workspace" />
          <BucketTable title="By Brand" rows={data.byBrand} labelKey="name" labelHeader="Brand" />

          {data.byUser.length > 0 && (
            <BucketTable title="By User" rows={data.byUser} labelKey="name" labelHeader="User" />
          )}
        </>
      )}
    </div>
  )
}
