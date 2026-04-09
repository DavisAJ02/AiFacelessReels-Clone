import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center text-slate-400">
        <div className="inline-block h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4">Loading session…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
