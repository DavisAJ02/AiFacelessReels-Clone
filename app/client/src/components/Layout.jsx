import { Link, NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const navClass = ({ isActive }) =>
  `text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
  }`

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <motion.span
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-sm font-bold text-slate-950"
              whileHover={{ scale: 1.05 }}
            >
              H
            </motion.span>
            <span className="font-semibold tracking-tight">Hermiora AI</span>
          </Link>
          {isAuthenticated ? (
            <nav className="flex items-center gap-1 flex-wrap justify-end">
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/create" className={navClass}>
                Create
              </NavLink>
              <NavLink to="/analytics" className={navClass}>
                Analytics
              </NavLink>
              <NavLink to="/subscription" className={navClass}>
                Plan
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="text-sm text-slate-400 hover:text-white ml-2 px-3 py-2"
              >
                Sign out
              </button>
            </nav>
          ) : (
            <div className="flex gap-2">
              <Link
                to="/login"
                className="text-sm px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium shadow-lg shadow-violet-500/20"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
        {user && (
          <div className="max-w-6xl mx-auto px-4 pb-3 text-xs text-slate-500 -mt-1">
            Signed in as <span className="text-slate-300">{user.email}</span>
            <span className="mx-2">·</span>
            <span className="capitalize">{user.plan}</span>
          </div>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-white/10 py-8 text-center text-slate-500 text-sm">
        Hermiora AI — faceless reels, built for scale.
      </footer>
    </div>
  )
}
