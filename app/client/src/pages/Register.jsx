import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { name, email, password })
      loginWithToken(data.token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl"
      >
        <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
        <p className="text-slate-400 text-sm mb-6">Start generating vertical videos in minutes.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <a
          href="/api/auth/google"
          className="mt-4 w-full inline-flex justify-center py-3 rounded-xl border border-white/15 text-slate-200 hover:bg-white/5 text-sm font-medium"
        >
          Continue with Google
        </a>

        <p className="text-center text-slate-500 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-300 hover:text-violet-200">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
