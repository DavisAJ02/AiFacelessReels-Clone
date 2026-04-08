import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../api/client'

export default function Dashboard() {
  const [videos, setVideos] = useState([])
  const [trends, setTrends] = useState(null)
  const [best, setBest] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [vRes, aRes, tRes] = await Promise.all([
          api.get('/videos'),
          api.get('/analytics'),
          api.get('/trends?niche=facts'),
        ])
        if (!cancelled) {
          setVideos(vRes.data)
          setBest(aRes.data.bestPerforming || [])
          setTrends(tRes.data)
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function formatCompletion(rate) {
    if (rate == null || Number.isNaN(rate)) return '—'
    return `${Math.round(Number(rate) * 100)}%`
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Trends, top completion videos, and your pipeline.</p>
        </div>
        <Link
          to="/create"
          className="inline-flex justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold shadow-lg shadow-violet-500/20"
        >
          New video
        </Link>
      </div>

      {trends?.topics?.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Trending topics</h2>
          <div className="flex flex-wrap gap-2">
            {trends.topics.slice(0, 8).map((t) => (
              <span
                key={t}
                className="text-xs px-3 py-1.5 rounded-full bg-violet-500/15 text-violet-200 border border-violet-500/20"
              >
                {t}
              </span>
            ))}
          </div>
          {trends.keywords?.length > 0 && (
            <p className="text-xs text-slate-500 mt-4">
              Keywords: {trends.keywords.slice(0, 10).join(' · ')}
            </p>
          )}
        </div>
      )}

      {best.length > 0 && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Best performing videos</h2>
          <ul className="space-y-3">
            {best.map((row) => (
              <li key={row._id} className="flex justify-between gap-4 text-sm">
                <span className="text-slate-200 line-clamp-2">
                  {row.videoId?.hook || row.videoId?.topic || 'Video'}
                </span>
                <span className="text-cyan-300 shrink-0">{formatCompletion(row.completionRate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-400">
          <span className="h-5 w-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Loading your videos…
        </div>
      )}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !videos.length && (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-slate-400">
          No videos yet.{' '}
          <Link to="/create" className="text-violet-300 hover:text-violet-200">
            Generate your first one
          </Link>
          .
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <p className="text-xs uppercase tracking-wide text-violet-300/90 mb-1">{v.niche?.replace('_', ' ')}</p>
            <h3 className="text-white font-semibold line-clamp-2">{v.hook || v.topic || 'Untitled'}</h3>
            <p className="text-xs text-slate-500 mt-2 capitalize">
              {v.status}
              {v.completionRate != null && (
                <span className="text-slate-400"> · completion {formatCompletion(v.completionRate)}</span>
              )}
              {v.viralScore != null && (
                <span className="text-slate-400"> · viral {Number(v.viralScore).toFixed(2)}</span>
              )}
            </p>
            {v.outputUrl && v.status === 'ready' && (
              <a
                href={v.outputUrl}
                className="inline-block mt-4 text-sm text-cyan-300 hover:text-cyan-200"
                target="_blank"
                rel="noreferrer"
              >
                Download MP4
              </a>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
