import { useEffect, useState } from 'react'
import axios from 'axios'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'

// Import all pages
import RegisterComplaint from './pages/citizen/RegisterComplaint'
import TrackComplaint from './pages/citizen/TrackComplaint'
import ScamChecker from './pages/citizen/ScamChecker'
import SafetyAwareness from './pages/citizen/SafetyAwareness'
import ComplaintQueue from './pages/investigator/ComplaintQueue'
import ThreatGraph from './pages/investigator/ThreatGraph'
import BlockchainVerify from './pages/investigator/BlockchainVerify'
import CaseIntelligence from './pages/investigator/CaseIntelligence'
import InvestigatorTool from './pages/investigator/InvestigatorTool'
import CaseReport from './pages/investigator/CaseReport'
import AdminApp from './components/layout/AdminApp'
import AdminDashboard from './pages/admin/Dashboard'
import UserManagement from './pages/admin/UserManagement'
import UserApprovals from './pages/admin/UserApprovals'
import InvestigatorManagement from './pages/admin/InvestigatorManagement'
import AgencyManagement from './pages/admin/AgencyManagement'
import AIMonitoring from './pages/admin/AIMonitoring'
import ThreatIntelligence from './pages/admin/ThreatIntelligence'
import AdminSettings from './pages/admin/Settings'
import Operations from './pages/admin/Operations'
import Governance from './pages/admin/Governance'
import InvestigatorApprovals from './pages/admin/InvestigatorApprovals'

// 👇 NEW: Import login pages
import CitizenLogin from './pages/auth/CitizenLogin'
import InvestigatorLogin from './pages/auth/InvestigatorLogin'
import AdminLogin from './pages/auth/AdminLogin'

// ============================================================
// PORTAL CONFIG
// ============================================================
const portals = [
  {
    id: 'citizen',
    name: 'Citizen',
    icon: '👤',
    gradient: 'from-cyan-500 to-blue-600',
    activeBg: 'bg-cyan-600/20',
    activeBorder: 'border-cyan-500',
    glow: 'shadow-cyan-500/30',
    textColor: 'text-cyan-400',
    links: [
      { path: '/citizen', label: 'Home', exact: true },
      { path: '/citizen/register', label: 'File complaint' },
      { path: '/citizen/track', label: 'Track case' },
      { path: '/citizen/scam-check', label: 'Scam check' },
      { path: '/citizen/safety', label: 'Safety tips' },
    ]
  },
  {
    id: 'investigator',
    name: 'Investigator',
    icon: '🕵️',
    gradient: 'from-purple-500 to-pink-600',
    activeBg: 'bg-purple-600/20',
    activeBorder: 'border-purple-500',
    glow: 'shadow-purple-500/30',
    textColor: 'text-purple-400',
    links: [
      { path: '/investigator', label: 'AI Brief', exact: true },
      { path: '/investigator/queue', label: 'Case review' },
      { path: '/investigator/threat-graph', label: 'Threat Graph' },
      { path: '/investigator/evidence', label: 'Evidence Viewer' },
      { path: '/investigator/financial-flow', label: 'Financial Flow' },
      { path: '/investigator/notes', label: 'Investigation Notes' },
      { path: '/investigator/case-report', label: '⚖️ Court Report' },
    ]
  },
  {
    id: 'admin',
    name: 'Admin',
    icon: '⚙️',
    gradient: 'from-amber-500 to-red-600',
    activeBg: 'bg-amber-600/20',
    activeBorder: 'border-amber-500',
    glow: 'shadow-amber-500/30',
    textColor: 'text-amber-400',
    links: [
      { path: '/admin', label: 'Dashboard', exact: true },
      { path: '/admin/users', label: 'Users' },
      { path: '/admin/complaints', label: 'Case review' },
      { path: '/admin/investigator-approvals', label: 'Approvals' },
      { path: '/admin/agencies', label: 'Agencies' },
      { path: '/admin/ai', label: 'AI monitor' },
      { path: '/admin/threats', label: 'Threat intelligence' },
      { path: '/admin/settings', label: 'Settings' },
      { path: '/admin/operations', label: 'Operations' },
      { path: '/admin/governance', label: 'Governance' },
    ]
  }
]

const liveAlerts = [
  { severity: 'critical', category: 'Syndicate match', message: 'Cross-state phone +91 98765 99999 linked to 4 open victim dockets', age: '8m ago' },
  { severity: 'high', category: 'UPI watch', message: 'New beneficiary handle reported across 3 payment-fraud complaints', age: '14m ago' },
  { severity: 'medium', category: 'Phishing campaign', message: 'Credential-harvesting domain pattern detected in recent submissions', age: '21m ago' },
  { severity: 'low', category: 'Evidence ledger', message: 'All newly submitted evidence files passed integrity verification', age: '32m ago' },
] as const

