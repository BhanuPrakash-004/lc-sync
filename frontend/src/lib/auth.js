/**
 * auth.js — Supabase Auth with optional enable/disable flag
 *
 * Auth is controlled by a single env var:
 *   VITE_AUTH_ENABLED=true   → login required
 *   VITE_AUTH_ENABLED=false  → no login (default for local/open-source users)
 *
 * Additionally, localhost ALWAYS skips auth regardless of the flag.
 *
 * VITE_AUTH_ENABLED is just a boolean flag — it contains no secrets,
 * so it's safe to embed in the JS bundle.
 *
 * Passwords are handled entirely by Supabase servers — never in the bundle.
 */
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Auth enabled check
// ---------------------------------------------------------------------------
export function isAuthEnabled() {
  // Localhost always bypasses auth — no friction for local dev / contributors
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'

  if (isLocalhost) return false

  // On deployed environments, respect the VITE_AUTH_ENABLED flag
  return import.meta.env.VITE_AUTH_ENABLED === 'true'
}

// ---------------------------------------------------------------------------
// Login — Supabase handles hashing + session server-side
// ---------------------------------------------------------------------------
export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Invalid email or password.')
    }
    if (error.message.includes('Email not confirmed')) {
      throw new Error(
        'Email not confirmed. Disable email confirmation in Supabase Dashboard → Auth → Settings.'
      )
    }
    throw new Error(error.message || 'Login failed. Please try again.')
  }

  return data.user
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
export async function logoutUser() {
  await supabase.auth.signOut()
}

// ---------------------------------------------------------------------------
// Subscribe to Supabase auth state changes (login / logout / token refresh)
// ---------------------------------------------------------------------------
export function onAuthChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => subscription.unsubscribe()
}
