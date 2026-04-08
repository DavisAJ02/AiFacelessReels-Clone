import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../api/client'

export default function Dashboard() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/videos')
        if (!cancelled) setVideos(data)
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'Failed to load videos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Create and track your automated Shorts pipeline.</p>
        </div>
        <Link
          to="/create"
          className="inline-flex justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold shadow-lg shadow-violet-500/20"
        >
          New video
        </Link>
      </div>

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
            <p className="text-xs text-slate-500 mt-2 capitalize">{v.status}</p>
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
