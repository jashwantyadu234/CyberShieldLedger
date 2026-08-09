import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'

export default function ComplaintQueue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { complaintId } = useParams()
  const location = useLocation()
  const [complaints, setComplaints] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [evidence, setEvidence] = useState<any[]>([])
  const [digitalSignature, setDigitalSignature] = useState<any>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [noteBody, setNoteBody] = useState('')
  const [noteAssignee, setNoteAssignee] = useState('')
  const [courtReport, setCourtReport] = useState<any>(null)
  const [caseActionError, setCaseActionError] = useState('')
  const [page, setPage] = useState(1)

  const filters = {
    status: searchParams.get('status') || '',
    risk_min: searchParams.get('risk_min') || '',
    crime_type: searchParams.get('crime_type') || '',
    search: searchParams.get('search') || '',
  }

  const fetchComplaints = async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = { skip: (page - 1) * 20, limit: 20 }
      if (filters.status) params.status = filters.status
      if (filters.risk_min) params.risk_min = parseInt(filters.risk_min)
      if (filters.crime_type) params.crime_type = filters.crime_type
      if (filters.search) params.search = filters.search
      
      const res = await axios.get('/api/investigator/complaints', { params })
      setComplaints(res.data.complaints || [])
      setTotal(res.data.total || 0)
      if (complaintId) await selectComplaint(Number(complaintId))
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load complaints'
      setError(msg)
      setComplaints([])
      setTotal(0)
    }
    setLoading(false)
  }

  useEffect(() => { void fetchComplaints() }, [page, searchParams, complaintId])

  const selectComplaint = async (id: number) => {
    try {
      const [res, evidenceResponse, intelligenceResponse] = await Promise.all([
        axios.get(`/api/investigator/complaint/${id}`),
        axios.get(`/api/complaints/${id}/evidence`),
        axios.get(`/api/investigator/complaint/${id}/intelligence`),
      ])
      setSelectedComplaint(res.data.complaint)
      setAiAnalysis(res.data.ai_analysis)
      setAuditLogs(res.data.audit_logs || [])
      setDuplicates(res.data.duplicates || [])
      setEvidence(evidenceResponse.data || [])
      setDigitalSignature(res.data.digital_signature || { exists: false })
      setNotes(intelligenceResponse.data.notes || [])
      setCourtReport(null)
      setCaseActionError('')
    } catch {
      setSelectedComplaint(null)
    }
  }

  const updateStatus = async (id: number, status: string, notes: string = '') => {
    try {
      await axios.put(`/api/investigator/complaint/${id}/status`, {
        status, officer_name: 'Investigator', notes
      })
      await Promise.all([selectComplaint(id), fetchComplaints()])
    } catch {}
  }

  const downloadEvidence = async (id: number, filename: string) => {
    const response = await axios.get(`/api/evidence/${id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const addNote = async () => {
    if (!selectedComplaint || !noteBody.trim()) return
    setCaseActionError('')
    try {
      await axios.post(`/api/investigator/complaint/${selectedComplaint.id}/notes`, { body: noteBody, assignee: noteAssignee || undefined })
      setNoteBody(''); setNoteAssignee('')
      await selectComplaint(selectedComplaint.id)
    } catch (err: any) { setCaseActionError(err.response?.data?.detail || 'Unable to add the investigation task.') }
  }

  const updateTask = async (taskId: number, taskStatus: string) => {
    if (!selectedComplaint) return
    setCaseActionError('')
    try {
      await axios.put(`/api/investigator/complaint/${selectedComplaint.id}/tasks/${taskId}`, { task_status: taskStatus })
      await selectComplaint(selectedComplaint.id)
    } catch (err: any) { setCaseActionError(err.response?.data?.detail || 'Unable to update the task.') }
  }

  const generateCourtReport = async () => {
    if (!selectedComplaint) return
    setCaseActionError('')
    try { setCourtReport((await axios.get(`/api/investigator/complaint/${selectedComplaint.id}/court-report`)).data) }
    catch (err: any) { setCaseActionError(err.response?.data?.detail || 'Unable to generate the court report.') }
  }

  const isAdminReview = location.pathname.startsWith('/admin')

  return (
    <div className="portal-shell">
    <div className="flex min-h-[calc(100vh-108px)]">
      {/* Left Panel — Complaint List */}
      <div className="w-[45%] border-r border-gray-700 overflow-y-auto">
        <div className="p-5 border-b border-slate-700/70 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
          <p className="portal-eyebrow mb-1">{isAdminReview ? 'Administration / Case oversight' : 'Investigator / Case triage'}</p>
          <h1 className="text-2xl font-bold text-cyan-300 mb-4">{isAdminReview ? '📁 Complaint Review' : '📋 Complaint Queue'}</h1>
          
          {/* Filters */}
          <div className="grid grid-cols-4 gap-2">
            <select className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm"
              value={filters.status}
              onChange={e => setSearchParams({ ...Object.fromEntries(searchParams), status: e.target.value })}>
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Under Investigation">Investigating</option>
              <option value="Resolved">Resolved</option>
            </select>
            <select className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm"
              value={filters.risk_min}
              onChange={e => setSearchParams({ ...Object.fromEntries(searchParams), risk_min: e.target.value })}>
              <option value="">Any Risk</option>
              <option value="70">High Risk (70+)</option>
              <option value="40">Medium Risk (40+)</option>
            </select>
            <input className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm"
              placeholder="🔍 Search..." value={filters.search}
              onChange={e => setSearchParams({ ...Object.fromEntries(searchParams), search: e.target.value })} />
            <span className="text-sm text-gray-400 py-1 text-right">{total} total</span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 px-4">
            <div className="text-center">
              <span className="text-4xl block mb-3">⚠️</span>
              <p className="text-red-400 font-bold mb-1">Failed to load complaints</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        ) : (
          /* Complaint List */
          <div className="divide-y divide-gray-700">
            {complaints.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <span className="text-5xl block mb-3">📭</span>
                  <p className="text-lg font-bold text-gray-400">No complaints found</p>
                  <p className="text-sm text-gray-600 mt-1">Try adjusting your filters or check back later</p>
                </div>
              </div>
            ) : (
              complaints.map(c => (
                <div key={c.id} 
                  className={`p-4 cursor-pointer transition-all hover:bg-gray-750 ${
                    selectedComplaint?.id === c.id ? 'bg-gray-750 border-l-4 border-cyan-500' : ''
                  }`}
                  onClick={() => selectComplaint(c.id)}>
                  <div className="flex items-start gap-3">
                    <span className={`w-2 min-h-[3rem] rounded-full mt-1 ${
                      c.risk_score > 70 ? 'bg-red-500' : c.risk_score > 40 ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-bold truncate">#{c.id} {c.title}</p>
                        <span className="text-xs text-gray-500 ml-2 shrink-0">{c.created_at?.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{c.crime_type || 'Unclassified'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-gray-900 rounded text-xs font-mono">{c.risk_score}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          c.status === 'Pending' ? 'bg-yellow-900 text-yellow-300' :
                          c.status === 'Under Investigation' ? 'bg-purple-900 text-purple-300' :
                          c.status === 'Resolved' ? 'bg-green-900 text-green-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>{c.status}</span>
                        {c.blockchain_tx && <span className="text-xs text-green-400">⛓️</span>}
                        {c.phone_number && <span className="text-xs text-yellow-400">📞</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-gray-700 flex justify-center gap-2">
          <button className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50" 
            disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="px-3 py-1 text-sm text-gray-400">Page {page}</span>
          <button className="px-3 py-1 bg-gray-700 rounded"
            onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      {/* Right Panel — Complaint Detail */}
      <div className="flex-1 overflow-y-auto bg-slate-950">
        {!selectedComplaint ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <span className="text-6xl block mb-4">👈</span>
              <p className="text-xl font-bold">Select a complaint</p>
              <p className="text-sm mt-2">Click on any complaint from the list to view details</p>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-8 space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="portal-eyebrow mb-2">{isAdminReview ? 'Case administration' : 'Case investigation'} · #{selectedComplaint.id}</p>
                <h2 className="text-2xl font-bold">#{selectedComplaint.id} {selectedComplaint.title}</h2>
                <p className="text-gray-400">
                  {selectedComplaint.citizen_name} · {selectedComplaint.citizen_email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusDropdown current={selectedComplaint.status}
                  onChange={(s) => updateStatus(selectedComplaint.id, s)} />
              </div>
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-4 gap-3">
              <InfoCard label="Crime Type" value={selectedComplaint.crime_type || 'Unclassified'} color="text-cyan-400" />
              <InfoCard label="Risk Score" value={`${selectedComplaint.risk_score}/100`}
                color={selectedComplaint.risk_score > 70 ? 'text-red-400' : 'text-yellow-400'} />
              <InfoCard label="Agency" value={selectedComplaint.agency || 'Not assigned'} color="text-blue-400" />
              <InfoCard label="Status" value={selectedComplaint.status} color="text-purple-400" />
              {selectedComplaint.amount && (
                <InfoCard label="Amount" value={`₹${selectedComplaint.amount.toLocaleString()}`} color="text-orange-400" />
              )}
              {selectedComplaint.phone_number && (
                <InfoCard label="Phone" value={selectedComplaint.phone_number} color="text-yellow-400" />
              )}
              {selectedComplaint.upi_id && (
                <InfoCard label="UPI ID" value={selectedComplaint.upi_id} color="text-pink-400" />
              )}
              <InfoCard label="Blockchain" value={selectedComplaint.blockchain_tx ? '✅ Verified' : '⏳ Pending'} 
                color={selectedComplaint.blockchain_tx ? 'text-green-400' : 'text-yellow-400'} />
              <InfoCard label="Digital Signature" value={digitalSignature.exists ? '🔑 Signed' : '⏳ Not Signed'}
                color={digitalSignature.exists ? 'text-purple-400' : 'text-gray-400'} />
            </div>

            {/* Description */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <h3 className="font-bold mb-2">📄 Description</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{selectedComplaint.description}</p>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold">🔐 Encrypted Evidence</h3><span className="text-xs text-cyan-300">AES-256 + SHA-256</span></div>
              {evidence.length === 0 ? <p className="text-sm text-gray-500">No evidence files attached to this complaint.</p> : <div className="space-y-2">{evidence.map((item: any) => <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-lg bg-gray-900 border border-gray-700 px-3 py-2"><div className="min-w-0"><p className="text-sm font-semibold truncate">{item.filename}</p><p className="text-xs font-mono text-gray-500 truncate">SHA-256: {item.sha256}</p></div><button type="button" onClick={() => void downloadEvidence(item.id, item.filename)} className="text-sm font-bold text-cyan-300 hover:text-cyan-200 text-left">Download ↗</button></div>)}</div>}
            </div>

            {/* AI Analysis Panel */}
            {aiAnalysis && Object.keys(aiAnalysis).length > 0 && (
              <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 p-4 rounded-xl border border-cyan-800">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <span>🧠</span> AI Analysis
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <AIField label="Crime Type" value={aiAnalysis.crime_type} />
                  <AIField label="Risk Score" value={`${aiAnalysis.risk_score}/100`} />
                  <AIField label="Payment Method" value={aiAnalysis.payment_method || 'N/A'} />
                  <AIField label="Suggested Agency" value={aiAnalysis.suggested_agency || 'N/A'} />
                  {aiAnalysis.scammer_details && (
                    <div className="col-span-2 bg-black/30 p-3 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Scammer Details</p>
                      <p className="text-sm">{aiAnalysis.scammer_details}</p>
                    </div>
                  )}
                  {aiAnalysis.suggested_law_sections?.length > 0 && (
                    <div className="col-span-2 bg-black/30 p-3 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Suggested Law Sections</p>
                      <div className="flex flex-wrap gap-1">
                        {aiAnalysis.suggested_law_sections.map((s: unknown, i: number) => (
                          <span key={i} className="px-2 py-1 bg-cyan-900 text-cyan-300 rounded text-xs font-mono">
                            {formatLawSection(s)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Duplicates */}
            {duplicates.length > 0 && (
              <div className="bg-red-900/20 p-4 rounded-xl border border-red-800">
                <h3 className="font-bold mb-3 text-red-400 flex items-center gap-2">
                  <span>🔗</span> Potential Duplicates ({duplicates.length})
                </h3>
                <div className="space-y-2">
                  {duplicates.map((d: any) => (
                    <div key={d.id} className="flex justify-between items-center bg-black/30 p-3 rounded-lg">
                      <div>
                        <p className="font-medium">#{d.id} {d.title}</p>
                        <p className="text-sm text-gray-400">Risk: {d.risk_score}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-yellow-400">Similarity</p>
                        <p className="font-bold text-lg">{d.similarity}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Digital Signature Status */}
            {digitalSignature.exists && (
              <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold flex items-center gap-2"><span>🔑</span> Digital Signature (User-Held Key)</h3>
                  <span className="text-xs text-purple-300 font-mono">{digitalSignature.algorithm || 'RSA-PSS'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-black/30 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Status</p>
                    <p className="text-green-400 font-bold">✅ Signature Verified</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Signed At</p>
                    <p className="text-cyan-300 font-bold">{digitalSignature.created_at?.slice(0, 10) || 'N/A'}</p>
                  </div>
                  {digitalSignature.signed_hash && (
                    <div className="col-span-2 bg-black/30 rounded-lg p-2">
                      <p className="text-xs text-gray-400 mb-1">Signed Hash (Bundle)</p>
                      <p className="text-xs font-mono text-amber-300 break-all">{digitalSignature.signed_hash}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Blockchain Verification Inline */}
            <BlockchainVerifyInline complaintId={selectedComplaint.id} />

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2"><span>⚖️</span> Formal Court Evidentiary Report</h3>
                  <p className="mt-1 text-xs text-gray-400">Generates Section 65B Certificate, SHA-256 evidence vault summary, and legal filing dossier.</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/investigator/case-report?id=${selectedComplaint.id}`}
                    className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-extrabold text-slate-950 flex items-center gap-1.5 transition no-underline"
                  >
                    <span>📜 Open Formal Court Dossier →</span>
                  </a>
                </div>
              </div>
              {courtReport && <div className="mt-4 rounded-lg bg-gray-900 p-4 text-sm"><p className="font-bold text-cyan-200">{courtReport.document_type}</p><p className="mt-2 text-gray-300">Evidence: {courtReport.integrity.evidence_count} file(s) · Signature: {courtReport.integrity.digital_signature_verified ? 'verified' : 'not verified'} · Bundle hash:</p><p className="mt-1 break-all font-mono text-xs text-amber-300">{courtReport.integrity.bundle_hash}</p><p className="mt-3 text-xs text-amber-200">{courtReport.review_notice}</p></div>}
            </div>

            {/* Chain of Custody */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <h3 className="font-bold mb-4">📜 Chain of Custody</h3>
              <div className="relative">
                {auditLogs.map((log, i) => (
                  <div key={i} className="flex gap-4 pb-6 relative">
                    {i < auditLogs.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-700" />
                    )}
                    <div className="w-6 h-6 rounded-full bg-cyan-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-900 p-3 rounded-lg">
                        <div className="flex justify-between items-start">
                          <p className="font-medium">{log.action}</p>
                          <span className="text-xs text-gray-500">{log.timestamp?.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">by {log.performed_by}</p>
                        {log.details && <p className="text-xs text-gray-500 mt-1">{log.details}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Investigation notes and tasks */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <h3 className="font-bold mb-3">📝 Investigation notes & tasks</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]"><input className="p-3 bg-gray-900 border border-gray-700 rounded-lg" placeholder="Add an investigation note or follow-up task..." value={noteBody} onChange={e => setNoteBody(e.target.value)} /><input className="p-3 bg-gray-900 border border-gray-700 rounded-lg" placeholder="Assignee" value={noteAssignee} onChange={e => setNoteAssignee(e.target.value)} /><button type="button" className="px-4 py-2 bg-cyan-700 rounded-lg font-bold" onClick={addNote}>Add task</button></div>
              {caseActionError && <p className="mt-3 text-sm text-red-300">{caseActionError}</p>}
              {notes.length === 0 ? <p className="mt-4 text-sm text-gray-500">No investigation notes or tasks recorded.</p> : <div className="mt-4 space-y-2">{notes.map(note => <div key={note.id} className="flex flex-col gap-2 rounded-lg bg-gray-900 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm text-gray-200">{note.body}</p><p className="mt-1 text-xs text-gray-500">{note.author} · {note.assignee ? `Assigned to ${note.assignee}` : 'Unassigned'} · {note.created_at?.slice(0, 16).replace('T', ' ')}</p></div><select aria-label="Task status" value={note.status} onChange={e => updateTask(note.id, e.target.value)} className="rounded border border-gray-600 bg-slate-950 px-2 py-1 text-xs"><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></div>)}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

function formatLawSection(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const section = value as { act?: unknown; section?: unknown; description?: unknown }
    return [section.act, section.section, section.description]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' — ') || 'Unspecified legal section'
  }
  return 'Unspecified legal section'
}

function InfoCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-bold ${color} truncate`}>{value}</p>
    </div>
  )
}

function AIField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/30 p-3 rounded-lg">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-cyan-300">{value || 'N/A'}</p>
    </div>
  )
}

function StatusDropdown({ current, onChange }: { current: string; onChange: (s: string) => void }) {
  const statuses = ['Pending', 'Under Investigation', 'In Progress', 'Resolved', 'Closed']
  return (
    <select className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-bold"
      value={current} onChange={e => onChange(e.target.value)}>
      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

function BlockchainVerifyInline({ complaintId }: { complaintId: number }) {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const verify = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/complaints/${complaintId}/verify`)
      setResult(res.data)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">⛓️ Blockchain Verification</h3>
        <button className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-sm font-bold"
          onClick={verify} disabled={loading}>
          {loading ? '⏳' : '🔍 Verify'}
        </button>
      </div>
      {result && (
        <div className={`p-3 rounded-lg ${result.verified ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
          <p className="font-bold">{result.verified ? '✅ Evidence INTACT' : '❌ Evidence TAMPERED'}</p>
          <div className="text-xs mt-2 space-y-1 font-mono">
            <p>DB Hash: {result.db_hash?.slice(0, 24)}...</p>
            <p>Chain Hash: {result.on_chain_hash?.slice(0, 24)}...</p>
            {result.blockchain_tx && <p>TX: {result.blockchain_tx.slice(0, 24)}...</p>}
          </div>
        </div>
      )}
    </div>
  )
}
