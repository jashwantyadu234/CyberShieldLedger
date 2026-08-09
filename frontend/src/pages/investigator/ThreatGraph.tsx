import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

type NodeType = 'complaint' | 'phone' | 'upi' | 'bank' | 'crypto' | 'website' | 'email'

type GraphNode = {
  id: string
  db_id?: number
  label: string
  type: NodeType
  risk?: number
  title?: string
  crime?: string
  amount?: number
  status?: string
  date?: string
  linked_count?: number
  x?: number
  y?: number
}

type GraphLink = {
  source: string | GraphNode
  target: string | GraphNode
  label: string
  value?: number
}

const TYPE_CONFIG: Record<NodeType, { name: string; icon: string; color: string; bg: string }> = {
  complaint: { name: 'Complaint Case', icon: '📁', color: '#f43f5e', bg: 'bg-rose-950/50 border-rose-500/40 text-rose-300' },
  phone: { name: 'Phone Number', icon: '📱', color: '#38bdf8', bg: 'bg-sky-950/50 border-sky-500/40 text-sky-300' },
  upi: { name: 'UPI VPA', icon: '💳', color: '#c084fc', bg: 'bg-purple-950/50 border-purple-500/40 text-purple-300' },
  bank: { name: 'Bank Account', icon: '🏦', color: '#facc15', bg: 'bg-amber-950/50 border-amber-500/40 text-amber-300' },
  crypto: { name: 'Crypto Wallet', icon: '⚡', color: '#34d399', bg: 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' },
  website: { name: 'Phishing Web Domain', icon: '🌐', color: '#fb923c', bg: 'bg-orange-950/50 border-orange-500/40 text-orange-300' },
  email: { name: 'Suspect Email', icon: '📧', color: '#a78bfa', bg: 'bg-violet-950/50 border-violet-500/40 text-violet-300' },
}

export default function ThreatGraph() {
  const navigate = useNavigate()
  const fgRef = useRef<any>(null)
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphLink[]; summary?: any }>({ nodes: [], edges: [] })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Filters & Search
  const [filterType, setFilterType] = useState<string>('all')
  const [filterMinRisk, setFilterMinRisk] = useState<number>(0)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await axios.get('/api/investigator/threat-graph')
        setData(res.data)
      } catch (err) {
        console.error('Failed to load threat graph:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
    const interval = window.setInterval(() => void loadData(), 20000)
    return () => window.clearInterval(interval)
  }, [])

  // Filter nodes & links
  const filteredData = useMemo(() => {
    let nodes = data.nodes || []
    
    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      nodes = nodes.filter(n => 
        n.label.toLowerCase().includes(term) || 
        (n.title && n.title.toLowerCase().includes(term)) ||
        (n.crime && n.crime.toLowerCase().includes(term))
      )
    }

    // Type filter
    if (filterType !== 'all') {
      nodes = nodes.filter(n => n.type === filterType)
    }

    // Risk filter
    if (filterMinRisk > 0) {
      nodes = nodes.filter(n => (n.risk || 0) >= filterMinRisk)
    }

    const validNodeIds = new Set(nodes.map(n => n.id))
    const links = (data.edges || []).filter(e => {
      const sId = typeof e.source === 'object' ? (e.source as any).id : e.source
      const tId = typeof e.target === 'object' ? (e.target as any).id : e.target
      return validNodeIds.has(sId) && validNodeIds.has(tId)
    })

    return { nodes, links }
  }, [data, filterType, filterMinRisk, searchTerm])

  // Linked entities of selected node
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return []
    const sId = selectedNode.id
    const connectedIds = new Set<string>()

    for (const link of data.edges || []) {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target
      if (sourceId === sId) connectedIds.add(targetId)
      if (targetId === sId) connectedIds.add(sourceId)
    }

    return (data.nodes || []).filter(n => connectedIds.has(n.id))
  }, [selectedNode, data])

  // Center on node
  const focusNode = (node: GraphNode) => {
    setSelectedNode(node)
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 800)
      fgRef.current.zoom(2.5, 800)
    }
  }

  // Custom Node Painting
  const drawNode = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = selectedNode?.id === node.id
    const isHovered = hoverNode?.id === node.id
    const config = TYPE_CONFIG[node.type as NodeType] || TYPE_CONFIG.phone
    const size = node.type === 'complaint' ? 8 : (node.linked_count || 1) > 1 ? 9 : 6
    const radius = size * (isSelected ? 1.4 : isHovered ? 1.2 : 1)

    // Glow effect for high risk or selected
    if (isSelected || (node.risk || 0) >= 80 || (node.linked_count || 0) > 1) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false)
      ctx.fillStyle = isSelected ? '#38bdf844' : (node.risk || 0) >= 80 ? '#f43f5e44' : '#c084fc44'
      ctx.fill()
    }

    // Base circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
    ctx.fillStyle = config.color
    ctx.fill()
    ctx.lineWidth = isSelected ? 2.5 : 1
    ctx.strokeStyle = '#0f172a'
    ctx.stroke()

    // Draw text label when zoomed in or selected
    if (globalScale > 1.2 || isSelected || isHovered || (node.linked_count || 0) > 1) {
      const label = node.type === 'complaint' ? (node.label || `#${node.id}`) : node.label
      const fontSize = Math.max(10 / globalScale, 3)
      ctx.font = `${fontSize}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1'
      ctx.fillText(label, node.x, node.y + radius + 3)
    }
  }

  if (loading) {
    return (
      <div className="portal-shell">
        <div className="flex flex-col items-center justify-center h-96">
          <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mb-4" />
          <p className="text-slate-300 font-medium">Building Cyber Threat Relationship Graph…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-shell">
      <div className="portal-page space-y-5">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <span>🕵️ INVESTIGATION COMMAND</span>
              <span>•</span>
              <span>SYNDICATE LINK ANALYSIS</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white mt-1 flex items-center gap-3">
              <span>🕸️ Threat Relationship Graph</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                LIVE NETWORK
              </span>
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Visual multi-dimensional correlation of suspect phone numbers, UPI VPAs, bank accounts, phishing domains, and complaint dockets.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Cases', value: data.summary?.total_cases ?? data.nodes.filter(n => n.type === 'complaint').length, color: 'text-rose-400' },
              { label: 'Indicators', value: data.summary?.total_indicators ?? data.nodes.filter(n => n.type !== 'complaint').length, color: 'text-sky-300' },
              { label: 'Links', value: data.summary?.total_links ?? data.edges.length, color: 'text-purple-300' },
              { label: 'Syndicates', value: data.summary?.syndicate_indicators ?? 0, color: 'text-amber-400' },
            ].map((stat, i) => (
              <div key={i} className="portal-panel px-3 py-2 text-center min-w-20">
                <p className="text-[10px] uppercase font-bold text-slate-400">{stat.label}</p>
                <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </header>

        {/* Controls & Filters Bar */}
        <div className="portal-panel p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border-slate-700/80">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search phone, UPI, case ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-64 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none pr-7"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-white">
                  ✕
                </button>
              )}
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Entity Types</option>
              <option value="complaint">📁 Cases / Complaints</option>
              <option value="phone">📱 Phone Numbers</option>
              <option value="upi">💳 UPI Handles</option>
              <option value="bank">🏦 Bank Accounts</option>
              <option value="crypto">⚡ Crypto Wallets</option>
              <option value="website">🌐 Phishing Domains</option>
              <option value="email">📧 Suspect Emails</option>
            </select>

            {/* Risk Filter */}
            <select
              value={filterMinRisk}
              onChange={e => setFilterMinRisk(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value={0}>All Risk Levels</option>
              <option value={80}>🚨 Critical Risk (80+)</option>
              <option value={60}>⚠️ High Risk (60+)</option>
              <option value={40}>⚡ Medium Risk (40+)</option>
            </select>

            {(filterType !== 'all' || filterMinRisk > 0 || searchTerm) && (
              <button
                onClick={() => { setFilterType('all'); setFilterMinRisk(0); setSearchTerm('') }}
                className="text-xs text-cyan-400 hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => fgRef.current?.zoomToFit(400, 20)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
            >
              🔍 Fit View
            </button>
          </div>
        </div>

        {/* Main Graph & Inspector Grid */}
        <div className="grid xl:grid-cols-4 gap-5">
          {/* Canvas Container */}
          <div className="portal-panel xl:col-span-3 h-[640px] overflow-hidden relative bg-[#070c16] rounded-2xl border-slate-800">
            {/* Overlay hint */}
            <div className="absolute z-10 top-4 left-4 rounded-xl bg-slate-950/85 backdrop-blur border border-slate-800 p-3 text-xs text-slate-300 shadow-xl space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <span>🎯 Interactive Graph Controls</span>
              </p>
              <p className="text-[11px] text-slate-400">Click node to inspect • Scroll to zoom • Drag canvas to pan</p>
              {filteredData.nodes.length < data.nodes.length && (
                <p className="text-[11px] text-cyan-300 font-semibold">
                  Showing {filteredData.nodes.length} of {data.nodes.length} entities
                </p>
              )}
            </div>

            {/* Force Graph Canvas */}
            {filteredData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={fgRef}
                graphData={filteredData}
                backgroundColor="#070c16"
                linkColor={() => '#334155'}
                linkWidth={(link: any) => (link.value ? link.value * 1.5 : 1)}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleColor={() => '#38bdf8'}
                nodeCanvasObject={drawNode}
                nodePointerAreaPaint={(node: any, color, ctx) => {
                  ctx.fillStyle = color
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI, false)
                  ctx.fill()
                }}
                onNodeClick={(node: any) => setSelectedNode(node as GraphNode)}
                onNodeHover={(node: any) => setHoverNode(node ? (node as GraphNode) : null)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <span className="text-4xl mb-3">🔍</span>
                <p className="text-lg font-bold text-slate-300">No matching threat indicators found</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Try adjusting your search query or filters to view connected criminal indicators.
                </p>
              </div>
            )}
          </div>

          {/* Right Inspector Sidebar */}
          <aside className="portal-panel p-5 flex flex-col justify-between space-y-4">
            {selectedNode ? (
              <div className="space-y-4 overflow-y-auto max-h-[580px] pr-1">
                {/* Selected Node Card Header */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${TYPE_CONFIG[selectedNode.type]?.bg || 'bg-slate-800'}`}>
                      {TYPE_CONFIG[selectedNode.type]?.icon} {TYPE_CONFIG[selectedNode.type]?.name || selectedNode.type}
                    </span>
                    <button onClick={() => setSelectedNode(null)} className="text-xs text-slate-500 hover:text-white">✕</button>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-3 break-all">{selectedNode.label}</h3>
                  <p className="text-xs text-slate-400 mt-1">{selectedNode.title || 'Threat Entity'}</p>
                </div>

                {/* Risk Meter */}
                <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-400">Risk Assessment</span>
                    <span className={(selectedNode.risk || 0) >= 80 ? 'text-rose-400' : (selectedNode.risk || 0) >= 50 ? 'text-amber-400' : 'text-emerald-400'}>
                      {selectedNode.risk || 50} / 100
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        (selectedNode.risk || 0) >= 80 ? 'bg-rose-500' : (selectedNode.risk || 0) >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${selectedNode.risk || 50}%` }}
                    />
                  </div>
                </div>

                {/* Syndicate Alert Notice */}
                {(selectedNode.linked_count || 0) > 1 && (
                  <div className="rounded-xl bg-amber-950/40 border border-amber-500/40 p-3 text-xs text-amber-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-amber-300">
                      <span>🚨 MULTI-CASE SYNDICATE DETECTED</span>
                    </p>
                    <p>This indicator is linked across <b>{selectedNode.linked_count} separate victim complaints</b>, indicating organized cyber crime activity.</p>
                  </div>
                )}

                {/* Details list */}
                {selectedNode.type === 'complaint' && (
                  <div className="space-y-2 text-xs text-slate-300 rounded-xl bg-slate-950 p-3 border border-slate-800">
                    <div className="flex justify-between"><span className="text-slate-500">Crime Type:</span><span className="font-bold text-white">{selectedNode.crime}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Loss Amount:</span><span className="font-bold text-emerald-300">{selectedNode.amount ? `₹${selectedNode.amount.toLocaleString('en-IN')}` : 'Unspecified'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Status:</span><span className="font-semibold text-cyan-300">{selectedNode.status}</span></div>
                  </div>
                )}

                {/* Connected Entities */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Connected Network Nodes ({connectedNodes.length})
                  </p>
                  {connectedNodes.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {connectedNodes.map(node => (
                        <button
                          key={node.id}
                          onClick={() => focusNode(node)}
                          className="w-full text-left rounded-lg bg-slate-950 hover:bg-slate-800 p-2.5 text-xs text-slate-200 border border-slate-800/80 transition flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="text-sm">{TYPE_CONFIG[node.type]?.icon || '📌'}</span>
                            <div className="truncate">
                              <p className="font-semibold text-slate-100 truncate">{node.label}</p>
                              <p className="text-[10px] text-slate-500">{TYPE_CONFIG[node.type]?.name}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-cyan-400">Inspect →</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No direct connections recorded.</p>
                  )}
                </div>

                {/* Direct Action Buttons */}
                <div className="pt-2 space-y-2">
                  {selectedNode.type === 'complaint' && selectedNode.db_id && (
                    <button
                      onClick={() => navigate(`/investigator/case-report?id=${selectedNode.db_id}`)}
                      className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <span>⚖️ Generate Court Report</span>
                    </button>
                  )}

                  {selectedNode.type !== 'complaint' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedNode.label)
                        alert(`Copied ${selectedNode.label} to clipboard!`)
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition border border-slate-700"
                    >
                      <span>📋 Copy Identifier</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <span className="text-4xl text-slate-600 mb-3">🔍</span>
                <p className="text-sm font-bold text-slate-300">Entity Inspector</p>
                <p className="text-xs text-slate-500 mt-1">
                  Click any node on the relationship graph to inspect its connected victims, suspect phone numbers, and UPI handles.
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="border-t border-slate-800 pt-3 text-[11px] space-y-2 text-slate-400">
              <p className="font-bold text-slate-300">Legend:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cfg.color }} />
                    <span className="truncate">{cfg.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
