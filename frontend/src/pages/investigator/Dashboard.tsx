import { useEffect, useState } from 'react'
import axios from 'axios'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Link } from 'react-router-dom'

const COLORS = ['#22d3ee', '#818cf8', '#f59e0b', '#f43f5e', '#34d399', '#a78bfa']
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #334155', borderRadius: '10px' }

export default function InvestigatorDashboard() {
  const [stats, setStats] = useState<any>({})
  const [crimeTypes, setCrimeTypes] = useState<any[]>([])
  const [recentComplaints, setRecentComplaints] = useState<any[]>([])

  useEffect(() => {
    void Promise.all([
      axios.get('/api/investigator/dashboard'),
      axios.get('/api/investigator/crime-types'),
      axios.get('/api/investigator/complaints?limit=8'),
    ]).then(([statsResponse, crimeResponse, complaintsResponse]) => {
      setStats(statsResponse.data)
      setCrimeTypes(crimeResponse.data)
      setRecentComplaints(complaintsResponse.data.complaints || [])
    })
  }, [])

  const metrics = [
    { label: 'Case intake', value: stats.total_complaints, accent: 'text-cyan-300', caption: 'Total reports' },
    { label: 'Awaiting review', value: stats.pending_review, accent: 'text-amber-300', caption: 'Pending triage' },
    { label: 'Active investigations', value: stats.under_investigation, accent: 'text-violet-300', caption: 'In progress' },
    { label: 'High-risk alerts', value: stats.high_risk, accent: 'text-rose-300', caption: 'Risk score ≥ 70' },
  ]

  const extendedMetrics = [
    { label: 'Blockchain anchored', value: stats.blockchain_verified, icon: '⛓️', accent: 'text-emerald-300', caption: 'On-chain verified' },
    { label: 'Crypto signed', value: stats.crypto_signed, icon: '🔑', accent: 'text-purple-300', caption: 'User-held key signed' },
    { label: 'Resolved', value: stats.resolved, icon: '✅', accent: 'text-green-300', caption: 'Cases closed' },
    { label: 'Last 7 days', value: stats.recent_7_days, icon: '📊', accent: 'text-cyan-300', caption: 'New reports' },
  ]

  return (
    <div className="portal-shell">
      <div className="portal-page space-y-6">
        <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div><p className="portal-eyebrow">Case operations / Investigator</p><h1 className="portal-title mt-2">Investigation workspace</h1><p className="portal-muted mt-2">Prioritize high-risk reports, investigate linked indicators, and maintain an auditable case record.</p></div>
          <div className="flex flex-wrap gap-2"><ActionLink to="/investigator/queue?status=Pending" label="Review queue" primary /><ActionLink to="/investigator/intelligence" label="Case intelligence" /><ActionLink to="/investigator/threat-graph" label="Threat graph" /></div>
        </header>

        <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">{metrics.map(metric => <MetricCard key={metric.label} {...metric} />)}</section>
        
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">{extendedMetrics.map(metric => <ExtendedMetricCard key={metric.label} {...metric} />)}</section>

        <section className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          <div className="portal-panel xl:col-span-2 p-5"><div className="flex justify-between items-center"><div><p className="text-sm font-bold text-white">Threat categories</p><p className="text-xs text-slate-400 mt-1">AI-classified case distribution</p></div><span className="status-pill bg-cyan-500/10 text-cyan-300">AI assisted</span></div><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={crimeTypes} dataKey="count" nameKey="type" innerRadius={58} outerRadius={94} paddingAngle={3}>{crimeTypes.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div>
          <div className="portal-panel xl:col-span-3 p-5"><div className="flex justify-between items-center mb-5"><div><p className="text-sm font-bold text-white">Triage status</p><p className="text-xs text-slate-400 mt-1">Current workload across all reported cases</p></div><Link to="/investigator/queue" className="text-xs text-cyan-300 hover:text-cyan-200 font-bold">Open full queue →</Link></div><div className="space-y-5"><Progress label="Pending review" count={stats.pending_review || 0} total={stats.total_complaints || 1} color="bg-amber-400" /><Progress label="Under investigation" count={stats.under_investigation || 0} total={stats.total_complaints || 1} color="bg-violet-400" /><Progress label="Resolved" count={stats.resolved || 0} total={stats.total_complaints || 1} color="bg-emerald-400" /><Progress label="Evidence anchored" count={stats.blockchain_verified || 0} total={stats.total_complaints || 1} color="bg-cyan-400" /></div></div>
        </section>

        <section className="portal-panel overflow-hidden"><div className="p-5 flex items-center justify-between border-b border-slate-700/70"><div><p className="text-sm font-bold text-white">Recent case intake</p><p className="text-xs text-slate-400 mt-1">Newest reports requiring operational awareness</p></div><Link to="/investigator/queue" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">View all cases</Link></div><div className="divide-y divide-slate-800">
          {recentComplaints.length === 0 ? <p className="p-10 text-center text-slate-500">No complaints have been submitted yet.</p> : recentComplaints.map((complaint: any) => <CaseRow key={complaint.id} complaint={complaint} />)}
        </div></section>
      </div>
    </div>
  )
}

function MetricCard({ label, value, accent, caption }: { label: string; value?: number; accent: string; caption: string }) { return <div className={`kpi-card ${accent}`}><p className="text-xs uppercase tracking-wide font-semibold text-slate-400">{label}</p><p className="text-3xl font-extrabold text-slate-50 mt-5">{value ?? '—'}</p><p className="text-xs text-slate-500 mt-1">{caption}</p></div> }
function ExtendedMetricCard({ label, value, icon, accent, caption }: { label: string; value?: number; icon: string; accent: string; caption: string }) { return <div className={`kpi-card ${accent}`}><div className="flex justify-between items-start"><p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{label}</p><span className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-lg">{icon}</span></div><p className="text-3xl text-slate-50 font-extrabold mt-5">{value ?? '—'}</p><p className="text-xs text-slate-500 mt-1">{caption}</p></div> }
function Progress({ label, count, total, color }: { label: string; count: number; total: number; color: string }) { const percentage = Math.min(100, Math.round(count / total * 100)); return <div><div className="flex justify-between text-sm mb-2"><span className="text-slate-200 font-medium">{label}</span><span className="text-slate-400">{count} · {percentage}%</span></div><div className="h-2 rounded-full bg-slate-950 overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} /></div></div> }
function ActionLink({ to, label, primary = false }: { to: string; label: string; primary?: boolean }) { return <Link to={to} className={primary ? 'rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2.5 text-sm font-extrabold shadow-lg shadow-cyan-900/30' : 'rounded-xl border border-slate-600 hover:border-slate-400 bg-slate-900/60 text-slate-100 px-4 py-2.5 text-sm font-bold'}>{label} →</Link> }
function CaseRow({ complaint }: { complaint: any }) { const risk = complaint.risk_score || 0; const riskClass = risk >= 70 ? 'bg-rose-400' : risk >= 40 ? 'bg-amber-400' : 'bg-emerald-400'; return <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:px-5 hover:bg-slate-800/45"><div className={`w-1.5 h-12 rounded-full ${riskClass}`} /><div className="min-w-0 flex-1"><p className="font-bold text-slate-100 truncate">#{complaint.id} · {complaint.title}</p><p className="text-sm text-slate-400 mt-1 truncate">{complaint.crime_type || 'Unclassified'} · {complaint.citizen_name || 'Unknown reporter'} · {complaint.created_at?.slice(0, 10)}</p></div><div className="flex items-center gap-3"><span className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200">Risk {risk}</span><Link to={`/investigator/queue?search=${encodeURIComponent(complaint.id)}`} className="text-sm font-bold text-cyan-300 hover:text-cyan-200">Inspect →</Link></div></div> }
