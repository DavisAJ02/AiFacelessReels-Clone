import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const features = [
  { title: 'Viral scripts', desc: 'Hooks, pacing, and curiosity loops tuned for Shorts and Reels.' },
  { title: 'Voice + visuals', desc: 'ElevenLabs voiceover, DALL·E or stock imagery, FFmpeg assembly.' },
  { title: 'Auto captions', desc: 'Bold, centered, high-contrast subtitles baked into the render.' },
  { title: 'Post pipeline', desc: 'Schedule TikTok, Instagram, and YouTube uploads from one flow.' },
]

export default function Landing() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl mx-auto"
      >
        <p className="text-violet-300 text-sm font-medium tracking-wide uppercase mb-4">
          Automated faceless video
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
          Ship viral Shorts on autopilot with{' '}
          <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
            Hermiora AI
          </span>
        </h1>
        <p className="text-lg text-slate-400 mb-10">
          From niche and topic to rendered 9:16 video — script, voice, scenes, captions, and optional
          auto-posting in one modular pipeline.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/register"
            className="inline-flex justify-center items-center px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold shadow-xl shadow-violet-500/25"
          >
            Start free
          </Link>
          <Link
            to="/login"
            className="inline-flex justify-center items-center px-8 py-3 rounded-xl border border-white/15 text-slate-200 hover:bg-white/5"
          >
            Log in
          </Link>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 mt-20">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-violet-500/30 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
