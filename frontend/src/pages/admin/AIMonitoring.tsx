import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AIMonitoring() {
  const [monitoring, setMonitoring] = useState<any>({})
  const [accuracyData, setAccuracyData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [chartError, setChartError] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  useEffect(() => {
    const load = async () => {
      const [mon, acc] = await Promise.allSettled([
      axios.get('/api/admin/ai/monitoring'),
      axios.get('/api/admin/ai/accuracy')
      ])
      let failed = 0
      if (mon.status === 'fulfilled') setMonitoring(mon.value.data); else failed++
      if (acc.status === 'fulfilled') setAccuracyData(acc.value.data || []); else failed++
      setRefreshError(failed ? `${failed} live data source${failed === 1 ? '' : 's'} could not refresh.` : '')
      setLoading(false)
    }
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(timer)
  }, [])

  // Try to load recharts
  const [BarChart, setBarChart] = useState<any>(null)
  const [Bar, setBar] = useState<any>(null)
  const [XAxis, setXAxis] = useState<any>(null)
  const [YAxis, setYAxis] = useState<any>(null)
  const [Tooltip, setTooltip] = useState<any>(null)
  const [ResponsiveContainer, setResponsiveContainer] = useState<any>(null)

  useEffect(() => {
    import('recharts').then(mod => {
      setBarChart(() => mod.BarChart)
      setBar(() => mod.Bar)
      setXAxis(() => mod.XAxis)
      setYAxis(() => mod.YAxis)
      setTooltip(() => mod.Tooltip)
      setResponsiveContainer(() => mod.ResponsiveContainer)
    }).catch(() => setChartError(true))
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full mx-auto" />
      </div>
    )
  }

  return (
    <div className="portal-shell"><div className="portal-page max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-amber-300 mb-2">🤖 AI Monitoring</h1>
      <p className="text-slate-200 mb-2">Live processing metrics from submitted complaints · refreshes every 15 seconds</p>
      <p className="text-xs text-slate-300 mb-8">{monitoring.updated_at ? `Last backend update: ${new Date(monitoring.updated_at).toLocaleString()}` : 'Waiting for backend data…'}</p>
      {refreshError && <p className="mb-5 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{refreshError} Showing the latest available results.</p>}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Processed', value: monitoring.total_processed, color: 'text-cyan-300' },
          { label: 'Success Rate', value: `${monitoring.success_rate ?? 0}%`, color: 'text-emerald-300' },
          { label: 'Awaiting classification', value: monitoring.failed ?? 0, color: 'text-rose-300' },
          { label: 'Avg Risk Score', value: monitoring.avg_risk_score ?? 0, color: 'text-amber-300' },
        ].map(s => (
          <div key={s.label} className="portal-panel p-4">
            <p className="text-slate-200 text-sm font-semibold">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value ?? '...'}</p>
          </div>
        ))}
      </div>

      {/* Accuracy Section */}
      <div className="portal-panel p-6 mb-8">
        <h2 className="text-lg font-bold text-white mb-1">🎯 Classification coverage</h2>
        <p className="text-sm text-slate-200 mb-4">A live view of reports classified by the AI pipeline. Accuracy requires independently reviewed labels.</p>
        
        {chartError || !BarChart ? (
          // Fallback table
          <div className="space-y-2">
            {accuracyData.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg">
                <span className="font-medium text-slate-100">{item.type}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-200">{item.count} cases</span>
                  <span className="text-sm font-bold text-emerald-300">{item.coverage}% classified</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={accuracyData}>
                <XAxis dataKey="type" tick={{ fill: '#e2e8f0', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#cbd5e1', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #64748b', color: '#f8fafc' }} labelStyle={{ color: '#f8fafc' }} itemStyle={{ color: '#e2e8f0' }} />
                <Bar dataKey="coverage" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Config */}
      <div className="portal-panel p-6">
        <h2 className="text-lg font-bold text-white mb-4">⚙️ Pipeline status</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            ['Records in system', String((monitoring.total_processed || 0) + (monitoring.failed || 0))],
            ['Classified by AI', String(monitoring.total_processed || 0)],
            ['Awaiting classification', String(monitoring.failed || 0)],
            ['Average risk score', String(monitoring.avg_risk_score ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-950 p-3 rounded-lg">
              <p className="text-xs text-slate-300">{label}</p>
              <p className="font-medium text-slate-50">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div></div>
  )
}
