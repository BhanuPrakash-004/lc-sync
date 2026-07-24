/**
 * CodePanels.jsx — Desktop & Mobile Code Panels for ProblemDetail
 */
import { useState } from 'react'
import { Code2, GitBranch, Plus, Pencil, Trash2, Save, Loader2 } from 'lucide-react'
import CodeEditor, { HighlightedCodeArea } from '../CodeEditor'

export function RightCodePanel({
  code, language, alternates, activeCode, onActiveCodeChange,
  onAddAlternate, onRemoveAlternate,
  onUpdatePrimary, onUpdateAlternate, onDeleteSolution,
}) {
  const [editing,    setEditing]    = useState(false)
  const [editCode,   setEditCode]   = useState('')
  const [editLabel,  setEditLabel]  = useState('')
  const [saving,     setSaving]     = useState(false)

  const startEdit = () => {
    if (activeCode === 'primary') { setEditCode(code); setEditLabel('') }
    else { const a = alternates.find(a => a.id === activeCode); if (a) { setEditCode(a.code || ''); setEditLabel(a.label || '') } }
    setEditing(true)
  }
  const cancelEdit = () => { setEditing(false); setEditCode(''); setEditLabel('') }
  const handleUpdate = async () => {
    setSaving(true)
    try {
      if (activeCode === 'primary') await onUpdatePrimary(editCode)
      else { const a = alternates.find(a => a.id === activeCode); await onUpdateAlternate(activeCode, editCode, editLabel || a?.label) }
      setEditing(false)
    } finally { setSaving(false) }
  }

  const activeText = activeCode === 'primary' ? code : (alternates.find(a => a.id === activeCode)?.code || '')
  const activeLanguage = activeCode === 'primary' ? language : (alternates.find(a => a.id === activeCode)?.language || language)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center border-b border-zinc-800/60 bg-zinc-900/30 overflow-x-auto">
        <button onClick={() => { onActiveCodeChange('primary'); setEditing(false) }}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeCode === 'primary' ? 'border-orange-500 text-orange-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
          <Code2 className="w-3.5 h-3.5" />Solution
        </button>
        {alternates.map((alt, i) => {
          const rawLabel = alt.label ? alt.label.trim() : ''
          const isDefault = !rawLabel || /^(Alternate\s+)?(Approach|Code)\s+\d+$/i.test(rawLabel)
          const displayLabel = isDefault ? `Approach ${i + 1}` : rawLabel
          return (
            <button key={alt.id} onClick={() => { onActiveCodeChange(alt.id); setEditing(false) }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeCode === alt.id ? 'border-purple-500 text-purple-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
              <GitBranch className="w-3.5 h-3.5" />{displayLabel}
            </button>
          )
        })}
        <button onClick={onAddAlternate} className="flex-shrink-0 flex items-center gap-1 px-3 py-2.5 text-xs text-zinc-600 hover:text-zinc-300 border-b-2 border-transparent hover:bg-zinc-800/30 transition">
          <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Add</span>
        </button>

        {/* Controls */}
        <div className="ml-auto flex-shrink-0 pr-3 flex items-center gap-1.5">
          {!editing && (
            <button onClick={startEdit} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700/40 transition">
              <Pencil className="w-3 h-3" />Edit
            </button>
          )}
          {!editing && activeCode === 'primary' && (
            <button onClick={onDeleteSolution} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400/70 hover:text-red-400 bg-zinc-800/60 hover:bg-red-950/40 border border-zinc-700/40 transition">
              <Trash2 className="w-3 h-3" />Del
            </button>
          )}
          {!editing && activeCode !== 'primary' && (
            <button onClick={() => onRemoveAlternate(activeCode)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400/70 hover:text-red-400 bg-zinc-800/60 hover:bg-red-950/40 border border-zinc-700/40 transition">
              <Trash2 className="w-3 h-3" />Del
            </button>
          )}
        </div>
      </div>

      {/* Edit mode */}
      {editing ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {activeCode !== 'primary' && (
            <div className="flex-shrink-0 px-4 pt-3 pb-2">
              <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Label (e.g. Two Pointer)"
                className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 transition" />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <HighlightedCodeArea value={editCode} onChange={setEditCode} language={activeLanguage} fillHeight />
          </div>
          <div className="flex-shrink-0 flex items-center justify-end gap-2 px-4 py-2.5 border-t border-zinc-800/60 bg-zinc-900/40">
            <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm transition">Cancel</button>
            <button onClick={handleUpdate} disabled={saving || !editCode.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Update'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CodeEditor code={activeText} language={activeLanguage} editable={false} fillHeight />
        </div>
      )}
    </div>
  )
}

export function MobileCodePanel({
  code, language, alternates, activeCode, onActiveCodeChange,
  onAddAlternate, onRemoveAlternate,
  onUpdatePrimary, onUpdateAlternate, onDeleteSolution,
}) {
  const [editing, setEditing]       = useState(false)
  const [editCode, setEditCode]     = useState('')
  const [editLabel, setEditLabel]   = useState('')
  const [saving, setSaving]         = useState(false)

  const startEdit = () => {
    if (activeCode === 'primary') { setEditCode(code); setEditLabel('') }
    else { const a = alternates.find(a => a.id === activeCode); if (a) { setEditCode(a.code || ''); setEditLabel(a.label || '') } }
    setEditing(true)
  }
  const handleUpdate = async () => {
    setSaving(true)
    try {
      if (activeCode === 'primary') await onUpdatePrimary(editCode)
      else { const a = alternates.find(a => a.id === activeCode); await onUpdateAlternate(activeCode, editCode, editLabel || a?.label) }
      setEditing(false)
    } finally { setSaving(false) }
  }

  const activeText     = activeCode === 'primary' ? code : (alternates.find(a => a.id === activeCode)?.code || '')
  const activeLanguage = activeCode === 'primary' ? language : (alternates.find(a => a.id === activeCode)?.language || language)

  return (
    <div className="flex flex-col bg-zinc-950">
      <div className="flex-shrink-0 flex items-center border-b border-zinc-800/60 bg-zinc-900/30 overflow-x-auto">
        <button onClick={() => { onActiveCodeChange('primary'); setEditing(false) }}
          className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition ${activeCode === 'primary' ? 'border-orange-500 text-orange-400' : 'border-transparent text-zinc-500'}`}>
          <Code2 className="w-3 h-3" />Solution
        </button>
        {alternates.map((alt, i) => {
          const rawLabel = alt.label ? alt.label.trim() : ''
          const isDefault = !rawLabel || /^(Alternate\s+)?(Approach|Code)\s+\d+$/i.test(rawLabel)
          const displayLabel = isDefault ? `Approach ${i + 1}` : rawLabel
          return (
            <button key={alt.id} onClick={() => { onActiveCodeChange(alt.id); setEditing(false) }}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition ${activeCode === alt.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500'}`}>
              <GitBranch className="w-3 h-3" />{displayLabel}
            </button>
          )
        })}
        <button onClick={onAddAlternate} className="flex-shrink-0 px-3 py-2 text-xs text-zinc-600 hover:text-zinc-300 flex items-center gap-0.5 transition">
          <Plus className="w-3.5 h-3.5" />Add
        </button>
        <div className="ml-auto flex items-center gap-1 pr-2">
          {!editing && <button onClick={startEdit} className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition"><Pencil className="w-3.5 h-3.5" /></button>}
          {!editing && activeCode === 'primary' && <button onClick={onDeleteSolution} className="p-1 rounded text-red-400/70 hover:text-red-400 hover:bg-red-950/30 transition"><Trash2 className="w-3.5 h-3.5" /></button>}
          {!editing && activeCode !== 'primary' && <button onClick={() => onRemoveAlternate(activeCode)} className="p-1 rounded text-red-400/70 hover:text-red-400 hover:bg-red-950/30 transition"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col p-3 space-y-2">
          {activeCode !== 'primary' && (
            <div className="flex-shrink-0">
              <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Label"
                className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700/50 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition" />
            </div>
          )}
          <div className="h-72 rounded-lg overflow-hidden border border-zinc-800">
            <HighlightedCodeArea value={editCode} onChange={setEditCode} language={activeLanguage} fillHeight />
          </div>
          <div className="flex-shrink-0 flex items-center justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 text-xs transition">Cancel</button>
            <button onClick={handleUpdate} disabled={saving} className="flex items-center gap-1 px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium transition disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {saving ? 'Saving…' : 'Update'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <CodeEditor code={activeText} language={activeLanguage} editable={false} fillHeight={false} />
        </div>
      )}
    </div>
  )
}