function LiveTicker() {
  const [activeAlert, setActiveAlert] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [isManuallyPaused, setIsManuallyPaused] = useState(false)
  const isPaused = isHovering || isManuallyPaused

  useEffect(() => {
    if (isPaused) return
    const timer = window.setInterval(() => setActiveAlert(current => (current + 1) % liveAlerts.length), 6500)
    return () => window.clearInterval(timer)
  }, [isPaused])

  const alert = liveAlerts[activeAlert]
  const selectAlert = (index: number) => {
    setActiveAlert(index)
    setIsManuallyPaused(true)
  }

  return (
    <div className="command-ticker" aria-label="Live security alerts" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      <span className="ticker-label"><span className="ticker-signal" />LIVE ALERTS</span>
      <div className="ticker-alert" aria-live="polite">
        <span className={`ticker-severity ${alert.severity}`}>{alert.category}</span>
        <span className="ticker-message">{alert.message}</span>
      </div>
      <time className="ticker-time">{alert.age}</time>
      <div className="ticker-controls" aria-label="Ticker controls">
        <div className="ticker-dots" role="tablist" aria-label="Select an alert">
          {liveAlerts.map((item, index) => <button key={item.category} type="button" role="tab" aria-selected={activeAlert === index} aria-label={`Show ${item.category} alert`} className={activeAlert === index ? 'active' : ''} onClick={() => selectAlert(index)} />)}
        </div>
        <button type="button" className="ticker-pause" onClick={() => setIsManuallyPaused(current => !current)} aria-label={isManuallyPaused ? 'Resume alert rotation' : 'Pause alert rotation'}>{isManuallyPaused ? '▶' : 'Ⅱ'}</button>
      </div>
    </div>
  )
}

// ============================================================
// GLOBAL NAVBAR
// ============================================================
function GlobalNavbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPortal = portals.find(p => location.pathname.startsWith(`/${p.id}`))

  // Hide navbar on login pages
  if (location.pathname.startsWith('/login')) return null

  if (location.pathname === '/') {
    return (
      <header className="command-header">
        <div className="command-header-main">
          <a className="command-brand" href="/" aria-label="CyberShield home">
            <span className="command-shield"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.8 20 6v5.7c0 4.8-3.1 8.5-8 9.5-4.9-1-8-4.7-8-9.5V6l8-3.2Z" stroke="currentColor" strokeWidth="1.9"/><path d="M8.7 12.1 11 14.4l4.6-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            <span><strong>Cyber<span>Shield</span></strong><small>National Cybercrime Command System</small></span>
            <em>V2.0 AI</em>
          </a>
          <label className="command-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="5.4" stroke="currentColor" strokeWidth="1.8"/><path d="m15 15 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><input aria-label="Search CyberShield" placeholder="Search complaint, hash, phone..."/><kbd>⌘K</kbd></label>
          <nav className="command-actions"><a href="/login">Sign In</a><a className="command-file" href="/login/citizen"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 10V8a6.5 6.5 0 0 1 13 0v2M5 10h14v10H5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 14v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>File Complaint</a></nav>
        </div>
        <LiveTicker />
      </header>
    )
  }

  return (
    <header className="ledger-header sticky top-0 z-50">
      <div className="ledger-header-main">
        <div className="ledger-brand">
          <svg className="ledger-chainmark" viewBox="0 0 34 22" fill="none" aria-hidden="true">
            <rect x="1" y="6" width="9" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <rect className="ledger-chainmark-accent" x="12.5" y="3" width="9" height="10" rx="2" strokeWidth="1.6" />
            <rect x="24" y="6" width="9" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <line x1="10" y1="11" x2="12.5" y2="8" stroke="#8592AB" strokeWidth="1.4" />
            <line x1="21.5" y1="8" x2="24" y2="11" stroke="#8592AB" strokeWidth="1.4" />
          </svg>
          <div>
            <h1>CyberShield Ledger</h1>
            <p>Complaint intake · AI triage · evidence chain</p>
          </div>
        </div>

          <nav className="ledger-rolebar" aria-label="Portal selection">
            {portals.map(p => {
              const isActive = location.pathname.startsWith(`/${p.id}`)
              return (
                <NavLink
                  key={p.id}
                  to={`/login/${p.id}`}
                  className={`ledger-role ${isActive ? 'active' : ''}`}
                >
                  {p.name}
                </NavLink>
              )
            })}
          </nav>
          <div className="flex items-center gap-3"><div className="ledger-integrity"><span />Integrity controls active</div>{localStorage.getItem('token') && <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/') }} className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-400 hover:text-cyan-200">Log out</button>}</div>
      </div>

    </header>
  )
}

