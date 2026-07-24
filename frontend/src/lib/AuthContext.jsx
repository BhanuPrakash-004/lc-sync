/**
 * AuthContext.jsx
 *
 * Exposes:
 *   user          — Supabase user object or null
 *   isLoggedIn    — true when authenticated
 *   isLoading     — true while Supabase checks existing session
 *   authEnabled   — whether auth is required at all
 *                   (false on localhost or when VITE_AUTH_ENABLED != 'true')
 *   login()       — sign in with email + password
 *   logout()      — sign out
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { loginUser, logoutUser, isAuthEnabled } from './auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const authEnabled = isAuthEnabled()

  // undefined = still checking, null = logged out, object = logged in
  // When auth is disabled, we skip the Supabase session check entirely.
  const [user,    setUser]    = useState(authEnabled ? undefined : null)
  const [loading, setLoading] = useState(authEnabled)   // only loading when auth is on

  useEffect(() => {
    if (!authEnabled) return  // auth is off — nothing to check

    // Hydrate from existing Supabase session (handles page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Keep state in sync with Supabase events (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [authEnabled])

  const login = useCallback(async (email, password) => {
    const supabaseUser = await loginUser(email, password)
    return supabaseUser
  }, [])

  const logout = useCallback(async () => {
    await logoutUser()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        authEnabled,
        // When auth is disabled, always treat as "logged in"
        isLoggedIn: !authEnabled || !!user,
        isLoading:  loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
