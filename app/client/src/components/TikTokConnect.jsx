import { useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export function TikTokIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  )
}

/**
 * Connect TikTok — redirects to GET /api/auth/tiktok?token=JWT (full page navigation).
 */
export default function TikTokConnect({ className = '' }) {
  const { token, user, refreshUser, tiktokConnected } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('tiktok') === 'connected') {
      refreshUser()
      const next = new URLSearchParams(searchParams)
      next.delete('tiktok')
      setSearchParams(next, { replace: true })
    }
    const err = searchParams.get('tiktok_error')
    if (err) {
      const next = new URLSearchParams(searchParams)
      next.delete('tiktok_error')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, refreshUser, setSearchParams])

  function connect() {
    if (!token) return
    const url = `/api/auth/tiktok?token=${encodeURIComponent(token)}`
    window.location.assign(url)
  }

  const connected = tiktokConnected ?? user?.tiktokConnected

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-[#FE2C55]">
          <TikTokIcon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-white">TikTok</p>
          <p className="text-xs text-slate-400">
            {connected ? 'TikTok Connected ✅' : 'Not Connected ❌'}
          </p>
        </div>
      </div>
      {!connected && (
        <button
          type="button"
          onClick={connect}
          disabled={!token}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#FE2C55] hover:bg-[#e91e4d] text-white text-sm font-semibold shadow-lg shadow-[#FE2C55]/25 disabled:opacity-40 transition-colors"
        >
          <TikTokIcon className="h-4 w-4" />
          Connect TikTok
        </button>
      )}
      {connected && (
        <span className="text-sm text-emerald-400 font-medium px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          Connected
        </span>
      )}
    </div>
  )
}
