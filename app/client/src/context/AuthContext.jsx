import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { setAuthToken } from '../api/client'

const AuthContext = createContext(null)

const STORAGE_KEY = 'hermiora_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!token)

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    setAuthToken(token)
    try {
      const { data } = await api.get('/me')
      setUser(data)
    } catch {
      setToken(null)
      localStorage.removeItem(STORAGE_KEY)
      setUser(null)
      setAuthToken(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const loginWithToken = useCallback((t) => {
    localStorage.setItem(STORAGE_KEY, t)
    setToken(t)
    setLoading(true)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setUser(null)
    setAuthToken(null)
  }, [])

  const tiktokConnected = Boolean(user?.tiktokConnected)

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: !!token && !!user,
      tiktokConnected,
      loginWithToken,
      logout,
      refreshUser,
    }),
    [token, user, loading, tiktokConnected, loginWithToken, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
