import { useState } from 'react'
import axios from 'axios'

export default function ScamChecker() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const check = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await axios.get('/api/citizen/scam-check', { params: { query: query.trim() } })
      setResult(res.data)
    } catch {
      setResult({ found: false, message: 'Error checking. Try again.', risk: 'unknown' })
    }
    setLoading(false)
  }

  const riskColors: Record<string, string> = {
    'high': 'bg-red-900/50 border-red-500 text-red-300',
    'medium': 'bg-yellow-900/50 border-yellow-500 text-yellow-300',
    'low': 'bg-green-900/50 border-green-500 text-green-300',
    'unknown': 'bg-gray-900/50 border-gray-500 text-gray-300',
  }

  const riskIcons: Record<string, string> = {
    'high': '🚨',
    'medium': '⚠️',
    'low': '✅',
    'unknown': '❓',
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cyan-400">⚠️ Scam Checker</h1>
        <p className="text-gray-400 mt-1">Check if a phone number, UPI ID, or name has been reported in scams</p>
      </div>

      {/* Search Form */}
      <form onSubmit={check} className="mb-8">
        <div className="relative">
          <input className="w-full p-4 bg-gray-800 border-2 border-gray-700 rounded-xl text-lg 
            focus:border-cyan-500 transition-colors pr-32"
            placeholder="Enter phone number, UPI ID, or scammer name..."
            value={query} onChange={e => setQuery(e.target.value)} />
          <button className="absolute right-2 top-2 px-6 py-2 bg-cyan-700 hover:bg-cyan-600 
            rounded-lg font-bold transition-all" disabled={loading}>
            {loading ? '⏳' : '🔍 Check'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Examples: +919876543210 | scammer@upi | "SBI fraud call"
        </p>
      </form>

      {searched && !loading && result && (
        <div className={`p-6 rounded-xl border-2 mb-8 ${riskColors[result.risk] || riskColors.unknown}`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{riskIcons[result.risk] || '❓'}</span>
            <div>
              <h2 className="text-xl font-bold">
                {result.found ? '⚠️ Identifier Found in Reports' : '✅ No Reports Found'}
              </h2>
              <p className="opacity-80">{result.message}</p>
            </div>
          </div>

          {result.found && (
            <>
              <div className="flex gap-4 mb-4">
                <div className="bg-black/30 p-3 rounded-lg">
                  <p className="text-xs opacity-70">Risk Level</p>
                  <p className="text-xl font-bold uppercase">{result.risk}</p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg">
                  <p className="text-xs opacity-70">Reports</p>
                  <p className="text-xl font-bold">{result.total_reports}</p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg">
                  <p className="text-xs opacity-70">Risk Score</p>
                  <p className="text-xl font-bold">{result.risk_score}/100</p>
                </div>
              </div>

              {/* Reported Complaints */}
              <h3 className="font-bold mb-3">Related Complaints:</h3>
              <div className="space-y-2">
                {result.complaints?.map((c: any) => (
                  <div key={c.id} className="bg-black/30 p-3 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">#{c.id} {c.title}</p>
                      <p className="text-sm opacity-70">{c.crime_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-70">{c.created_at?.slice(0, 10)}</p>
                      <p className="text-sm">{c.status}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 bg-red-900/30 p-4 rounded-lg">
                <p className="font-bold mb-1">🛡️ Recommended Actions:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Do NOT send money or share personal details</li>
                  <li>Block this number/UPI ID immediately</li>
                  <li>Report to cybercrime.gov.in or call 1930</li>
                  <li>File a complaint on CyberShield Ledger</li>
                </ul>
              </div>
            </>
          )}

          {!result.found && (
            <div className="bg-green-900/30 p-4 rounded-lg">
              <p className="text-sm">No scam reports found for this identifier. Stay vigilant and report any suspicious activity.</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Check Examples */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
        <h3 className="font-bold mb-3">🔍 Try Checking:</h3>
        <div className="flex flex-wrap gap-2">
          {['+919999999999', 'scammer@paytm', 'SBI fraud call', 'invest4you@gmail.com'].map(ex => (
            <button key={ex} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              onClick={() => { setQuery(ex); setSearched(false); setResult(null) }}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
