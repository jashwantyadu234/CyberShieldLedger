import { useState } from 'react'
import axios from 'axios'

export default function CitizenLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (mode === 'register') {
        await axios.post('/api/auth/register', {
          name: form.name, email: form.email, password: form.password, role: 'citizen',
        })
        setMessage('✅ Registered! You can now login.')
        setMode('login')
      } else {
        const res = await axios.post('/api/auth/login', {
          email: form.email, password: form.password,
        })
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        window.location.href = '/citizen'
      }
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.detail || 'Error'}`)
    }
  }

  return (
    <div className="login-shell min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 
            flex items-center justify-center text-4xl shadow-lg shadow-cyan-200/50">
            👤
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Citizen Portal</h1>
          <p className="text-gray-600 mt-1 font-medium">Report & track cybercrime complaints</p>
        </div>

        <div className="flex bg-white rounded-xl p-1 mb-4 shadow-sm border border-gray-200">
          <button onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === 'login' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-800'
            }`}>
            🔒 Sign In
          </button>
          <button onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === 'register' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-800'
            }`}>
            📝 Create Account
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
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-cyan-500 
                    focus:ring-2 focus:ring-cyan-200 outline-none transition-all text-gray-800 font-medium"
                  placeholder="Your full name" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Email Address</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-cyan-500 
                  focus:ring-2 focus:ring-cyan-200 outline-none transition-all text-gray-800 font-medium"
                placeholder="your@email.com" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-cyan-500 
                  focus:ring-2 focus:ring-cyan-200 outline-none transition-all text-gray-800 font-medium"
                placeholder="Enter your password" required />
            </div>
            <button type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white 
                rounded-xl font-bold text-base hover:shadow-lg hover:shadow-cyan-200/50 
                transition-all duration-300 shadow-md">
              {mode === 'register' ? '📝 Create Free Account' : '🔒 Sign In to Portal'}
            </button>
          </form>

          {mode === 'login' && (
            <p className="text-center text-sm text-gray-600 mt-5">
              Don't have an account?{' '}
              <button onClick={() => setMode('register')} className="text-cyan-700 font-bold hover:underline">
                Register here →
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
