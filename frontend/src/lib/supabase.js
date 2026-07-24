import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey)

// Only create the real client when credentials are present.
// When they're missing the app renders <SetupPage /> before any Supabase call
// is made, so this placeholder is never actually invoked.
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