function PortalSidebar() {
  const location = useLocation()
  const portal = portals.find(item => location.pathname.startsWith(`/${item.id}`))
  if (!portal) return null

  return (
    <aside className="ledger-sidebar">
      <div className="ledger-sidebar-role"><span />{portal.name.toUpperCase()} PORTAL</div>
      <nav className="ledger-sidebar-nav" aria-label={`${portal.name} navigation`}>
        {portal.links.map(link => {
          const isActive = link.exact ? location.pathname === link.path : location.pathname.startsWith(link.path)
          return <NavLink key={link.path} to={link.path} end={link.exact} className={`ledger-sidebar-link ${isActive ? 'active' : ''}`}>{link.label}</NavLink>
        })}
      </nav>
      <div className="ledger-sidebar-footer">SECURE CASEWORKSPACE<br />LOCAL NODE · v2.0</div>
    </aside>
  )
}

function AppChrome({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isPortal = /^\/(citizen|investigator|admin)/.test(location.pathname)
  return <>
    <GlobalNavbar />
    <div className={isPortal ? 'ledger-workspace' : ''}>
      <PortalSidebar />
      <main className={isPortal ? 'ledger-workspace-main' : ''}>{children}</main>
    </div>
  </>
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const storedUser = localStorage.getItem('user')
  const token = localStorage.getItem('token')
  const user = storedUser ? JSON.parse(storedUser) as { role?: string } : null

  if (!token || !user?.role) return <Navigate to={`/login/${roles[0]}`} replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

// ============================================================
// LANDING PAGE
// ============================================================
function LandingPage() {
  return (
    <div className="command-landing">
      <section className="command-hero">
        <div className="command-standard">♢&nbsp;&nbsp; Cyber Command Center Standard v2.0</div>
        <h1>AI-Powered Cybercrime<br/>Investigation &amp; <span>Evidence Vault</span></h1>
        <p>Report cyber fraud, track complaints, verify evidence SHA-256 chain of<br className="desktop-break"/> custody, and power law enforcement with AI intelligence.</p>
        <div className="command-cta">
          <a className="command-primary" href="/login/citizen">▧&nbsp;&nbsp; Report Cyber Crime <b>→</b></a>
          <a className="command-secondary" href="/login/investigator">♧&nbsp;&nbsp; Officer / Portal Sign In</a>
        </div>
      </section>
      <section className="command-features">
          <PortalCard
            icon="ϟ" title="Guided 5-Step Complaint Wizard" desc="Frictionless reporting for citizens with automated fraud type classification, suspect identifier tracking, and evidence file attachments."
            link="/login/citizen" variant="blue"
          />
          <PortalCard
            icon="▣" title="AI Risk Scoring & Copilot" desc="Real-time entity extraction, duplicate complaint detection, threat cluster analysis, and AI automated case summaries for investigators."
            link="/login/investigator" variant="cyan"
          />
          <PortalCard
            icon="〽" title="Immutable Chain of Custody" desc="AES-256 encrypted evidence storage paired with SHA-256 cryptographic hashing to guarantee legal tamper-evident evidence integrity."
            link="/login/admin" variant="green"
          />
      </section>
    </div>
  )
}

function LoginChooser() {
  const options = [
    { title: 'Citizen', icon: '👤', description: 'Report cybercrime, upload evidence, and track your complaint.', href: '/login/citizen', action: 'Citizen sign in', style: 'border-cyan-500/40 hover:border-cyan-300 hover:bg-cyan-950/30', accent: 'text-cyan-300' },
    { title: 'Investigator', icon: '🕵️', description: 'Access case triage, intelligence, evidence, and investigation tasks.', href: '/login/investigator', action: 'Investigator sign in', style: 'border-violet-500/40 hover:border-violet-300 hover:bg-violet-950/30', accent: 'text-violet-300' },
    { title: 'Administrator', icon: '⚙️', description: 'Manage users, governance, operational controls, and platform intelligence.', href: '/login/admin', action: 'Administrator sign in', style: 'border-amber-500/40 hover:border-amber-300 hover:bg-amber-950/30', accent: 'text-amber-300' },
  ]
  return <div className="login-shell min-h-screen bg-[#0A0F1C] px-5 py-10 flex items-center justify-center"><main className="w-full max-w-5xl"><header className="text-center"><a href="/" className="inline-flex items-center gap-2 text-xl font-bold text-white no-underline"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">🛡️</span>CyberShield</a><p className="mt-7 text-xs font-bold tracking-[.18em] text-cyan-300">SECURE PORTAL ACCESS</p><h1 className="mt-3 text-4xl font-bold text-white">Choose your workspace</h1><p className="mx-auto mt-3 max-w-xl text-slate-400">Select the portal that matches your role. Each workspace has role-based access controls and an auditable sign-in trail.</p></header><section className="mt-10 grid gap-4 md:grid-cols-3">{options.map(option => <a key={option.title} href={option.href} className={`group rounded-2xl border bg-slate-900/70 p-6 no-underline transition ${option.style}`}><span className="text-4xl">{option.icon}</span><h2 className={`mt-6 text-xl font-bold ${option.accent}`}>{option.title}</h2><p className="mt-3 min-h-16 text-sm leading-6 text-slate-400">{option.description}</p><span className={`mt-6 inline-block text-sm font-bold ${option.accent}`}>{option.action} →</span></a>)}</section><p className="mt-7 text-center text-xs text-slate-500">Investigator registration requires administrator approval. Administrator accounts are provisioned by the system owner.</p></main></div>
}

function PortalCard({ icon, title, desc, link, variant }: {
  icon: string; title: string; desc: string; link: string; variant: 'blue' | 'cyan' | 'green'
}) {
  return (
    <a href={link} className="command-feature">
      <span className={`command-feature-icon ${variant}`}>{icon}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
    </a>
  )
}

// ============================================================
// CITIZEN HOME
// ============================================================
function CitizenHome() {
  const [dashboard, setDashboard] = useState<{ pending: number; under_investigation: number; resolved: number; recent_complaints: any[] } | null>(null)
  useEffect(() => { axios.get('/api/citizen/dashboard').then(response => setDashboard(response.data)).catch(() => setDashboard({ pending: 0, under_investigation: 0, resolved: 0, recent_complaints: [] })) }, [])
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 
          to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-3xl">
          👤
        </div>
        <h1 className="text-4xl font-bold text-cyan-400 mb-2">Citizen Portal</h1>
        <p className="text-gray-400">Report cybercrime, track your complaints, and stay safe online</p>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[['Pending', dashboard?.pending ?? '—', 'text-amber-300'], ['Under investigation', dashboard?.under_investigation ?? '—', 'text-purple-300'], ['Resolved', dashboard?.resolved ?? '—', 'text-green-300']].map(([label, value, color]) => <div key={label} className="rounded-xl border border-gray-700 bg-gray-800/70 p-4"><p className="text-xs text-gray-400">{label}</p><p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p></div>)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[
          { icon: '📝', title: 'Register Complaint', desc: 'Report cyber fraud, harassment, or suspicious activity', link: '/citizen/register', color: 'from-cyan-600 to-blue-700' },
          { icon: '🔍', title: 'Track Complaint', desc: 'Check the real-time status of your complaints', link: '/citizen/track', color: 'from-purple-600 to-pink-700' },
          { icon: '⚠️', title: 'Scam Checker', desc: 'Verify if a phone number or UPI ID has been reported', link: '/citizen/scam-check', color: 'from-orange-600 to-red-700' },
          { icon: '🛡️', title: 'Safety Awareness', desc: 'Learn how to protect yourself from cyber threats', link: '/citizen/safety', color: 'from-green-600 to-emerald-700' },
        ].map(card => (
          <a key={card.title} href={card.link}
            className={`bg-gradient-to-br ${card.color} p-6 rounded-xl border border-white/10 
              hover:scale-[1.02] transition-all duration-300 shadow-xl`}>
            <span className="text-4xl block mb-3">{card.icon}</span>
            <h3 className="text-xl font-bold mb-1">{card.title}</h3>
            <p className="text-sm opacity-80">{card.desc}</p>
            <span className="mt-3 inline-block text-sm font-bold">Open →</span>
          </a>
        ))}
      </div>
      <section className="mt-8 rounded-2xl border border-gray-700 bg-gray-800/60 p-6">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Recent complaints</h2><a href="/citizen/track" className="text-sm text-cyan-300">View all →</a></div>
        {!dashboard ? <p className="mt-4 text-sm text-gray-500">Loading your case history…</p> : dashboard.recent_complaints.length === 0 ? <p className="mt-4 text-sm text-gray-500">No reports yet. File a complaint to begin tracking it here.</p> : <div className="mt-4 space-y-2">{dashboard.recent_complaints.map(item => <a key={item.id} href="/citizen/track" className="block rounded-xl bg-gray-900/80 p-4 hover:bg-gray-900"><div className="flex justify-between gap-3"><div><p className="font-semibold text-white">{item.tracking_id || `#${item.id}`} · {item.title}</p><p className="text-xs text-gray-500 mt-1">{item.crime_type || item.fraud_category || 'Processing'} · Risk {item.risk_score}/100</p></div><span className="text-sm text-cyan-200">{item.status}</span></div></a>)}</div>}
      </section>
    </div>
  )
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-[#0A0F1C] text-white">
        <AppChrome>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            
            {/* 👇 NEW: Login routes — no navbar shown */}
            <Route path="/login" element={<LoginChooser />} />
            <Route path="/login/citizen" element={<CitizenLogin />} />
            <Route path="/login/investigator" element={<InvestigatorLogin />} />
            <Route path="/login/admin" element={<AdminLogin />} />
            
            {/* Citizen routes */}
            <Route path="/citizen" element={<RequireRole roles={['citizen']}><CitizenHome /></RequireRole>} />
            <Route path="/citizen/register" element={<RequireRole roles={['citizen']}><RegisterComplaint /></RequireRole>} />
            <Route path="/citizen/track" element={<RequireRole roles={['citizen']}><TrackComplaint /></RequireRole>} />
            <Route path="/citizen/scam-check" element={<RequireRole roles={['citizen']}><ScamChecker /></RequireRole>} />
            <Route path="/citizen/safety" element={<RequireRole roles={['citizen']}><SafetyAwareness /></RequireRole>} />
            
            {/* Investigator routes */}
            <Route path="/investigator" element={<RequireRole roles={['investigator', 'admin']}><CaseIntelligence /></RequireRole>} />
            <Route path="/investigator/queue" element={<RequireRole roles={['investigator', 'admin']}><ComplaintQueue /></RequireRole>} />
            <Route path="/investigator/complaint/:complaintId" element={<RequireRole roles={['investigator', 'admin']}><ComplaintQueue /></RequireRole>} />
            <Route path="/investigator/threat-graph" element={<RequireRole roles={['investigator', 'admin']}><ThreatGraph /></RequireRole>} />
            <Route path="/investigator/verify" element={<RequireRole roles={['investigator', 'admin']}><BlockchainVerify /></RequireRole>} />
            <Route path="/investigator/intelligence" element={<RequireRole roles={['investigator', 'admin']}><CaseIntelligence /></RequireRole>} />
            <Route path="/investigator/evidence" element={<RequireRole roles={['investigator', 'admin']}><InvestigatorTool mode="evidence" /></RequireRole>} />
            <Route path="/investigator/financial-flow" element={<RequireRole roles={['investigator', 'admin']}><InvestigatorTool mode="financial" /></RequireRole>} />
            <Route path="/investigator/notes" element={<RequireRole roles={['investigator', 'admin']}><InvestigatorTool mode="notes" /></RequireRole>} />
            <Route path="/investigator/case-report" element={<RequireRole roles={['investigator', 'admin']}><CaseReport /></RequireRole>} />
            <Route path="/investigator/court-report" element={<RequireRole roles={['investigator', 'admin']}><CaseReport /></RequireRole>} />
            
            {/* Admin routes — wrapped in AdminApp layout for sidebar */}
            <Route path="/admin" element={<RequireRole roles={['admin']}><AdminApp /></RequireRole>}>
              <Route index element={<AdminDashboard />} />
              <Route path="approvals" element={<UserApprovals />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="complaints" element={<ComplaintQueue />} />
              <Route path="complaints/:complaintId" element={<ComplaintQueue />} />
              <Route path="investigator-approvals" element={<InvestigatorApprovals />} />
              <Route path="investigators" element={<InvestigatorManagement />} />
              <Route path="agencies" element={<AgencyManagement />} />
              <Route path="ai" element={<AIMonitoring />} />
              <Route path="threats" element={<ThreatIntelligence />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="operations" element={<Operations />} />
              <Route path="governance" element={<Governance />} />
            </Route>
            
            <Route path="*" element={
              <div className="text-center py-20">
                <p className="text-6xl mb-4">🛡️</p>
                <h2 className="text-2xl font-bold mb-2 text-red-400">404 — Lost in Cyberspace</h2>
                <p className="text-gray-400 mb-4">This page doesn't exist</p>
                <a href="/" className="text-cyan-400 hover:underline font-bold">Return to Home →</a>
              </div>
            } />
          </Routes>
        </AppChrome>
      </div>
    </BrowserRouter>
  )
}
