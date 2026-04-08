import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Subscription() {
  const { user, refreshUser } = useAuth()
  const [params] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.get('success')) {
      refreshUser()
    }
  }, [params, refreshUser])

  async function checkout() {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/billing/checkout')
      if (data.url) window.location.href = data.url
      else setError('No checkout URL returned')
    } catch (e) {
      setError(e.response?.data?.error || 'Checkout unavailable')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Subscription</h1>
      <p className="text-slate-400 mb-10">
        Free includes limited generations per month; Pro unlocks unlimited pipeline runs via Stripe.
      </p>

      {params.get('success') && (
        <p className="text-emerald-400 text-sm mb-6">Payment received — refreshing your plan…</p>
      )}
      {params.get('canceled') && (
        <p className="text-amber-400 text-sm mb-6">Checkout canceled.</p>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-8"
        >
          <h2 className="text-xl font-semibold text-white">Free</h2>
          <p className="text-slate-400 text-sm mt-2">Great for testing the full pipeline.</p>
          <p className="text-3xl font-bold text-white mt-6">
            $0<span className="text-base font-normal text-slate-500">/mo</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>· Limited videos per billing period</li>
            <li>· Script, voice, visuals, captions</li>
          </ul>
          <p className="mt-6 text-xs text-slate-500">
            Current plan: <span className="text-slate-300 capitalize">{user?.plan || '…'}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-transparent p-8 relative overflow-hidden"
        >
          <span className="absolute top-4 right-4 text-xs font-semibold text-violet-200 bg-violet-500/20 px-2 py-1 rounded-full">
            Pro
          </span>
          <h2 className="text-xl font-semibold text-white">Pro</h2>
          <p className="text-slate-400 text-sm mt-2">Unlimited generation for serious creators.</p>
          <p className="text-3xl font-bold text-white mt-6">Custom</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>· Unlimited videos (active subscription)</li>
            <li>· Priority rendering queue (hook for your infra)</li>
          </ul>
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
          <button
            type="button"
            disabled={loading || user?.plan === 'pro'}
            onClick={checkout}
            className="mt-8 w-full py-3 rounded-xl bg-white text-slate-900 font-semibold disabled:opacity-40"
          >
            {loading ? 'Redirecting…' : user?.plan === 'pro' ? 'You are on Pro' : 'Upgrade with Stripe'}
          </button>
          <p className="text-xs text-slate-500 mt-4">
            Set STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, and STRIPE_WEBHOOK_SECRET on the server.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
