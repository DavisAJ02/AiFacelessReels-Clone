import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()

  useEffect(() => {
    const token = params.get('token')
    if (token) {
      loginWithToken(token)
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/login?error=google', { replace: true })
    }
  }, [params, loginWithToken, navigate])

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center text-slate-400">
      <div className="inline-block h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4">Completing sign-in…</p>
    </div>
  )
}
