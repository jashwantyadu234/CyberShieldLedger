import { useEffect, useState } from 'react'
import axios from 'axios'

export default function ThreatIntelligence() {
  const [topPhones, setTopPhones] = useState<any[]>([])
  const [topUpis, setTopUpis] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])

  useEffect(() => {
    axios.get('/api/admin/threats/top-phone-numbers').then(r => setTopPhones(r.data))
    axios.get('/api/admin/threats/top-upis').then(r => setTopUpis(r.data))
    axios.get('/api/admin/threats/campaigns').then(r => setCampaigns(r.data))
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-cyan-400">🕵️ Threat Intelligence</h1>
        <span className="px-2 py-1 bg-red-900 text-red-300 rounded text-xs font-bold animate-pulse">
          LIVE
        </span>
      </div>
      <p className="text-gray-400 mb-8">Automated threat detection & fraud campaign analysis</p>

      {/* Top Threats Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Top Phone Numbers */}
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
          <h2 className="text-lg font-bold mb-4 text-yellow-400">📞 Top Scam Phone Numbers</h2>
          <div className="space-y-2">
            {topPhones.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-500 w-6">#{i + 1}</span>
                  <div>
                    <p className="font-mono text-sm font-bold">{item.phone}</p>
                    <p className="text-xs text-gray-500">Reported in {item.count} complaints</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  item.count >= 10 ? 'bg-red-900 text-red-300' :
                  item.count >= 5 ? 'bg-yellow-900 text-yellow-300' :
                  'bg-orange-900 text-orange-300'
                }`}>
                  {item.count}x
                </span>
              </div>
            ))}
            {topPhones.length === 0 && (
              <p className="text-gray-500 text-center py-4">No phone numbers tracked yet</p>
            )}
          </div>
        </div>

        {/* Top UPI IDs */}
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
          <h2 className="text-lg font-bold mb-4 text-orange-400">💳 Top UPI IDs</h2>
          <div className="space-y-2">
            {topUpis.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-500 w-6">#{i + 1}</span>
                  <div>
                    <p className="font-mono text-sm font-bold">{item.upi}</p>
                    <p className="text-xs text-gray-500">Reported in {item.count} complaints</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  item.count >= 10 ? 'bg-red-900 text-red-300' :
                  item.count >= 5 ? 'bg-yellow-900 text-yellow-300' :
                  'bg-orange-900 text-orange-300'
                }`}>
                  {item.count}x
                </span>
              </div>
            ))}
            {topUpis.length === 0 && (
              <p className="text-gray-500 text-center py-4">No UPI IDs tracked yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Fraud Campaigns */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 mb-8">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold">🚨 Detected Fraud Campaigns</h2>
          <span className="text-sm text-red-400">{campaigns.length} active campaigns</span>
        </div>
        <div className="p-4">
          {campaigns.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {campaigns.map((camp, i) => (
                <div key={i} className="bg-gray-900 p-4 rounded-lg border border-red-900/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-red-400">Campaign #{i + 1}</p>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      camp.risk_level === 'high' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
                    }`}>
                      {camp.risk_level.toUpperCase()} RISK
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-1">
                    Indicator: <span className="font-mono text-yellow-400">{camp.indicator}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Type: <span className="font-medium">{camp.type}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Linked Complaints: <span className="font-bold text-cyan-400">{camp.complaint_count}</span>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button className="text-xs px-2 py-1 bg-cyan-900 text-cyan-300 rounded">View All</button>
                    <button className="text-xs px-2 py-1 bg-red-900 text-red-300 rounded">Flag</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">🛡️</p>
              <p>No fraud campaigns detected yet</p>
              <p className="text-sm">Campaigns appear when 2+ complaints share the same phone or UPI</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
        <h2 className="text-lg font-bold mb-4">⚡ Threat Response</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Block Number', icon: '🚫', color: 'bg-red-900 hover:bg-red-800' },
            { label: 'Freeze UPI', icon: '❄️', color: 'bg-blue-900 hover:bg-blue-800' },
            { label: 'Alert All Victims', icon: '📢', color: 'bg-yellow-900 hover:bg-yellow-800' },
            { label: 'Generate Report', icon: '📄', color: 'bg-green-900 hover:bg-green-800' },
          ].map(action => (
            <button key={action.label} className={`${action.color} p-3 rounded-lg text-center transition-colors`}>
              <span className="text-2xl block mb-1">{action.icon}</span>
              <span className="text-sm font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
