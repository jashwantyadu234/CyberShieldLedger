import { useEffect, useState } from 'react'
import axios from 'axios'
import { Area, AreaChart, Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const COLORS = ['#22d3ee', '#818cf8', '#f59e0b', '#f43f5e', '#34d399', '#a78bfa']
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #64748b', borderRadius: '10px', color: '#f8fafc' }
const tooltipLabelStyle = { color: '#f8fafc', fontWeight: 700 }
const tooltipItemStyle = { color: '#e2e8f0' }
const legendStyle = { color: '#e2e8f0', fontSize: 12 }

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({ total_complaints: 0, high_risk: 0, blockchain_verified: 0, crime_types: 0 })
  const [dailyData, setDailyData] = useState<any[]>([])
  const [crimeDist, setCrimeDist] = useState<any[]>([])
  const [fusion, setFusion] = useState<any>({ risk_distribution: [], status_distribution: [], locations: [], investigator_workload: [], evidence_verification: [], campaigns_detected: 0 })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshError, setRefreshError] = useState('')

  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled([
      axios.get('/api/stats/dashboard'),
      axios.get('/api/admin/analytics/daily-complaints'),
      axios.get('/api/analytics/crime-distribution'),
      axios.get('/api/admin/analytics/fusion-center'),
      ])
      const [statsResponse, dailyResponse, crimeResponse, fusionResponse] = results
      let failures = 0
      if (statsResponse.status === 'fulfilled') setStats(statsResponse.value.data); else failures++
      if (dailyResponse.status === 'fulfilled') setDailyData(dailyResponse.value.data); else failures++
      if (crimeResponse.status === 'fulfilled') setCrimeDist(crimeResponse.value.data); else failures++
      if (fusionResponse.status === 'fulfilled') setFusion(fusionResponse.value.data); else failures++
      setLastUpdated(new Date())
      setRefreshError(failures ? `${failures} dashboard data source${failures === 1 ? '' : 's'} could not refresh.` : '')
    }
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(timer)
  }, [])

  const metrics = [
    { label: 'Total complaints', value: stats.total_complaints, icon: '▤', accent: 'text-cyan-300', note: 'All submitted cases' },
    { label: 'High-risk cases', value: stats.high_risk, icon: '!', accent: 'text-rose-300', note: 'Require priority review' },
    { label: 'Evidence anchored', value: stats.blockchain_verified, icon: '◈', accent: 'text-emerald-300', note: 'On-chain verification' },
    { label: 'Crime categories', value: stats.crime_types, icon: '◌', accent: 'text-violet-300', note: 'Detected by AI' },
  ]

  return (
    <div className="portal-shell admin-dashboard">
      <div className="portal-page space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="portal-eyebrow">Command center / Administration</p>
            <h1 className="portal-title mt-2">Platform intelligence</h1>
            <p className="portal-muted mt-2 max-w-xl">Monitor case volume, system posture, and emerging cybercrime patterns from one secure workspace.</p>
          </div>
          <div className="portal-panel flex items-center gap-3 px-4 py-3">
            <span className="status-pill bg-emerald-500/10 text-emerald-300">System online</span>
            <span className="text-xs text-slate-200">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading live data…'}</span>
          </div>
        </header>

        {refreshError && <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{refreshError} Showing the most recent available data.</p>}

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {metrics.map(metric => <MetricCard key={metric.label} {...metric} />)}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          <div className="portal-panel xl:col-span-3 p-5">
            <div className="flex items-start justify-between mb-5">
              <div><p className="text-sm font-bold text-white">Complaint intake trend</p><p className="text-xs text-slate-200 mt-1">Daily reports recorded by the platform</p></div>
              <span className="status-pill bg-cyan-500/10 text-cyan-300">Live data</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData} margin={{ left: -20, right: 8 }}>
                <defs><linearGradient id="complaintsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={.35} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="date" tick={{ fill: '#cbd5e1', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                <Area type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2.5} fill="url(#complaintsFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="portal-panel xl:col-span-2 p-5">
            <div className="mb-4"><p className="text-sm font-bold text-white">Threat distribution</p><p className="text-xs text-slate-200 mt-1">Reported category mix</p></div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart><Pie data={crimeDist} dataKey="count" nameKey="type" innerRadius={62} outerRadius={98} paddingAngle={3}>
                {crimeDist.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} /><Legend wrapperStyle={legendStyle} /></PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <ChartCard title="AI risk score distribution" subtitle="Cases grouped by triage priority"><BarChart data={fusion.risk_distribution}><XAxis dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} /><Bar dataKey="count" fill="#fb7185" radius={[5, 5, 0, 0]} /></BarChart></ChartCard>
          <ChartCard title="Investigation status" subtitle="Current case lifecycle"><PieChart><Pie data={fusion.status_distribution} dataKey="count" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>{fusion.status_distribution.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} /><Legend wrapperStyle={legendStyle} /></PieChart></ChartCard>
          <ChartCard title="Evidence verification status" subtitle="Preserved evidence across cases"><BarChart data={fusion.evidence_verification} layout="vertical" margin={{ left: 18 }}><XAxis type="number" allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis dataKey="name" type="category" width={130} tick={{ fill: '#e2e8f0', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#34d399" radius={[0, 5, 5, 0]} /></BarChart></ChartCard>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <ChartCard title="Incident location patterns" subtitle="Top reported locations; map-ready when geocoded data is available"><BarChart data={fusion.locations}><XAxis dataKey="location" tick={{ fill: '#e2e8f0', fontSize: 10 }} tickLine={false} axisLine={false} interval={0} /><YAxis allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#818cf8" radius={[5, 5, 0, 0]} /></BarChart></ChartCard>
          <ChartCard title="Investigator workload" subtitle={`${fusion.campaigns_detected} campaign indicator group(s) currently detected`}><BarChart data={fusion.investigator_workload}><XAxis dataKey="officer" tick={{ fill: '#e2e8f0', fontSize: 10 }} tickLine={false} axisLine={false} interval={0} /><YAxis allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="cases" fill="#22d3ee" radius={[5, 5, 0, 0]} /></BarChart></ChartCard>
        </section>

        <section className="portal-panel p-5">
          <div className="flex items-center justify-between mb-5"><div><p className="text-sm font-bold text-white">Service posture</p><p className="text-xs text-slate-200 mt-1">Core capabilities available to the platform</p></div><span className="text-xs text-slate-300">Environment status</span></div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {['API gateway', 'Database', 'AI classification', 'Evidence hashing', 'Blockchain adapter', 'Threat analytics'].map((service, index) => (
              <div key={service} className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-3">
                <span className={`status-pill ${index === 4 ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{index === 4 ? 'Configurable' : 'Online'}</span>
                <p className="text-xs font-semibold text-slate-200 mt-3">{service}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon, accent, note }: { label: string; value?: number; icon: string; accent: string; note: string }) {
  return <div className={`kpi-card ${accent}`}><div className="flex justify-between items-start"><p className="text-xs text-slate-200 font-bold uppercase tracking-wide">{label}</p><span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg">{icon}</span></div><p className="text-3xl text-slate-50 font-extrabold mt-5">{value ?? 0}</p><p className="text-xs text-slate-300 mt-1">{note}</p></div>
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactElement }) {
  return <div className="portal-panel p-5"><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs text-slate-200">{subtitle}</p><div className="mt-4 h-[250px]"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></div>
}
