/**
 * LoginPage.jsx — LC Sync · Supabase Auth login
 * Premium dark glassmorphism UI with animated background, micro-animations.
 * Uses Supabase's built-in email + password auth — nothing sensitive in the bundle.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'react-hot-toast'
import {
  Eye, EyeOff, Loader2, LogIn, Mail, Lock,
  Code2, Zap, Shield, GitBranch, AlertCircle,
  Sparkles, ExternalLink, ChevronRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Animated background
// ---------------------------------------------------------------------------
function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Base radial */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(249,115,22,0.10),transparent)]" />

      {/* Orb 1 */}
      <div
        className="absolute -top-44 -left-44 w-[40rem] h-[40rem] rounded-full blur-3xl animate-pulse"
        style={{ background: 'radial-gradient(circle,rgba(249,115,22,0.13) 0%,transparent 70%)', animationDuration: '4s' }}
      />
      {/* Orb 2 */}
      <div
        className="absolute -bottom-52 -right-52 w-[44rem] h-[44rem] rounded-full blur-3xl animate-pulse"
        style={{ background: 'radial-gradient(circle,rgba(251,146,60,0.10) 0%,transparent 70%)', animationDuration: '5.5s', animationDelay: '1.2s' }}
      />
      {/* Orb 3 centre subtle */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[26rem] h-[26rem] rounded-full blur-3xl animate-pulse"
        style={{ background: 'radial-gradient(circle,rgba(234,88,12,0.06) 0%,transparent 70%)', animationDuration: '7s', animationDelay: '2.5s' }}
      />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.8) 1px,transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------
