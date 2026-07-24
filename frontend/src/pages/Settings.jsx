import { useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../lib/AuthContext'
import {
  Database,
  Globe,
  HardDrive,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Trash2,
  ExternalLink,
  Star,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  X,
  GitBranch,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const maskUrl = (url = '') => {
  if (!url) return '(not set)'
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.hostname.slice(0, 8)}…${u.hostname.slice(-12)}`
  } catch {
    return url.slice(0, 20) + '…'
  }
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------
function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 overflow-hidden">
      <div className="flex items-start gap-4 px-5 py-5 border-b border-zinc-800/60">
        <div className="flex-shrink-0 p-2 rounded-lg bg-orange-500/10">
          <Icon className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-base">{title}</h2>
          {description && (
            <p className="text-zinc-400 text-sm mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-700/60 hover:bg-zinc-600/60 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Code block
// ---------------------------------------------------------------------------
function CodeBlock({ code }) {
  return (
    <div className="relative rounded-xl bg-zinc-950 border border-zinc-800/60 overflow-hidden">
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
      <pre className="text-xs font-mono text-zinc-300 p-4 pr-16 overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Danger confirm modal
// ---------------------------------------------------------------------------
function DangerModal({ title, description, confirmLabel, onConfirm, onCancel, isLoading }) {
  const [typed, setTyped] = useState('')
  const CONFIRM_WORD = 'DELETE'
  const ready = typed === CONFIRM_WORD

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700/60 shadow-2xl p-6 space-y-4">
        <button onClick={onCancel} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 rounded-full bg-red-950/60 p-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-white font-semibold text-base">{title}</h2>
        </div>
        <p className="text-zinc-300 text-sm leading-relaxed">{description}</p>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Type <span className="font-mono font-bold text-red-400">{CONFIRM_WORD}</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            className="w-full bg-zinc-800 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/50 transition-colors font-mono"
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onCancel} disabled={isLoading} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-medium transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export default function Settings() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const { authEnabled, user } = useAuth()

  const [connStatus, setConnStatus] = useState(null) // 'ok' | 'error' | null
  const [connTesting, setConnTesting] = useState(false)
  const [connError, setConnError] = useState('')

  const [exporting, setExporting] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearing, setClearing] = useState(false)

  // ── Test connection ────────────────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    setConnTesting(true)
    setConnStatus(null)
    setConnError('')
    try {
      const { error } = await supabase.from('submissions').select('id').limit(1)
      if (error) throw error
      setConnStatus('ok')
      toast.success('Connection successful!')
    } catch (err) {
      setConnStatus('error')
      setConnError(err?.message || 'Unknown error')
      toast.error('Connection failed.')
    } finally {
      setConnTesting(false)
    }
  }, [])

  // ── Export JSON ─────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const { data, error } = await supabase.from('submissions').select('*')
      if (error) throw error
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lc-sync-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${data.length} submissions.`)
    } catch (err) {
      toast.error(`Export failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setExporting(false)
    }
  }, [])

  // ── Clear all ──────────────────────────────────────────────────────────────
  const handleClearAll = useCallback(async () => {
    setClearing(true)
    try {
      const { error } = await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) throw error
      toast.success('All data cleared.')
      setShowClearModal(false)
    } catch (err) {
      toast.error(`Clear failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setClearing(false)
    }
  }, [])

  const envTemplate = `VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`

  const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
  const GITHUB_URL = 'https://github.com/BhanuPrakash-004/lc-sync'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
          <p className="mt-1 text-zinc-400 text-sm">Configure your LC Sync workspace.</p>
        </div>

        {/* ── Section 1: Database Connection ──────────────────────────────── */}
        <SettingsCard
          icon={Database}
          title="Database Connection"
          description="Your Supabase credentials are loaded from environment variables for security."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-4 py-3">
                <p className="text-zinc-500 text-xs mb-1">Supabase URL</p>
                <p className="text-zinc-200 text-sm font-mono truncate">
                  {supabaseUrl ? maskUrl(supabaseUrl) : <span className="text-red-400">Not configured</span>}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-4 py-3">
                <p className="text-zinc-500 text-xs mb-1">Anon Key</p>
                <p className="text-zinc-200 text-sm font-mono truncate">
                  {supabaseKey ? '••••••••••••••••••••••••' : <span className="text-red-400">Not configured</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={testConnection}
                disabled={connTesting || !supabaseUrl}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connTesting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />}
                Test Connection
              </button>

              {connStatus === 'ok' && (
                <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </span>
              )}
              {connStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-red-400 text-sm">
                  <XCircle className="w-4 h-4" /> {connError || 'Failed'}
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-600" />
              Credentials are stored in your <span className="font-mono text-zinc-400">.env</span> file and never exposed to the browser network.
            </p>
          </div>
        </SettingsCard>

        {/* ── Section 2: Extension Setup ──────────────────────────────────── */}
        <SettingsCard
          icon={Globe}
          title="Extension Setup"
          description="Install the LC Sync Chrome extension to automatically sync your accepted LeetCode submissions."
        >
          <div className="space-y-5">
            {[
              {
                step: 1,
                title: 'Download the Extension',
                body: (
                  <a
                    href={`${GITHUB_URL}/releases/latest`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-sm font-medium border border-zinc-700/60 transition-colors"
                  >
                    <Download className="w-4 h-4 text-orange-400" />
                    Download from GitHub Releases
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ),
              },
              {
                step: 2,
                title: 'Load the Unpacked Extension',
                body: (
                  <ol className="mt-2 space-y-1.5 text-sm text-zinc-300 list-none">
                    {[
                      'Open Chrome and go to chrome://extensions/',
                      'Enable "Developer mode" (toggle, top right)',
                      'Click "Load unpacked"',
                      'Select the downloaded extension folder',
                    ].map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-400 text-xs flex items-center justify-center font-mono">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                ),
              },
              {
                step: 3,
                title: 'Configure the Extension',
                body: (
                  <p className="mt-2 text-sm text-zinc-300">
                    Click the extension icon in Chrome, enter your Supabase URL and Anon Key, then click Save.
                    The extension will now automatically sync accepted submissions from LeetCode.
                  </p>
                ),
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                  <span className="text-orange-400 text-xs font-bold">{step}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{title}</p>
                  {body}
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>

        {/* ── Section 3: Data Management ──────────────────────────────────── */}
        <SettingsCard
          icon={HardDrive}
          title="Data Management"
          description="Export or manage your stored submission data."
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Export JSON */}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-orange-400" />}
                Export All Data as JSON
              </button>

              {/* Clear */}
              <button
                onClick={() => setShowClearModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/30 text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Data
              </button>
            </div>

            <p className="text-xs text-zinc-500 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-600" />
              Clearing data permanently deletes all synced submissions from your database. Export first!
            </p>
          </div>
        </SettingsCard>

        {/* ── Section 4: About ────────────────────────────────────────────── */}
        <SettingsCard
          icon={Info}
          title="About LC Sync"
          description="Automatic LeetCode submission syncing powered by Chrome extension + Supabase."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs">Version</p>
                <p className="text-white text-sm font-mono font-medium mt-1">v{APP_VERSION}</p>
              </div>
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs">Stack</p>
                <p className="text-white text-sm font-medium mt-1">React + Supabase</p>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs">License</p>
                <p className="text-white text-sm font-medium mt-1">MIT</p>
              </div>
            </div>

            {/* Auth Mode status */}
            <div className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
              style={authEnabled
                ? { borderColor: 'rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.05)' }
                : { borderColor: 'rgba(113,113,122,0.3)', background: 'rgba(39,39,42,0.4)' }
              }
            >
              <div>
                <p className="text-xs font-semibold text-zinc-300">Frontend Auth</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {authEnabled
                    ? `Enabled via VITE_AUTH_ENABLED=true · Signed in as ${user?.email || '—'}`
                    : 'Disabled · Set VITE_AUTH_ENABLED=true in Vercel env vars to enable'}
                </p>
              </div>
              <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                authEnabled
                  ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                  : 'bg-zinc-800 border-zinc-700/50 text-zinc-500'
              }`}>
                {authEnabled ? '🔒 ON' : '🔓 OFF'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/50 text-sm font-medium transition-colors"
              >
                <GitBranch className="w-4 h-4" />
                View on GitHub
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              </a>
              <a
                href={`${GITHUB_URL}/stargazers`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 border border-orange-500/20 text-sm font-medium transition-colors"
              >
                <Star className="w-4 h-4" />
                Star on GitHub
              </a>
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* Danger clear modal */}
      {showClearModal && (
        <DangerModal
          title="Clear All Data"
          description="This will permanently delete ALL synced submissions from your Supabase database. This action cannot be undone. Please export your data first."
          confirmLabel="Clear All Data"
          isLoading={clearing}
          onConfirm={handleClearAll}
          onCancel={() => setShowClearModal(false)}
        />
      )}
    </div>
  )
}
