import { useState } from 'react'
import axios from 'axios'

export default function InvestigatorLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', badge_id: '' })
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (mode === 'register') {
        await axios.post('/api/auth/register', {
          name: form.name, email: form.email, password: form.password,
          role: 'investigator', badge_id: form.badge_id,
        })
        setMessage('✅ Application submitted! Wait for admin approval.')
        setMode('login')
      } else {
        const res = await axios.post('/api/auth/login', {
          email: form.email, password: form.password,
        })
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        window.location.href = '/investigator'
      }
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.detail || 'Error'}`)
    }
  }

  return (
    <div className="login-shell min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-600 
            flex items-center justify-center text-4xl shadow-lg shadow-purple-200/50">
            🕵️
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Investigator Portal</h1>
          <p className="text-gray-600 mt-1 font-medium">Authorized law enforcement personnel only</p>
        </div>

        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span className="text-sm font-bold text-amber-800">This portal is for authorized investigators only</span>
        </div>

        <div className="flex bg-white rounded-xl p-1 mb-4 shadow-sm border border-gray-200">
          <button onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === 'login' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-800'
            }`}>
            🔒 Sign In
          </button>
          <button onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === 'register' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-800'
            }`}>
            📋 Apply as Investigator
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-xl mb-4 text-sm font-medium text-center ${
            message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' :
            message.includes('❌') ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-gray-50 text-gray-700 border border-gray-200'
          }`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">Full Name</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-purple-500 
                      focus:ring-2 focus:ring-purple-200 outline-none transition-all text-gray-800 font-medium"
                    placeholder="Officer's full name" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">Badge ID</label>
                  <input type="text" value={form.badge_id} onChange={e => setForm({...form, badge_id: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-purple-500 
                      focus:ring-2 focus:ring-purple-200 outline-none transition-all text-gray-800 font-medium font-mono"
                    placeholder="INV-001" required />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Official Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-purple-500 
                  focus:ring-2 focus:ring-purple-200 outline-none transition-all text-gray-800 font-medium"
                placeholder="officer@police.gov" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-purple-500 
                  focus:ring-2 focus:ring-purple-200 outline-none transition-all text-gray-800 font-medium"
                placeholder="Enter secure password" required />
            </div>
            <button type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white 
                rounded-xl font-bold text-base hover:shadow-lg hover:shadow-purple-200/50 
                transition-all duration-300 shadow-md">
              {mode === 'register' ? '📋 Submit Application' : '🔒 Access Dashboard'}
            </button>
          </form>

          {mode === 'register' && (
            <p className="text-sm text-gray-700 mt-4 text-center font-medium bg-amber-50 p-3 rounded-lg border border-amber-200">
              ⏳ Applications require <span className="font-bold">admin approval</span> before accessing the portal
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
