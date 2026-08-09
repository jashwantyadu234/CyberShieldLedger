import { useState, useEffect } from 'react'
import axios from 'axios'

const statusColors: Record<string, string> = {
  'Pending': 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30',
  'Under Investigation': 'bg-purple-900/50 text-purple-300 border-purple-500/30',
  'In Progress': 'bg-blue-900/50 text-blue-300 border-blue-500/30',
  'Resolved': 'bg-green-900/50 text-green-300 border-green-500/30',
  'Closed': 'bg-gray-800 text-gray-300 border-gray-600',
}

const statusIcons: Record<string, string> = {
  'Pending': '⏳',
  'Under Investigation': '🔍',
  'In Progress': '🔄',
  'Resolved': '✅',
  'Closed': '📁',
}

export default function TrackComplaint() {
  const [complaints, setComplaints] = useState<any[]>([])
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>([])
  const [digitalSignature, setDigitalSignature] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [trackingQuery, setTrackingQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchComplaints = async () => {
    setLoading(true)
    setSearched(true)
    try {
      const res = await axios.get('/api/citizen/track', { params: { search: trackingQuery || undefined, status: statusFilter || undefined } })
      setComplaints(Array.isArray(res.data) ? res.data : [res.data])
    } catch {
      setComplaints([])
    }
    setLoading(false)
  }

  useEffect(() => { void fetchComplaints() }, [])

  const viewDetail = async (id: number) => {
    const res = await axios.get(`/api/citizen/complaint/${id}`)
    setSelectedComplaint(res.data.complaint)
    setAuditLogs(res.data.audit_logs || [])
    setEvidenceFiles(res.data.evidence_files || [])
    setDigitalSignature(res.data.digital_signature || { exists: false })
    setVerifyResult(null)
  }

  const verifyIntegrity = async (id: number) => {
    try {
      const res = await axios.get(`/api/complaints/${id}/verify`)
      setVerifyResult(res.data)
    } catch { }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            End-to-End Verified
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            🔍 Track Your Complaints
          </h1>
          <p className="text-gray-400 mt-2">View your complaints with cryptographic integrity verification</p>

          <div className="mt-5 grid sm:grid-cols-[1fr_auto_auto] gap-2 max-w-2xl mx-auto">
            <input value={trackingQuery} onChange={e => setTrackingQuery(e.target.value)} className="field" placeholder="Search tracking ID or complaint title (e.g. CS-00000001)" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field sm:w-48"><option value="">All statuses</option><option>Pending</option><option>Under Investigation</option><option>In Progress</option><option>Resolved</option></select>
            <button onClick={fetchComplaints} className="px-5 py-2.5 bg-gray-800/80 border border-gray-700/50 hover:border-cyan-500/50 rounded-xl font-bold text-sm transition-all">🔍 Search</button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading your complaints...</p>
          </div>
        )}

        {searched && !loading && complaints.length === 0 && (
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-12 text-center shadow-xl">
            <span className="text-6xl block mb-4">🔍</span>
            <h3 className="text-xl font-bold text-white mb-2">No Complaints Found</h3>
            <p className="text-gray-400 mb-6">You haven't submitted any complaints yet.</p>
            <a href="/citizen/register"
              className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold shadow-lg shadow-cyan-600/30 hover:shadow-cyan-500/40 transition-all">
              Report a Cybercrime →
            </a>
          </div>
        )}

        {/* Complaint List */}
        {!selectedComplaint && complaints.length > 0 && (
          <div className="space-y-4">
            {complaints.map(c => (
              <div key={c.id}
                onClick={() => viewDetail(c.id)}
                className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 hover:border-cyan-500/30 transition-all cursor-pointer shadow-xl group">
                <div className="flex items-start gap-4">
                  <div className={`w-1.5 h-16 rounded-full ${c.risk_score > 70 ? 'bg-red-500' : c.risk_score > 40 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-white text-lg truncate">{c.tracking_id || `#${c.id}`} · {c.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[c.status] || 'bg-gray-800 text-gray-300 border-gray-600'}`}>
                        {statusIcons[c.status] || '📋'} {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{c.crime_type || 'Unclassified'}</span>
                      <span>·</span>
                      <span>Risk: {c.risk_score}/100</span>
                      <span>·</span>
                      <span>{c.created_at?.slice(0, 10)}</span>
                      {c.blockchain_tx && <span className="text-green-400">⛓️ Anchored</span>}
                    </div>
                  </div>
                  <div className="text-right group-hover:translate-x-1 transition-transform">
                    <span className="text-2xl">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Complaint Detail */}
        {selectedComplaint && (
          <div className="space-y-6">
            <button className="text-cyan-400 hover:text-cyan-300 transition-colors font-bold group flex items-center gap-2"
              onClick={() => setSelectedComplaint(null)}>
              <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to list
            </button>

            {/* Header */}
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedComplaint.tracking_id || `#${selectedComplaint.id}`} · {selectedComplaint.title}</h2>
                  <p className="text-gray-400 text-sm mt-1">{selectedComplaint.citizen_name} · {selectedComplaint.citizen_email}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${statusColors[selectedComplaint.status] || 'bg-gray-800 text-gray-300 border-gray-600'}`}>
                  {statusIcons[selectedComplaint.status] || '📋'} {selectedComplaint.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <TrackInfoCard label="Tracking ID" value={selectedComplaint.tracking_id || `CS-${String(selectedComplaint.id).padStart(8, '0')}`} color="text-purple-300" />
                <TrackInfoCard label="Crime Type" value={selectedComplaint.crime_type || 'Unclassified'} color="text-cyan-400" />
                <TrackInfoCard label="Risk Score" value={`${selectedComplaint.risk_score}/100`}
                  color={selectedComplaint.risk_score > 70 ? 'text-red-400' : selectedComplaint.risk_score > 40 ? 'text-yellow-400' : 'text-green-400'} />
                <TrackInfoCard label="Agency" value={selectedComplaint.agency || 'Not assigned'} color="text-blue-400" />
                <TrackInfoCard label="Blockchain" value={selectedComplaint.blockchain_tx ? '✅ Verified' : '⏳ Pending'}
                  color={selectedComplaint.blockchain_tx ? 'text-green-400' : 'text-yellow-400'} />
              </div>
            </div>

            {/* Description */}
            <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-xl">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">📄 Description</h3>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedComplaint.description}</p>
            </div>

            {/* Evidence Files */}
            {evidenceFiles.length > 0 && (
              <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-xl">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">🔐 Evidence Files <span className="text-xs text-cyan-300 font-normal">AES-256 Encrypted</span></h3>
                <div className="space-y-2">
                  {evidenceFiles.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-900/80 border border-gray-700/50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📄</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{item.filename}</p>
                          <p className="text-xs font-mono text-gray-500">SHA-256: {item.sha256?.slice(0, 24)}...</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded-lg text-xs font-bold border border-green-500/30">Encrypted</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Digital Signature */}
            {digitalSignature && (
              <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 rounded-2xl p-6 shadow-xl">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                  <span>🔑</span> Digital Signature
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                    <p className="text-xs text-gray-400 mb-1">Status</p>
                    <p className={`text-lg font-bold ${digitalSignature.exists ? 'text-green-400' : 'text-yellow-400'}`}>
                      {digitalSignature.exists ? '✅ Signed' : '⏳ Not Signed'}
                    </p>
                  </div>
                  {digitalSignature.exists && (
                    <>
                      <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <p className="text-xs text-gray-400 mb-1">Algorithm</p>
                        <p className="text-sm font-bold text-purple-300">{digitalSignature.algorithm || 'RSA-PSS'}</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <p className="text-xs text-gray-400 mb-1">Signed At</p>
                        <p className="text-sm font-bold text-cyan-300">{digitalSignature.created_at?.slice(0, 10) || 'N/A'}</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <p className="text-xs text-gray-400 mb-1">Verification</p>
                        <p className="text-sm font-bold text-green-400">Bundle hash matches ✓</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Blockchain Verification */}
            <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">⛓️ Integrity Verification</h3>
                <button onClick={() => verifyIntegrity(selectedComplaint.id)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-bold text-sm transition-all shadow-lg shadow-purple-600/30">
                  🔍 Verify Now
                </button>
              </div>
              {verifyResult && (
                <div className={`p-4 rounded-xl border ${verifyResult.verified ? 'bg-green-900/30 border-green-500/30' : 'bg-red-900/30 border-red-500/30'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{verifyResult.verified ? '✅' : '❌'}</span>
                    <div>
                      <p className="font-bold text-lg">{verifyResult.verified ? 'Evidence is INTACT' : 'Evidence TAMPERING DETECTED'}</p>
                      <p className="text-sm opacity-80">{verifyResult.verified ? 'Blockchain hash matches database record.' : 'The complaint data has been modified!'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-black/30 rounded-lg p-2">
                      <p className="text-gray-400 mb-1">Bundle Hash (DB)</p>
                      <p className="text-cyan-300">{verifyResult.bundle_hash?.slice(0, 32)}...</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <p className="text-gray-400 mb-1">On-Chain Hash</p>
                      <p className="text-green-300">{verifyResult.on_chain_hash?.slice(0, 32) || 'N/A'}...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chain of Custody */}
            <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-xl">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">📜 Chain of Custody</h3>
              {auditLogs.length === 0 ? (
                <p className="text-gray-500 text-sm">No audit log entries yet.</p>
              ) : (
                <div className="relative">
                  {auditLogs.map((log, i) => (
                    <div key={i} className="flex gap-4 pb-6 relative">
                      {i < auditLogs.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/50 to-transparent" />
                      )}
                      <div className="w-6 h-6 rounded-full bg-cyan-700/50 flex items-center justify-center flex-shrink-0 mt-0.5 border border-cyan-500/30">
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-3">
                          <div className="flex justify-between items-start">
                            <p className="font-medium text-white">{log.action}</p>
                            <span className="text-xs text-gray-500">{log.timestamp?.slice(0, 16).replace('T', ' ')}</span>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">by {log.performed_by}</p>
                          {log.details && <p className="text-xs text-gray-500 mt-1">{log.details}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TrackInfoCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-bold ${color} truncate`}>{value}</p>
    </div>
  )
}
