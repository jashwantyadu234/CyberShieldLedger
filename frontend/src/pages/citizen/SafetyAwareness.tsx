import { useEffect, useState } from 'react'
import axios from 'axios'

interface SafetyTip {
  id: number
  category: string
  title: string
  description: string
  icon: string
  severity: string
}

export default function SafetyAwareness() {
  const [tips, setTips] = useState<SafetyTip[]>([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [expandedTip, setExpandedTip] = useState<number | null>(null)

  useEffect(() => {
    axios.get('/api/citizen/safety-tips').then(r => setTips(r.data))
  }, [])

  const categories = ['All', ...new Set(tips.map(t => t.category))]
  const filtered = activeCategory === 'All' ? tips : tips.filter(t => t.category === activeCategory)

  const severityColors: Record<string, string> = {
    'critical': 'bg-red-900/50 border-red-700 text-red-300',
    'high': 'bg-orange-900/50 border-orange-700 text-orange-300',
    'medium': 'bg-yellow-900/50 border-yellow-700 text-yellow-300',
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 p-8 rounded-2xl border border-cyan-800 mb-8">
        <h1 className="text-4xl font-bold text-cyan-400 mb-2">🛡️ Safety Awareness</h1>
        <p className="text-gray-300 text-lg mb-4">
          Knowledge is your best defense against cybercrime
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Stat icon="📞" label="Helpline" value="1930" />
          <Stat icon="🌐" label="Portal" value="cybercrime.gov.in" />
          <Stat icon="⚡" label="Response" value="24/7" />
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button key={cat}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === cat 
                ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-900/30' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            onClick={() => setActiveCategory(cat)}>
            {cat === 'All' ? '📋 All Tips' : cat}
          </button>
        ))}
      </div>

      {/* Tips Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map(tip => (
          <div key={tip.id} 
            className={`bg-gray-800 p-5 rounded-xl border-2 cursor-pointer transition-all ${
              expandedTip === tip.id 
                ? 'border-cyan-600 shadow-lg shadow-cyan-900/20' 
                : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => setExpandedTip(expandedTip === tip.id ? null : tip.id)}>
            
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{tip.icon}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${severityColors[tip.severity]}`}>
                {tip.severity.toUpperCase()}
              </span>
            </div>
            <h3 className="font-bold mb-1">{tip.title}</h3>
            <p className={`text-sm text-gray-400 ${expandedTip !== tip.id && 'line-clamp-2'}`}>
              {tip.description}
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">{tip.category}</span>
              <span className="text-cyan-400 text-sm">
                {expandedTip === tip.id ? '▲ Less' : '▼ More'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Emergency Section */}
      <div className="mt-8 bg-red-900/20 border-2 border-red-800 p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">🚨</span>
          <div>
            <h2 className="text-2xl font-bold text-red-400">Emergency?</h2>
            <p className="text-gray-400">If you're currently being scammed or in immediate danger</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Call Helpline</p>
            <p className="text-3xl font-bold text-red-400">1930</p>
          </div>
          <div className="bg-black/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Visit Portal</p>
            <p className="text-lg font-bold text-cyan-400">cybercrime.gov.in</p>
          </div>
          <div className="bg-black/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Freeze Bank Account</p>
            <p className="text-lg font-bold">Call your bank now</p>
          </div>
          <div className="bg-black/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">File a Report</p>
            <a href="/citizen/register" className="text-lg font-bold text-cyan-400 hover:underline">
              File on CyberShield →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white/5 p-3 rounded-lg text-center">
      <span className="text-xl">{icon}</span>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-bold text-cyan-400">{value}</p>
    </div>
  )
}
