import { useState } from 'react'
import axios from 'axios'

export default function BlockchainVerify() {
  const [complaintId, setComplaintId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [signatureResult, setSignatureResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [recentVerifications, setRecentVerifications] = useState<any[]>([])
  const [tab, setTab] = useState<'integrity' | 'signature'>('integrity')

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complaintId) return
    setLoading(true)
    try {
      const [verifyRes, sigRes] = await Promise.all([
        axios.get(`/api/complaints/${complaintId}/verify`),
        axios.get(`/api/signatures/${complaintId}`).catch(() => ({ data: { exists: false } })),
      ])
      setResult(verifyRes.data)
      setSignatureResult(sigRes.data)
      setRecentVerifications(prev => [verifyRes.data, ...prev].slice(0, 10))
    } catch (err: any) {
      setResult({ error: err.response?.data?.detail || 'Verification failed' })
    }
    setLoading(false)
  }

  return (
    <div className="portal-shell">
      <div className="portal-page max-w-5xl mx-auto space-y-8">
        <header>
          <p className="portal-eyebrow">Blockchain forensics / Evidence integrity</p>
          <h1 className="portal-title mt-2">⛓️ Cryptographic Verification</h1>
          <p className="portal-muted mt-2">Verify complaint integrity against the blockchain, bundle hash, and digital signature</p>
        </header>

        {/* Search */}
        <form onSubmit={verify} className="portal-panel p-6">
          <label className="block text-sm text-slate-400 mb-2 font-bold">Complaint ID</label>
          <div className="flex gap-3">
            <input className="flex-1 p-3 bg-slate-950 border border-slate-700 rounded-xl text-lg font-mono text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
              placeholder="Enter complaint ID (e.g., 42)" value={complaintId}
              onChange={e => setComplaintId(e.target.value)} />
            <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-bold transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50"
              disabled={loading}>
              {loading ? '⏳ Verifying...' : '⛓️ Verify All'}
            </button>
          </div>
        </form>

        {/* Results */}
        {result && !result.error && (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-2">
              <button onClick={() => setTab('integrity')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  tab === 'integrity'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}>
                ⛓️ Bundle Integrity
              </button>
              <button onClick={() => setTab('signature')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  tab === 'signature'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}>
                🔑 Digital Signature
              </button>
            </div>

            {/* Integrity Tab */}
            {tab === 'integrity' && (
              <>
                <div className={`p-8 rounded-2xl border-2 ${
                  result.verified
                    ? 'bg-green-900/20 border-green-500/50 shadow-lg shadow-green-500/10'
                    : 'bg-red-900/20 border-red-500/50 shadow-lg shadow-red-500/10'
                }`}>
                  <div className="flex items-center gap-5">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${
                      result.verified ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {result.verified ? '✅' : '❌'}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {result.verified ? 'Evidence Bundle is INTACT' : 'Evidence Bundle TAMPERING DETECTED'}
                      </h2>
                      <p className="text-slate-400 mt-1">
                        {result.verified
                          ? 'The complaint bundle hash on the database matches the blockchain record. All evidence is cryptographically verified.'
                          : 'The computed hash does not match the stored blockchain record. Data may have been modified!'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="portal-panel p-6">
                  <h2 className="text-lg font-bold text-white mb-4">🔍 Hash Comparison (SHA-256 Bundle)</h2>
                  <div className="space-y-4">
                    <HashRow label="Computed Bundle Hash" hash={result.computed_hash}
                      match={result.computed_hash === result.db_hash} />
                    <HashRow label="Stored Database Hash" hash={result.db_hash}
                      match={result.db_hash === result.on_chain_hash} />
                    <HashRow label="On-Chain Hash" hash={result.on_chain_hash}
                      match={result.on_chain_hash === result.db_hash} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="portal-panel p-4">
                    <p className="text-xs text-slate-400">Complaint ID</p>
                    <p className="text-xl font-bold text-white">#{result.complaint_id}</p>
                  </div>
                  <div className="portal-panel p-4">
                    <p className="text-xs text-slate-400">Current Status</p>
                    <p className="text-xl font-bold text-cyan-400">{result.status}</p>
                  </div>
                  <div className="portal-panel p-4">
                    <p className="text-xs text-slate-400">Blockchain TX</p>
                    <p className="text-sm font-mono text-slate-400 truncate" title={result.blockchain_tx}>
                      {result.blockchain_tx?.slice(0, 20) || 'N/A'}...
                    </p>
                  </div>
                </div>

                {/* Tamper Simulation */}
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-6">
                  <h3 className="font-bold text-amber-400 mb-3">🧪 Simulate Tampering (Demo)</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Click below to simulate what happens when evidence is tampered with. Any modification to the complaint
                    data or evidence files produces a different bundle hash.
                  </p>
                  <button className="px-4 py-2.5 bg-amber-700 hover:bg-amber-600 rounded-xl text-sm font-bold transition-all"
                    onClick={() => setResult({
                      ...result,
                      computed_hash: result.computed_hash + 'tampered',
                      verified: false,
                    })}>
                    🧪 Simulate Tampering
                  </button>
                </div>
              </>
            )}

            {/* Signature Tab */}
            {tab === 'signature' && (
              <div className="space-y-6">
                <div className={`p-8 rounded-2xl border-2 ${
                  signatureResult?.exists
                    ? 'bg-purple-900/20 border-purple-500/50 shadow-lg shadow-purple-500/10'
                    : 'bg-amber-900/20 border-amber-500/50 shadow-lg shadow-amber-500/10'
                }`}>
                  <div className="flex items-center gap-5">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${
                      signatureResult?.exists ? 'bg-purple-500/20' : 'bg-amber-500/20'
                    }`}>
                      {signatureResult?.exists ? '🔑' : '⏳'}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {signatureResult?.exists ? 'Digitally Signed by Complainant' : 'No Digital Signature Found'}
                      </h2>
                      <p className="text-slate-400 mt-1">
                        {signatureResult?.exists
                          ? `The complaint was cryptographically signed using ${signatureResult.algorithm || 'RSA-PSS'} with a browser-held keypair.`
                          : 'This complaint was not cryptographically signed at submission time.'}
                      </p>
                    </div>
                  </div>
                </div>

                {signatureResult?.exists && (
                  <div className="portal-panel p-6">
                    <h2 className="text-lg font-bold text-white mb-4">🔑 Signature Details</h2>
                    <div className="space-y-4">
                      <div className="bg-slate-950 rounded-xl p-4 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Algorithm</p>
                        <p className="text-sm font-bold text-purple-300">{signatureResult.algorithm || 'RSA-PSS-SHA256'}</p>
                      </div>
                      <div className="bg-slate-950 rounded-xl p-4 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Hash Verification</p>
                        <p className={`text-sm font-bold ${signatureResult.verified ? 'text-green-400' : 'text-red-400'}`}>
                          {signatureResult.verified ? '✅ Bundle hash matches signed hash' : '❌ Bundle hash does not match'}
                        </p>
                      </div>
                      <div className="bg-slate-950 rounded-xl p-4 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Signed At</p>
                        <p className="text-sm font-bold text-cyan-300">{signatureResult.created_at || 'N/A'}</p>
                      </div>
                      <div className="bg-slate-950 rounded-xl p-4 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Public Key (SPKI)</p>
                        <p className="text-xs font-mono text-slate-400 break-all">{signatureResult.public_key_pem?.slice(0, 120)}...</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {result?.error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
            <p className="text-red-300">❌ {result.error}</p>
          </div>
        )}

        {/* Recent Verifications */}
        {recentVerifications.length > 0 && (
          <div className="portal-panel">
            <div className="p-4 border-b border-slate-700/70">
              <h2 className="font-bold text-white">📋 Recent Verifications</h2>
            </div>
            <div className="divide-y divide-slate-700/50">
              {recentVerifications.map((v, i) => (
                <div key={i} className="p-4 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className={v.verified ? 'text-green-400' : 'text-red-400'}>
                      {v.verified ? '✅' : '❌'}
                    </span>
                    <span className="font-bold text-white">#{v.complaint_id}</span>
                    <span className="text-slate-400">{v.status}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{v.blockchain_tx?.slice(0, 16)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HashRow({ label, hash, match }: { label: string; hash?: string; match?: boolean }) {
  return (
    <div className="bg-slate-950 rounded-xl p-4 border border-slate-700/50">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-bold text-white">{label}</p>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
          match ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        }`}>
          {match === undefined ? '—' : match ? '✓ Match' : '✗ Mismatch'}
        </span>
      </div>
      <p className="text-xs font-mono text-slate-400 break-all">{hash || 'N/A'}</p>
    </div>
  )
}
