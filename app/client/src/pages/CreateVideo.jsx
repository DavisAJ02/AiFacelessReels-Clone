import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import api from '../api/client'

const NICHES = [
  { value: 'motivation', label: 'Motivation' },
  { value: 'bible_stories', label: 'Bible stories' },
  { value: 'horror_stories', label: 'Horror stories' },
  { value: 'facts', label: 'Facts' },
]

export default function CreateVideo() {
  const [niche, setNiche] = useState('motivation')
  const [topic, setTopic] = useState('')
  const [autoPost, setAutoPost] = useState(false)
  const [platforms, setPlatforms] = useState(['tiktok', 'instagram', 'youtube'])
  const [step, setStep] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!autoPost) return
    setPlatforms(['tiktok', 'instagram', 'youtube'])
  }, [autoPost])

  async function runPipeline() {
    setError('')
    setResult(null)
    setLoading(true)
    setStep('Generating script, voice, scenes, and video…')
    try {
      const { data } = await api.post('/video', { niche, topic })
      setResult(data)
      setStep('Video rendered.')

      if (autoPost && data.videoId) {
        setStep('Scheduling auto-post (simulated if APIs not configured)…')
        await api.post('/post', { videoId: data.videoId, platforms })
        setStep('Done — post pipeline completed.')
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Pipeline failed'
      setError(msg)
      setStep('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Create video</h1>
      <p className="text-slate-400 mb-8">
        One click runs script → voice → images → FFmpeg render. Optional auto-post step uses the posting
        module (configure platform tokens for real uploads).
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
        <div>
          <label className="block text-sm text-slate-300 mb-2">Niche</label>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {NICHES.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-2">Topic (optional)</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. morning discipline ritual"
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoPost}
            onChange={(e) => setAutoPost(e.target.checked)}
            className="rounded border-white/20 bg-black/40 text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm text-slate-300">Run auto-post after render</span>
        </label>

        {autoPost && (
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            {['tiktok', 'instagram', 'youtube'].map((p) => (
              <label key={p} className="flex items-center gap-2 capitalize">
                <input
                  type="checkbox"
                  checked={platforms.includes(p)}
                  onChange={() =>
                    setPlatforms((prev) =>
                      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                    )
                  }
                  className="rounded border-white/20 bg-black/40"
                />
                {p}
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {step && (
          <p className="text-cyan-300/90 text-sm flex items-center gap-2">
            {loading && (
              <span className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            {step}
          </p>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          onClick={runPipeline}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold text-lg disabled:opacity-50 shadow-xl shadow-violet-500/20"
        >
          {loading ? 'Working…' : 'Generate video'}
        </motion.button>
      </div>

      {result?.outputUrl && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-white font-semibold mb-2">Ready</h2>
          <video
            className="w-full max-w-sm mx-auto rounded-xl border border-white/10"
            controls
            src={result.outputUrl}
          />
          <a
            href={result.outputUrl}
            download
            className="inline-block mt-4 text-sm text-violet-300 hover:text-violet-200"
          >
            Open / download file
          </a>
        </div>
      )}
    </div>
  )
}
