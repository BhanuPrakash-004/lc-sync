/**
 * Modals.jsx — Add Alternate and Delete modals for Problem Detail page
 */
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { GitBranch, X, AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react'
import { addAlternateCode } from '../../lib/api'
import { HighlightedCodeArea } from '../CodeEditor'

export function AddAlternateModal({ submissionId, language, onClose, onSuccess }) {
  const [code, setCode]             = useState('')
  const [label, setLabel]           = useState('')
  const [notes, setNotes]           = useState('')
  const [runtime, setRuntime]       = useState('')
  const [memory, setMemory]         = useState('')
  const [chatgptUrl, setChatgptUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const handleSave = async () => {
    if (!code.trim()) { setError('Please enter code.'); return }
    setSaving(true); setError('')
    try {
      await addAlternateCode(submissionId, {
        code, language, label: label || undefined,
        notes: notes || undefined,
        runtime: runtime || undefined,
        memory: memory || undefined,
        chatgpt_url: chatgptUrl || undefined,
        youtube_url: youtubeUrl || undefined,
      })
      toast.success('Alternate approach saved!')
      onSuccess(); onClose()
    } catch (err) { setError(err.message || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-700/60 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-purple-400" /><h2 className="text-base font-semibold text-white">Add Alternate Approach</h2></div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Label</label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. BFS, Two Pointer…"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 transition" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Runtime</label>
                <input type="text" value={runtime} onChange={e => setRuntime(e.target.value)} placeholder="e.g. 45 ms"
                  className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Memory</label>
                <input type="text" value={memory} onChange={e => setMemory(e.target.value)} placeholder="e.g. 18 MB"
                  className="w-full px-2 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 transition" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Code *</label>
            <div className="h-48 rounded-lg overflow-hidden">
              <HighlightedCodeArea value={code} onChange={setCode} language={language} placeholder="Paste alternate solution…" fillHeight={false} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Approach Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Key idea, time/space complexity…"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 transition resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">ChatGPT Link</label>
              <input type="url" value={chatgptUrl} onChange={e => setChatgptUrl(e.target.value)} placeholder="https://chatgpt.com/…"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">YouTube Link</label>
              <input type="url" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/…"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition" />
            </div>
          </div>
          {error && <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-medium transition">Cancel</button>
          <button onClick={handleSave} disabled={saving || !code.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Approach'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteModal({ title, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700/60 shadow-2xl p-6 space-y-4">
        <button onClick={onCancel} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-red-950/60 p-2"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
          <h2 className="text-white font-semibold">Delete Submission</h2>
        </div>
        <p className="text-zinc-300 text-sm">Are you sure you want to permanently delete <strong className="text-white">"{title}"</strong>?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={isDeleting} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-medium transition disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition disabled:opacity-50">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
