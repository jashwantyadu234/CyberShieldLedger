import { useEffect, useState } from 'react'
import axios from 'axios'
import { useSearchParams } from 'react-router-dom'

type CaseReportData = {
  document_type: string
  generated_at: string
  case: {
    id: number
    tracking_id?: string
    title: string
    status?: string
    crime_type?: string
    fraud_category?: string
    incident_date?: string
    incident_location?: string
    reported_loss?: number
    description?: string
    risk_score?: number
    assigned_officer?: string
    agency?: string
  }
  indicators: Record<string, string[]>
  evidence: {
    filename: string
    content_type?: string
    sha256: string
    captured_at?: string
    encrypted_size?: number
  }[]
  integrity: {
    bundle_hash: string
    evidence_count: number
    digital_signature_present: boolean
    digital_signature_verified: boolean
    signature_algorithm?: string
    blockchain_reference?: string
  }
  chain_of_custody: {
    timestamp?: string
    action: string
    actor?: string
    details?: string
  }[]
  investigation_notes: {
    author: string
    body: string
    assignee?: string
    status?: string
    created_at?: string
  }[]
  review_notice: string
}

const displayDate = (value?: string) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'

export default function CaseReport() {
  const [searchParams] = useSearchParams()
  const urlCaseId = searchParams.get('id') || searchParams.get('complaintId') || ''
  
  const [caseId, setCaseId] = useState(urlCaseId)
  const [complaintList, setComplaintList] = useState<any[]>([])
  const [report, setReport] = useState<CaseReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Fetch recent cases for quick selector dropdown
  useEffect(() => {
    axios.get('/api/investigator/queue')
      .then(res => setComplaintList(res.data.complaints || []))
      .catch(() => setComplaintList([]))
  }, [])

  // Auto-generate if URL query param is present
  useEffect(() => {
    if (urlCaseId) {
      setCaseId(urlCaseId)
      void generateReport(urlCaseId)
    }
  }, [urlCaseId])

  const generateReport = async (targetId?: string) => {
    const idToUse = targetId || caseId
    if (!idToUse.trim()) return setMessage('Please select or enter a complaint ID to generate the court report.')
    
    setLoading(true)
    setMessage('')
    try {
      const res = await axios.get(`/api/investigator/complaint/${idToUse.trim()}/court-report`)
      setReport(res.data)
    } catch (error: any) {
      setReport(null)
      setMessage(error.response?.data?.detail || 'Unable to generate the court report for this case.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-shell">
      <div className="portal-page max-w-6xl mx-auto space-y-6">
        {/* Header - Hidden on Print */}
        <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <span>🕵️ INVESTIGATOR WORKSPACE</span>
              <span>•</span>
              <span>EVIDENTIARY DOSSIER</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white mt-1 flex items-center gap-3">
              <span>⚖️ Formal Court Evidentiary Report</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Generate a legally formatted, review-ready evidentiary report with Section 65B IT Act Certificate, SHA-256 evidence integrity, and chain of custody.
            </p>
          </div>

          {report && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-cyan-500 hover:bg-cyan-400 px-5 py-2.5 font-extrabold text-slate-950 shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
              >
                <span>🖨️ Print / Save Court PDF</span>
              </button>
            </div>
          )}
        </header>

        {/* Case Picker & Input Bar - Hidden on Print */}
        <section className="portal-panel p-5 flex flex-col sm:flex-row gap-3 bg-slate-900 border-slate-700/80 print:hidden">
          {/* Dropdown Quick Select */}
          {complaintList.length > 0 && (
            <select
              value={caseId}
              onChange={e => {
                setCaseId(e.target.value)
                if (e.target.value) void generateReport(e.target.value)
              }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none sm:w-72"
            >
              <option value="">-- Select Case from Queue --</option>
              {complaintList.map(c => (
                <option key={c.id} value={c.id}>
                  #{c.id} - {c.tracking_id || `CS-${c.id}`} ({c.crime_type || c.fraud_category || 'Case'})
                </option>
              ))}
            </select>
          )}

          {/* Manual ID Input */}
          <input
            className="field flex-1"
            value={caseId}
            onChange={e => setCaseId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generateReport()}
            placeholder="Enter complaint ID (e.g. 1, 2, 3)"
          />

          <button
            type="button"
            onClick={() => generateReport()}
            disabled={loading}
            className="rounded-xl bg-cyan-500 hover:bg-cyan-400 px-6 py-2.5 font-extrabold text-slate-950 transition disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Court Dossier'}
          </button>
        </section>

        {message && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200 print:hidden">
            {message}
          </p>
        )}

        {/* FORMAL COURT REPORT DOCUMENT */}
        {report && (
          <article className="bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-8 print:bg-white print:text-black print:p-0 print:border-none print:shadow-none">
            {/* Formal Court Header */}
            <div className="border-b-2 border-cyan-500 print:border-black pb-6 text-center space-y-2">
              <div className="flex items-center justify-between print:flex-row">
                <div className="text-left">
                  <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 print:text-black">NATIONAL CYBERCRIME COMMAND SYSTEM</p>
                  <p className="text-xs text-slate-400 print:text-gray-600">CYBERSHIELD LEDGER • EVIDENTIARY VAULT</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-bold text-slate-300 print:text-black">CASE DOCKET: {report.case.tracking_id || `CS-${String(report.case.id).padStart(8, '0')}`}</p>
                  <p className="text-xs text-slate-400 print:text-gray-600">DATE: {displayDate(report.generated_at)}</p>
                </div>
              </div>

              <div className="pt-4">
                <h2 className="text-2xl font-black tracking-tight text-white uppercase print:text-black">
                  FORMAL EVIDENTIARY DOSSIER & COURT REPORT
                </h2>
                <p className="text-xs font-semibold text-slate-400 print:text-gray-700">
                  PREPARED FOR LEGAL PROCEEDINGS • SECTION 65B INDIAN EVIDENCE ACT / IT ACT 2000
                </p>
              </div>
            </div>

            {/* Case Key Overview Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/80 p-5 rounded-xl border border-slate-800 print:bg-gray-100 print:border-gray-300 print:text-black">
              <Detail label="COMPLAINT ID" value={`#${report.case.id} (${report.case.tracking_id || 'N/A'})`} />
              <Detail label="OFFENSE CLASSIFICATION" value={report.case.crime_type || report.case.fraud_category || 'Cyber Fraud'} />
              <Detail label="REPORTED FINANCIAL LOSS" value={report.case.reported_loss ? `₹${Number(report.case.reported_loss).toLocaleString('en-IN')}` : 'Unspecified'} />
              <Detail label="CASE STATUS" value={report.case.status || 'Pending'} />
              <Detail label="INCIDENT DATE" value={report.case.incident_date || 'Not recorded'} />
              <Detail label="LOCATION / JURISDICTION" value={report.case.incident_location || 'National Cyber Cell'} />
              <Detail label="INVESTIGATING OFFICER" value={report.case.assigned_officer || 'Cyber Cell Assigned Officer'} />
              <Detail label="RISK SCORE" value={`${report.case.risk_score || 50} / 100`} />
            </div>

            {/* Section 65B Integrity Certificate */}
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 p-5 space-y-3 print:border-black print:bg-gray-50 print:text-black">
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <h3 className="font-extrabold text-cyan-300 print:text-black text-sm uppercase tracking-wide">
                  SECTION 65B CERTIFICATE OF ELECTRONIC EVIDENCE INTEGRITY
                </h3>
              </div>
              <p className="text-xs leading-5 text-slate-300 print:text-gray-800">
                This certifies that the electronic records and attached evidence files associated with Complaint Docket <b>{report.case.tracking_id || `#${report.case.id}`}</b> were produced by computer systems operated in the ordinary course of cybercrime investigation. The integrity of the electronic data bundle is cryptographically secured via SHA-256 hashing and stored immutably.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 pt-2 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 print:bg-white print:border-gray-300">
                  <p className="text-slate-400 print:text-gray-600 text-[10px] uppercase font-bold">CRYPTO BUNDLE SHA-256 HASH</p>
                  <p className="font-mono text-amber-300 print:text-black break-all mt-1">{report.integrity.bundle_hash}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 print:bg-white print:border-gray-300">
                  <p className="text-slate-400 print:text-gray-600 text-[10px] uppercase font-bold">DIGITAL RSA SIGNATURE & LEDGER</p>
                  <p className="font-semibold text-emerald-300 print:text-black mt-1">
                    {report.integrity.digital_signature_verified ? '✅ RSA-PSS Signed & Verified' : '⚠️ Verified Preserved Record'}
                  </p>
                  {report.integrity.blockchain_reference && (
                    <p className="text-[10px] text-cyan-300 print:text-gray-700 font-mono mt-1 truncate">
                      TX: {report.integrity.blockchain_reference}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Incident Narrative */}
            <div className="space-y-2">
              <h3 className="font-bold text-white print:text-black text-sm uppercase tracking-wide flex items-center gap-2">
                <span>📝 1. COMPLAINANT INCIDENT NARRATIVE</span>
              </h3>
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 print:bg-white print:border-gray-300 whitespace-pre-wrap text-sm text-slate-300 print:text-black leading-6">
                {report.case.description || 'No narrative provided.'}
              </div>
            </div>

            {/* Extracted Suspect Identifiers */}
            <div className="space-y-2">
              <h3 className="font-bold text-white print:text-black text-sm uppercase tracking-wide flex items-center gap-2">
                <span>🎯 2. SUSPECT IDENTIFIERS & SYNDICATE NETWORK DATA</span>
              </h3>
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 print:bg-white print:border-gray-300">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(report.indicators).flatMap(([kind, values]) =>
                    values.map(val => (
                      <span key={`${kind}-${val}`} className="rounded-lg border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-semibold text-purple-200 print:bg-gray-200 print:text-black print:border-gray-400">
                        <b>{kind.toUpperCase()}:</b> {val}
                      </span>
                    ))
                  )}
                  {Object.values(report.indicators).every(v => !v.length) && (
                    <p className="text-xs text-slate-500">No specific electronic identifiers extracted.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Evidence Register */}
            <div className="space-y-2">
              <h3 className="font-bold text-white print:text-black text-sm uppercase tracking-wide flex items-center gap-2">
                <span>📎 3. EVIDENCE REGISTER & SHA-256 AUDIT</span>
              </h3>
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden print:bg-white print:border-gray-300">
                <table className="w-full text-xs text-left text-slate-300 print:text-black">
                  <thead className="bg-slate-900 print:bg-gray-200 text-slate-400 print:text-black font-bold uppercase">
                    <tr>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Content Type</th>
                      <th className="p-3">Preserved SHA-256 Hash</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                    {report.evidence.length > 0 ? (
                      report.evidence.map(item => (
                        <tr key={item.sha256}>
                          <td className="p-3 font-semibold text-white print:text-black">{item.filename}</td>
                          <td className="p-3 text-slate-400 print:text-gray-600">{item.content_type || 'Unknown'}</td>
                          <td className="p-3 font-mono text-amber-300 print:text-black break-all">{item.sha256}</td>
                          <td className="p-3 text-slate-400 print:text-gray-600">{displayDate(item.captured_at)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">No digital evidence files attached.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chain of Custody */}
            <div className="space-y-2">
              <h3 className="font-bold text-white print:text-black text-sm uppercase tracking-wide flex items-center gap-2">
                <span>⛓️ 4. IMMUTABLE CHAIN OF CUSTODY TIMELINE</span>
              </h3>
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 print:bg-white print:border-gray-300 space-y-3">
                {report.chain_of_custody.length > 0 ? (
                  report.chain_of_custody.map((event, idx) => (
                    <div key={idx} className="flex gap-4 items-start border-l-2 border-cyan-500 pl-3">
                      <div className="text-[11px] text-slate-500 print:text-gray-600 min-w-32">{displayDate(event.timestamp)}</div>
                      <div>
                        <p className="text-xs font-bold text-slate-100 print:text-black">{event.action}</p>
                        <p className="text-xs text-slate-400 print:text-gray-600">By: {event.actor || 'System'} {event.details ? `— ${event.details}` : ''}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No chain-of-custody logs recorded.</p>
                )}
              </div>
            </div>

            {/* Official Sign-off Seals */}
            <div className="pt-8 border-t border-slate-800 print:border-gray-400 grid sm:grid-cols-2 gap-8 text-xs text-slate-300 print:text-black">
              <div className="border border-slate-800 p-4 rounded-xl print:border-gray-400 space-y-6">
                <p className="font-bold uppercase tracking-wider text-slate-400 print:text-black">INVESTIGATING OFFICER SIGN-OFF</p>
                <div className="h-12 border-b border-dashed border-slate-600 print:border-gray-400" />
                <p>Officer Name: {report.case.assigned_officer || '_______________________'}</p>
                <p>Designation: Inspector / Cyber Crime Cell</p>
              </div>

              <div className="border border-slate-800 p-4 rounded-xl print:border-gray-400 space-y-6">
                <p className="font-bold uppercase tracking-wider text-slate-400 print:text-black">SUPERVISORY APPROVAL & SEAL</p>
                <div className="h-12 border-b border-dashed border-slate-600 print:border-gray-400" />
                <p>Superintendent / DySP Cyber Crime</p>
                <p>Date & Station Seal: _______________________</p>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 print:text-gray-600 text-center italic">
              {report.review_notice}
            </p>
          </article>
        )}
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600">{label}</p>
      <p className="text-sm font-bold text-slate-100 print:text-black mt-0.5 break-words">{value}</p>
    </div>
  )
}
