import { useState } from 'react'
import axios from 'axios'

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await axios.post('/api/auth/login', {
        email: form.email, password: form.password,
      })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      window.location.href = '/admin'
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.detail || 'Login failed'}`)
    }
  }

  return (
    <div className="login-shell min-h-screen bg-gradient-to-br from-amber-50 to-red-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-red-600 
            flex items-center justify-center text-4xl shadow-lg shadow-amber-200/50">
            ⚙️
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Admin Portal</h1>
          <p className="text-gray-600 mt-1 font-medium">System administration & user management</p>
        </div>

        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span className="text-sm font-bold text-red-800">Privileged access · Full system control</span>
        </div>

        {message && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mb-4 text-sm font-medium text-center">
            {message}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Admin Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-red-500 
                  focus:ring-2 focus:ring-red-200 outline-none transition-all text-gray-800 font-medium"
                placeholder="admin@cybershield.com" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-red-500 
                  focus:ring-2 focus:ring-red-200 outline-none transition-all text-gray-800 font-medium"
                placeholder="Enter admin password" required />
            </div>
            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <input type="checkbox" id="2fa" className="w-4 h-4 accent-red-600" />
              <label htmlFor="2fa" className="text-sm font-medium text-gray-700">Enable two-factor authentication</label>
            </div>
            <button type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-red-600 text-white 
                rounded-xl font-bold text-base hover:shadow-lg hover:shadow-amber-200/50 
                transition-all duration-300 shadow-md">
              🔐 Access Control Panel
            </button>
          </form>

          <div className="mt-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-700 text-center">
              🛡️ All admin actions are logged with IP tracking and audit trail
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
