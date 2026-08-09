import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { getOrCreateSigningKeyPair, signComplaintHash } from '../../services/api'

const categories = ['Financial Fraud', 'Phishing', 'Identity Theft', 'Crypto Scam', 'Online Shopping Fraud', 'Social Media Fraud', 'Other Cybercrime']
const steps = ['Personal information', 'Fraud category', 'Transaction & suspect', 'Description & evidence', 'Review & submit']

type IntakeForm = {
  title: string; citizen_name: string; citizen_email: string; contact_number: string; incident_date: string; location: string
  fraud_category: string; phone_number: string; upi_id: string; bank_account: string; crypto_wallet: string; website_url: string
  suspect_email: string; transaction_amount: string; description: string; anonymous: boolean
}

const emptyForm: IntakeForm = { title: '', citizen_name: '', citizen_email: '', contact_number: '', incident_date: '', location: '', fraud_category: '', phone_number: '', upi_id: '', bank_account: '', crypto_wallet: '', website_url: '', suspect_email: '', transaction_amount: '', description: '', anonymous: false }

export default function RegisterComplaint() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<IntakeForm>(emptyForm)
  const [files, setFiles] = useState<File[]>([])
  const [scanning, setScanning] = useState(false)
  const [ocrResult, setOcrResult] = useState<{ text: string; confidence: number; provider: string } | null>(null)
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setForm(previous => ({ ...previous, citizen_name: user.name || '', citizen_email: user.email || '' }))
    getOrCreateSigningKeyPair().catch(() => undefined)
  }, [])

  const set = (key: keyof IntakeForm, value: string | boolean) => setForm(previous => ({ ...previous, [key]: value }))
  const next = () => {
    setError('')
    if (step === 0 && (!form.anonymous && (!form.citizen_name || !form.citizen_email || !form.contact_number))) return setError('Please provide your name, contact number, and email, or choose anonymous mode.')
    if (step === 1 && !form.fraud_category) return setError('Please select a fraud category.')
    if (step === 3 && (!form.title || form.description.trim().length < 10)) return setError('Please provide a title and a detailed description (at least 10 characters).')
    setStep(value => Math.min(4, value + 1))
  }

  const scanScreenshot = async () => {
    const image = files.find(file => file.type.startsWith('image/') || file.type === 'text/plain')
    if (!image) return setError('Choose a screenshot or text evidence file first, then run OCR.')
    setScanning(true)
    setError('')
    try {
      const body = new FormData(); body.append('file', image)
      const response = await axios.post('/api/ocr/extract', body, { headers: { 'Content-Type': 'multipart/form-data' } })
      const result = response.data
      setForm(previous => ({ ...previous, upi_id: previous.upi_id || result.upi_ids?.[0] || '', phone_number: previous.phone_number || result.phone_numbers?.[0] || '', transaction_amount: previous.transaction_amount || (result.amounts?.[0] || '').replace(/,/g, '') }))
      setOcrResult(result)
    } catch (requestError: any) { setError(requestError.response?.data?.detail || 'OCR could not read this evidence file.') }
    finally {
      setScanning(false)
    }
  }

  const useVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return setError('Voice reporting is not available in this browser. Please use Chrome or Edge.')
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'; recognition.continuous = false; recognition.interimResults = false
    recognition.onresult = (event: any) => setForm(previous => ({ ...previous, description: `${previous.description}${previous.description ? ' ' : ''}${event.results[0][0].transcript}` }))
    recognition.onend = () => setListening(false)
    recognition.onerror = () => { setListening(false); setError('Voice capture could not be completed. Please try again.') }
    recognitionRef.current = recognition; setListening(true); recognition.start()
  }

  const submit = async () => {
    setBusy(true); setError('')
    try {
      const payload = { ...form, phone_number: form.phone_number || form.contact_number, transaction_amount: form.transaction_amount ? Number(form.transaction_amount) : undefined }
      const response = await axios.post('/api/complaints', payload)
      let bundleHash = response.data.evidence_hash
      for (const file of files) {
        const body = new FormData(); body.append('file', file)
        const evidenceResponse = await axios.post(`/api/complaints/${response.data.id}/evidence`, body, { headers: { 'Content-Type': 'multipart/form-data' } })
        bundleHash = evidenceResponse.data.bundle_hash
      }
      const { signatureHex, publicKeyPem } = await signComplaintHash(bundleHash)
      await axios.post('/api/signatures/submit', { complaint_id: response.data.id, public_key_pem: publicKeyPem, signature_hex: signatureHex, signed_hash: bundleHash, algorithm: 'RSA-PSS-SHA256' })
      setResult(response.data)
    } catch (requestError: any) { setError(requestError.response?.data?.detail || 'Unable to submit the complaint. Please try again.') }
    finally { setBusy(false) }
  }

  if (result) return <div className="max-w-3xl mx-auto p-8"><div className="rounded-2xl border border-green-500/30 bg-green-950/30 p-8 text-center"><div className="text-5xl mb-4">✅</div><h1 className="text-3xl font-bold text-white">Complaint submitted securely</h1><p className="text-gray-300 mt-3">Your tracking ID is</p><p className="my-4 text-3xl font-mono font-bold text-cyan-300">{result.tracking_id || `CS-${String(result.id).padStart(8, '0')}`}</p><p className="text-sm text-gray-400">AI triage, evidence hashing, encrypted storage, and investigator routing have started. Save this ID to track your case.</p><a className="inline-block mt-6 rounded-xl bg-cyan-600 px-5 py-3 font-bold" href="/citizen/track">Track complaint →</a></div></div>

  return <div className="max-w-4xl mx-auto p-6 pb-12">
    <div className="mb-8"><p className="text-cyan-400 text-sm font-semibold">CITIZEN INTAKE</p><h1 className="text-3xl font-bold text-white">Report a cybercrime</h1><p className="text-gray-400 mt-1">Complete the secure five-step report. Evidence is encrypted and integrity protected.</p></div>
    <div className="grid grid-cols-5 gap-2 mb-8">{steps.map((name, index) => <button key={name} onClick={() => index <= step && setStep(index)} className={`text-left rounded-lg p-3 text-xs ${index === step ? 'bg-cyan-600 text-white' : index < step ? 'bg-cyan-900/50 text-cyan-200' : 'bg-gray-800 text-gray-500'}`}><b className="block mb-1">{index + 1}</b><span className="hidden sm:block">{name}</span></button>)}</div>
    <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-6">
      {step === 0 && <section className="space-y-4"><Heading icon="👤" title="Personal information" text="Used only for account-linked case communication." /><div className="flex items-center gap-3 rounded-xl bg-purple-950/30 border border-purple-500/30 p-4"><input type="checkbox" checked={form.anonymous} onChange={e => set('anonymous', e.target.checked)} /><div><p className="font-semibold text-purple-200">Anonymous / proof mode</p><p className="text-xs text-gray-400">Your public case record uses anonymous placeholders. This is a privacy demo, not a full ZK identity system.</p></div></div><div className="grid md:grid-cols-2 gap-4"><Field label="Citizen name" value={form.citizen_name} disabled={form.anonymous} onChange={v => set('citizen_name', v)} /><Field label="Contact number" value={form.contact_number} disabled={form.anonymous} onChange={v => set('contact_number', v)} /><Field label="Email address" type="email" value={form.citizen_email} disabled={form.anonymous} onChange={v => set('citizen_email', v)} /><Field label="Date of incident" type="date" value={form.incident_date} onChange={v => set('incident_date', v)} /><Field label="Location" value={form.location} onChange={v => set('location', v)} /></div></section>}
      {step === 1 && <section><Heading icon="🏷️" title="Fraud category" text="Select the category that best matches the incident." /><div className="grid sm:grid-cols-2 gap-3 mt-5">{categories.map(category => <button key={category} onClick={() => set('fraud_category', category)} className={`rounded-xl border p-4 text-left font-semibold ${form.fraud_category === category ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200' : 'border-gray-700 bg-gray-900/50 text-gray-300'}`}>{category}</button>)}</div></section>}
      {step === 2 && <section><Heading icon="🔎" title="Transaction & suspect details" text="Enter every known identifier. These are used for AI triage, duplicate matching, and campaign detection." /><div className="grid md:grid-cols-2 gap-4 mt-5"><Field label="Suspect phone number" value={form.phone_number} onChange={v => set('phone_number', v)} /><Field label="UPI ID" value={form.upi_id} onChange={v => set('upi_id', v)} /><Field label="Bank account" value={form.bank_account} onChange={v => set('bank_account', v)} /><Field label="Crypto wallet address" value={form.crypto_wallet} onChange={v => set('crypto_wallet', v)} /><Field label="Website URL" value={form.website_url} onChange={v => set('website_url', v)} /><Field label="Suspect email" type="email" value={form.suspect_email} onChange={v => set('suspect_email', v)} /><Field label="Transaction amount (₹)" type="number" value={form.transaction_amount} onChange={v => set('transaction_amount', v)} /></div></section>}
      {step === 3 && <section className="space-y-5"><Heading icon="📎" title="Incident description & evidence" text="Evidence is AES-256-GCM encrypted before storage and added to the cryptographic case bundle." /><Field label="Complaint title" value={form.title} onChange={v => set('title', v)} placeholder="Example: Fake SBI call and UPI transfer" /><div><label className="block text-sm text-gray-300 mb-1">Detailed description</label><textarea className="field min-h-36" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what happened, when, who contacted you, and what was transferred..." /><button type="button" onClick={useVoice} className="mt-2 text-sm text-cyan-300 hover:text-cyan-200">{listening ? '● Listening… speak now' : '🎙️ Add report using voice'}</button></div><div className="rounded-xl border-2 border-dashed border-cyan-800 p-5 text-center"><input type="file" multiple className="block w-full text-sm text-gray-300" accept="image/*,.pdf,audio/*,.txt" onChange={e => setFiles(Array.from(e.target.files || []))} /><p className="text-xs text-gray-500 mt-2">Screenshots, PDFs, receipts, chats, and recordings · 10 MB per file</p></div>{files.length > 0 && <p className="text-sm text-cyan-200">{files.length} evidence file(s) selected: {files.map(f => f.name).join(', ')}</p>}<button type="button" onClick={scanScreenshot} disabled={scanning} className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">{scanning ? 'Scanning screenshot…' : '🧾 Scan payment screenshot (demo)'}</button><p className="text-xs text-gray-500">Demo OCR fills sample UPI, phone, and amount values. Connect Tesseract or Google Vision for production OCR.</p></section>}
      {step === 4 && <section><Heading icon="✅" title="Review & submit" text="Review the information below before creating your secured case." /><div className="mt-5 grid md:grid-cols-2 gap-3 text-sm"><Review label="Category" value={form.fraud_category} /><Review label="Incident date" value={form.incident_date} /><Review label="Amount" value={form.transaction_amount ? `₹${form.transaction_amount}` : 'Not provided'} /><Review label="UPI ID" value={form.upi_id || 'Not provided'} /><Review label="Evidence" value={`${files.length} file(s) — encrypted`} /><Review label="Privacy" value={form.anonymous ? 'Anonymous demo mode' : 'Account-linked report'} /></div><div className="mt-5 rounded-xl bg-gray-900 p-4"><p className="text-sm font-semibold text-white">{form.title}</p><p className="mt-2 text-sm text-gray-400 whitespace-pre-wrap">{form.description}</p></div><div className="mt-5 rounded-xl border border-green-500/30 bg-green-950/20 p-4 text-sm text-green-200">🔐 On submission, a tracking ID is created; AI extracts entities and calculates risk; evidence is encrypted and SHA-256 protected; potential duplicate/campaign signals are sent to investigators.</div></section>}
      {error && <p className="mt-5 rounded-lg bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
      <div className="mt-7 flex justify-between border-t border-gray-700 pt-5"><button onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0 || busy} className="rounded-lg px-4 py-2 text-gray-300 disabled:opacity-40">← Back</button>{step < 4 ? <button onClick={next} className="rounded-lg bg-cyan-600 px-5 py-2 font-bold text-white">Continue →</button> : <button onClick={submit} disabled={busy} className="rounded-lg bg-green-600 px-5 py-2 font-bold text-white disabled:opacity-50">{busy ? 'Securing submission…' : 'Submit secure complaint'}</button>}</div>
    </div>
  </div>
}

function Heading({ icon, title, text }: { icon: string; title: string; text: string }) { return <div><h2 className="text-xl font-bold text-white">{icon} {title}</h2><p className="text-sm text-gray-400 mt-1">{text}</p></div> }
function Field({ label, value, onChange, type = 'text', placeholder, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; disabled?: boolean }) { return <label className="block text-sm text-gray-300">{label}<input className="field mt-1" type={type} value={value} disabled={disabled} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></label> }
function Review({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-gray-900 p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-gray-200 break-words">{value || 'Not provided'}</p></div> }
