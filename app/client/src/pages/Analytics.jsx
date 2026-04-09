import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import api from '../api/client'

export default function Analytics() {
  const [data, setData] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [a, t] = await Promise.all([api.get('/analytics'), api.get('/trends?niche=facts')])
        if (!cancelled) {
          setData(a.data)
          setTrends(t.data)
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Failed to load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center text-slate-400">
        <span className="inline-block h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
      <p className="text-slate-400 mb-8">
        Aggregate views and completion; sync real metrics via the PATCH endpoint or platform webhooks.
      </p>
      {error && <p className="text-red-400 mb-6">{error}</p>}

      {data?.summary && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total views', value: data.summary.views },
            { label: 'Watch time (s)', value: data.summary.watchTimeSeconds },
            { label: 'Avg completion', value: `${Math.round((data.summary.avgCompletion || 0) * 100)}%` },
            {
              label: 'Avg viral score',
              value: data.summary.avgViralScore != null ? data.summary.avgViralScore.toFixed(2) : '—',
            },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <p className="text-slate-500 text-xs uppercase tracking-wide">{c.label}</p>
              <p className="text-3xl font-bold text-white mt-2">{c.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {trends?.topics?.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Trending angles</h2>
          <ul className="space-y-2 text-slate-300 text-sm">
            {trends.topics.map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Per video</h2>
        {!data?.byVideo?.length && <p className="text-slate-500 text-sm">No analytics rows yet.</p>}
        <ul className="divide-y divide-white/5">
          {data?.byVideo?.map((row) => (
            <li key={row._id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-white text-sm font-medium">
                  {row.videoId?.hook || row.videoId?.topic || 'Video'}
                </p>
                <p className="text-xs text-slate-500 capitalize">{row.videoId?.status}</p>
              </div>
              <div className="text-xs text-slate-400 sm:text-right">
                views {row.views} · completion {Math.round((row.completionRate || 0) * 100)}%
                {row.viralScore != null && ` · viral ${Number(row.viralScore).toFixed(2)}`}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
