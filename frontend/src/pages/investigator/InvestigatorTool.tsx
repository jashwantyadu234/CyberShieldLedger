import { useState } from 'react'
import axios from 'axios'

type Mode = 'evidence' | 'financial' | 'notes' | 'court'

const pageCopy: Record<Mode, { eyebrow: string; title: string; description: string }> = {
  evidence: { eyebrow: 'Investigator / Evidence intelligence', title: 'Evidence viewer', description: 'Inspect encrypted evidence metadata and download an authorised copy for forensic review.' },
  financial: { eyebrow: 'Investigator / Threat intelligence', title: 'Financial flow', description: 'Review reported payment paths and beneficiary identifiers associated with a case.' },
  notes: { eyebrow: 'Investigator / Case collaboration', title: 'Investigation notes', description: 'Create assigned follow-up tasks and keep a durable investigation record.' },
  court: { eyebrow: 'Investigator / Legal readiness', title: 'Court report', description: 'Generate a review draft from the case record, preserved evidence, and chain of custody.' },
}

export default function InvestigatorTool({ mode }: { mode: Mode }) {
  const [caseId, setCaseId] = useState('')
  const [data, setData] = useState<any>(null)
  const [note, setNote] = useState('')
  const [assignee, setAssignee] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const copy = pageCopy[mode]

  const load = async () => {
    if (!caseId.trim()) return setMessage('Enter a complaint ID first.')
    setLoading(true); setMessage('')
    try {
      const url = mode === 'evidence' ? `/api/complaints/${caseId}/evidence` : mode === 'court' ? `/api/investigator/complaint/${caseId}/court-report` : `/api/investigator/complaint/${caseId}/intelligence`
      setData((await axios.get(url)).data)
    } catch (error: any) { setData(null); setMessage(error.response?.data?.detail || 'Unable to load this case workspace.') }
    finally { setLoading(false) }
  }

  const download = async (item: any) => {
    try { const response = await axios.get(`/api/evidence/${item.id}/download`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = item.filename; link.click(); URL.revokeObjectURL(url) }
    catch { setMessage('Evidence download failed.') }
  }

  const addNote = async () => {
    if (!note.trim()) return setMessage('Enter a note or task description.')
    try { await axios.post(`/api/investigator/complaint/${caseId}/notes`, { body: note, assignee: assignee || undefined }); setNote(''); setAssignee(''); await load() }
    catch (error: any) { setMessage(error.response?.data?.detail || 'Unable to add the task.') }
  }

  const setStatus = async (taskId: number, taskStatus: string) => {
    try { await axios.put(`/api/investigator/complaint/${caseId}/tasks/${taskId}`, { task_status: taskStatus }); await load() }
    catch { setMessage('Unable to update task status.') }
  }

  return <div className="portal-shell"><div className="portal-page max-w-5xl mx-auto space-y-6"><header><p className="portal-eyebrow">{copy.eyebrow}</p><h1 className="portal-title mt-2">{copy.title}</h1><p className="portal-muted mt-2">{copy.description}</p></header><section className="portal-panel p-5 flex flex-col sm:flex-row gap-3"><input className="field flex-1" value={caseId} onChange={event => setCaseId(event.target.value)} placeholder="Enter complaint ID (for example, 12)" /><button type="button" onClick={load} className="rounded-xl bg-cyan-500 px-5 py-2.5 font-extrabold text-slate-950">{loading ? 'Loading…' : mode === 'court' ? 'Generate report' : 'Open case'}</button></section>{message && <p className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200">{message}</p>}
    {data && mode === 'evidence' && <section className="portal-panel p-5"><h2 className="font-bold text-white">Encrypted evidence files</h2><p className="mt-1 text-xs text-slate-400">AES-256-GCM encrypted at rest · SHA-256 integrity identifiers.</p><div className="mt-4 space-y-2">{data.length ? data.map((item: any) => <div key={item.id} className="flex flex-col gap-3 rounded-lg bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold text-slate-100">{item.filename}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">SHA-256: {item.sha256}</p></div><button type="button" onClick={() => download(item)} className="text-sm font-bold text-cyan-300">Download ↗</button></div>) : <p className="text-sm text-slate-500">No evidence files are attached to this case.</p>}</div></section>}
    {data && mode === 'financial' && <section className="portal-panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Reported payment path</h2><p className="mt-1 text-xs text-slate-400">Use this as an investigation lead; confirm through the relevant provider.</p></div>{data.financial_flow.reported_amount ? <b className="text-amber-300">₹{Number(data.financial_flow.reported_amount).toLocaleString('en-IN')}</b> : null}</div>{data.financial_flow.available ? <div className="mt-6 flex flex-wrap items-center gap-2">{data.financial_flow.nodes.map((node: any, index: number) => <div key={`${node.type}-${node.label}`} className="flex items-center gap-2">{index > 0 && <span className="text-cyan-300">→</span>}<div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2"><p className="text-[10px] uppercase text-slate-500">{node.title || node.type}</p><p className="max-w-[250px] break-all font-mono text-sm text-amber-100">{node.label}</p></div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">{data.financial_flow.assessment}</p>}<p className="mt-5 text-xs text-slate-500">{data.financial_flow.assessment}</p></section>}
    {data && mode === 'notes' && <section className="portal-panel p-5"><h2 className="font-bold text-white">Case notes and tasks</h2><div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px_auto]"><input className="field" value={note} onChange={event => setNote(event.target.value)} placeholder="Write an investigation note or task…" /><input className="field" value={assignee} onChange={event => setAssignee(event.target.value)} placeholder="Assign to" /><button type="button" onClick={addNote} className="rounded-lg bg-violet-600 px-4 py-2 font-bold">Add task</button></div><div className="mt-5 space-y-2">{data.notes.length ? data.notes.map((item: any) => <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-slate-950 p-3 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-sm text-slate-200">{item.body}</p><p className="mt-1 text-xs text-slate-500">{item.author} · {item.assignee || 'Unassigned'} · {item.created_at?.slice(0, 16).replace('T', ' ')}</p></div><select value={item.status} onChange={event => setStatus(item.id, event.target.value)} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></div>) : <p className="text-sm text-slate-500">No notes or tasks for this case.</p>}</div></section>}
    {data && mode === 'court' && <section className="portal-panel p-5"><p className="text-sm font-bold text-cyan-200">{data.document_type}</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Summary label="Case" value={data.case.tracking_id || `#${data.case.id}`} /><Summary label="Evidence files" value={String(data.integrity.evidence_count)} /><Summary label="Digital signature" value={data.integrity.digital_signature_verified ? 'Verified' : 'Not verified'} /></div><h2 className="mt-6 font-bold text-white">Integrity bundle hash</h2><p className="mt-2 break-all rounded-lg bg-slate-950 p-3 font-mono text-xs text-amber-300">{data.integrity.bundle_hash}</p><h2 className="mt-6 font-bold text-white">Chain of custody</h2><div className="mt-3 space-y-2">{data.chain_of_custody.map((item: any, index: number) => <div key={index} className="rounded-lg bg-slate-950 p-3 text-sm"><b>{item.action}</b><p className="mt-1 text-xs text-slate-400">{item.actor} · {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}</p></div>)}</div><p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{data.review_notice}</p></section>}
  </div></div>
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-950 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-100">{value}</p></div> }