function Logo() {
  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/40">
          <img src="/favicon.png" alt="LC Sync logo" className="w-full h-full object-cover" />
        </div>
        {/* Ping ring */}
        <div
          className="absolute inset-0 rounded-2xl ring-2 ring-orange-400/50 animate-ping"
          style={{ animationDuration: '2.8s' }}
        />
        {/* Glow halo */}
        <div className="absolute inset-0 rounded-2xl bg-orange-500/25 blur-2xl scale-150 -z-10" />
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">LC</span>
          <span className="text-white ml-1.5">Sync</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5 font-medium tracking-wide">Your LeetCode · Organized</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature chips
// ---------------------------------------------------------------------------
const CHIPS = [
  { icon: Code2,  label: 'Synced Solutions' },
  { icon: Shield, label: 'Supabase Auth' },
  { icon: Zap,    label: 'Instant Access' },
]

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function InputField({ id, label, type = 'text', value, onChange, placeholder, icon: Icon, rightSlot, error, autoFocus }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
        {label}
      </label>
      <div className={`
        group relative flex items-center rounded-xl border transition-all duration-200
        bg-zinc-900/70
        ${error
          ? 'border-red-500/60 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-400/70'
          : 'border-zinc-700/60 hover:border-zinc-600/80 focus-within:ring-2 focus-within:ring-orange-500/25 focus-within:border-orange-500/60'
        }
      `}>
        <div className={`flex-shrink-0 pl-4 transition-colors duration-200 ${error ? 'text-red-400' : 'text-zinc-500 group-focus-within:text-orange-400'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={type === 'password' ? 'current-password' : 'email'}
          className="flex-1 bg-transparent px-3 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
          style={{
            WebkitTextFillColor: 'white',
            caretColor: 'white',
          }}
        />
        {rightSlot && <div className="pr-3 flex-shrink-0">{rightSlot}</div>}
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400 animate-[fadeIn_0.2s_ease]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState({})
  const [shake,    setShake]    = useState(false)

  // Clear field errors on change
  useEffect(() => { if (errors.email)    setErrors((e) => ({ ...e, email:    undefined })) }, [email])
  useEffect(() => { if (errors.password) setErrors((e) => ({ ...e, password: undefined })) }, [password])

  const validate = () => {
    const e = {}
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim())            e.email    = 'Email is required'
    else if (!emailRe.test(email.trim())) e.email = 'Enter a valid email address'
    if (!password)                e.password = 'Password is required'
    else if (password.length < 6) e.password = 'Password must be at least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await login(email.trim(), password)
      toast.success('Welcome back! 🎉')
    } catch (err) {
      const msg = err?.message || 'Login failed. Please try again.'
      toast.error(msg)
      // Shake the card
      setShake(true)
      setTimeout(() => setShake(false), 500)
      // Highlight the password field for invalid credentials
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password')) {
        setErrors({ password: 'Invalid email or password' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 flex items-center justify-center p-4 overflow-hidden">
      <Background />

      <div className="relative z-10 w-full max-w-md space-y-6">

        {/* ── Logo ──────────────────────────────────────────────────── */}
        <Logo />

        {/* ── Feature chips ─────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {CHIPS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800/70 text-zinc-400 text-[11px] font-medium backdrop-blur-sm"
            >
              <Icon className="w-3 h-3 text-orange-400" />
              {label}
            </span>
          ))}
        </div>

        {/* ── Card ──────────────────────────────────────────────────── */}
        <div
          style={{ animation: shake ? 'shake 0.45s ease-in-out' : 'none' }}
          className="rounded-2xl bg-zinc-900/75 border border-zinc-800/60 shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden"
        >
          {/* Top accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-orange-500/70 to-transparent" />

          <div className="px-7 py-8 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <h2 className="text-lg font-bold text-white">Sign In</h2>
              </div>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Sign in with your Supabase Auth account to access your workspace.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <InputField
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                icon={Mail}
                error={errors.email}
                autoFocus
              />

              <InputField
                id="password"
                label="Password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={Lock}
                error={errors.password}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <button
                type="submit"
                disabled={loading}
                className="
                  w-full mt-2 flex items-center justify-center gap-2.5 py-3.5 rounded-xl
                  font-semibold text-sm text-white
                  bg-gradient-to-r from-orange-500 to-amber-500
                  hover:from-orange-400 hover:to-amber-400
                  shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40
                  transition-all duration-200 hover:scale-[1.015] active:scale-[0.985]
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                "
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                ) : (
                  <><LogIn className="w-4 h-4" /> Sign In</>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-800/80" />
              <span className="text-zinc-700 text-[10px] font-semibold uppercase tracking-wider">First time?</span>
              <div className="flex-1 h-px bg-zinc-800/80" />
            </div>

            {/* Setup guide */}
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/60 p-4 space-y-3">
              <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">
                Create your account (one-time setup)
              </p>

              <ol className="space-y-2.5">
                {[
                  {
                    step: 1,
                    text: 'Open your Supabase project dashboard',
                    link: 'https://supabase.com/dashboard',
                    linkLabel: 'Open Dashboard',
                  },
                  {
                    step: 2,
                    text: 'Go to Authentication → Users → Add user — enter your email + password',
                  },
                  {
                    step: 3,
                    text: 'Auth → Settings → disable "Confirm email" so you can login immediately',
                  },
                  {
                    step: 4,
                    text: (
                      <>
                        In Vercel → Settings → Environment Variables add{' '}
                        <code className="text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded font-mono text-[10px]">VITE_AUTH_ENABLED=true</code>
                        {' '}and redeploy.
                      </>
                    ),
                  },
                ].map(({ step, text, link, linkLabel }) => (
                  <li key={step} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {step}
                    </span>
                    <span className="text-xs text-zinc-400 leading-relaxed flex-1">
                      {text}
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1.5 inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-medium transition-colors"
                        >
                          {linkLabel}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="flex items-start gap-1.5 pt-1 border-t border-zinc-800/60">
                <Shield className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  Your password is <span className="text-zinc-500 font-medium">never stored in the JS bundle</span>. Supabase handles all authentication securely on their servers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="text-center">
          <a
            href="https://github.com/BhanuPrakash-004/lc-sync"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5" />
            github.com/BhanuPrakash-004/lc-sync
          </a>
        </div>
      </div>

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%,100% { transform:translateX(0) }
          18%     { transform:translateX(-7px) }
          36%     { transform:translateX(7px) }
          54%     { transform:translateX(-4px) }
          72%     { transform:translateX(4px) }
          90%     { transform:translateX(-2px) }
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(-4px) }
          to   { opacity:1; transform:translateY(0) }
        }
      `}</style>
    </div>
  )
}
