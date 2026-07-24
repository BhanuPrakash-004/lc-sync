/**
 * LeftPanel.jsx — Tabbed panel (Description, Notes, Links & Resources) for ProblemDetail page
 */
import { useState, useRef, useEffect } from 'react'
import { FileText, StickyNote, MessageSquare, ExternalLink, Plus, Check, X, PlayCircle, Pencil } from 'lucide-react'
import BlockEditor from '../BlockEditor'

function DescriptionPanel({ description }) {
  if (!description) return (
    <div className="p-8 text-center text-zinc-500 text-sm italic">
      No description available.
      <p className="mt-2 text-xs text-zinc-600">Make sure your Chrome extension captures the description from LeetCode.</p>
    </div>
  )
  const isHtml = /<[a-z][\s\S]*>/i.test(description) || description.includes('<')
  if (isHtml) {
    const processedHtml = description.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      if (!/referrerpolicy/i.test(attrs)) {
        return `<img${attrs} referrerpolicy="no-referrer">`
      }
      return match
    })

    return (
      <div className="p-5 prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-800 prose-code:text-orange-300 prose-a:text-orange-400 prose-headings:text-white prose-img:rounded-xl prose-img:border prose-img:border-zinc-800/80 prose-img:shadow-lg prose-img:max-w-full prose-img:inline-block prose-img:my-4 prose-img:bg-white/5 prose-img:p-1"
        dangerouslySetInnerHTML={{ __html: processedHtml }} />
    )
  }
  return <div className="p-5 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">{description}</div>
}

function AddLinkInline({ icon: Icon, label, colorClass, bgClass, borderClass, onAdd }) {
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  const commit = () => {
    if (url.trim()) { onAdd(url.trim()); setUrl(''); setAdding(false) }
  }

  if (adding) return (
    <div className="inline-flex items-center gap-1">
      <div className={`flex items-center gap-1 bg-zinc-900 border ${borderClass} rounded-lg px-2 py-1`}>
        <Icon className={`w-3 h-3 ${colorClass} flex-shrink-0`} />
        <input ref={inputRef} type="url" value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAdding(false); setUrl('') } }}
          placeholder={`Paste ${label} URL\u2026`}
          className="bg-transparent text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none w-40" />
      </div>
      <button onClick={commit} className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition"><Check className="w-3 h-3" /></button>
      <button onClick={() => { setAdding(false); setUrl('') }} className="p-1 rounded bg-zinc-800 text-zinc-400 transition"><X className="w-3 h-3" /></button>
    </div>
  )

  return (
    <button onClick={() => setAdding(true)}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800/60 hover:${bgClass} text-zinc-500 hover:${colorClass} border border-zinc-700/40 hover:${borderClass} text-xs transition`}>
      <Plus className="w-3 h-3" />{label}
    </button>
  )
}

export default function LeftPanel({ description, meta, onMetaChange, approachLabel, submissionId, onSaveBlocks }) {
  const [activeTab, setActiveTab] = useState('description')
  const [notesMode, setNotesMode] = useState('notion')
  const [blockEditing, setBlockEditing] = useState(false)

  const chatgptLinks = meta?.chatgptUrls || []
  const youtubeLinks = meta?.youtubeUrls || []
  const totalLinks = chatgptLinks.length + youtubeLinks.length

  const addChatgpt = (url) => onMetaChange({ ...meta, chatgptUrls: [...(meta.chatgptUrls || []), url] })
  const addYoutube = (url) => onMetaChange({ ...meta, youtubeUrls: [...(meta.youtubeUrls || []), url] })

  const removeChatgpt = (idx) => {
    const updated = [...chatgptLinks]
    updated.splice(idx, 1)
    onMetaChange({ ...meta, chatgptUrls: updated })
  }
  const removeYoutube = (idx) => {
    const updated = [...youtubeLinks]
    updated.splice(idx, 1)
    onMetaChange({ ...meta, youtubeUrls: updated })
  }

  const hasNotes = Boolean((meta?.pageBlocks && meta.pageBlocks.length > 0) || meta?.notes?.trim())

  return (
    <div className="flex flex-col md:h-full md:overflow-hidden bg-zinc-950">
      {/* Tab bar header */}
      <div className="flex-shrink-0 flex items-center border-b border-zinc-800/60 bg-zinc-900/40 px-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('description')}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'description'
              ? 'border-orange-500 text-orange-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-orange-400" />
          Description
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'notes'
              ? 'border-purple-500 text-purple-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <StickyNote className="w-3.5 h-3.5 text-purple-400" />
          Notes
          {hasNotes && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Has notes" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('links')}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'links'
              ? 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          Links & Resources
          {totalLinks > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {totalLinks}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 md:overflow-y-auto">
        {activeTab === 'description' && (
          <DescriptionPanel description={description} />
        )}

        {activeTab === 'notes' && (
          <div className="p-4 flex flex-col space-y-3">
            {/* Mode toggle row — clean and compact */}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
                <button
                  onClick={() => setNotesMode('notion')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition ${
                    notesMode === 'notion'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  ✨ Block Editor
                </button>
                <button
                  onClick={() => setNotesMode('plain')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition ${
                    notesMode === 'plain'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  ✍️ Plain Text
                </button>
              </div>

              {notesMode === 'notion' && (
                <button
                  onClick={() => setBlockEditing(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    blockEditing
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50'
                  }`}
                >
                  {blockEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  {blockEditing ? 'Done' : 'Edit Blocks'}
                </button>
              )}
            </div>

            {notesMode === 'notion' ? (
              <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-3 min-h-[340px]">
                <BlockEditor
                  key={approachLabel}
                  value={meta?.pageBlocks || []}
                  submissionId={submissionId}
                  isEditing={blockEditing}
                  onToggleEdit={() => setBlockEditing(v => !v)}
                  onSaveBlocks={onSaveBlocks}
                  onChange={(newBlocks) => {
                    onMetaChange({ ...meta, pageBlocks: newBlocks })
                  }}
                />
              </div>
            ) : (
              <textarea
                value={meta?.notes || ''}
                onChange={e => onMetaChange({ ...meta, notes: e.target.value })}
                placeholder="Write down core intuition, time/space complexity, edge cases..."
                className="w-full min-h-[320px] p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 resize-y transition font-sans leading-relaxed"
              />
            )}
          </div>
        )}

        {activeTab === 'links' && (
          <div className="p-5 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                ChatGPT Solutions & Explanations
              </h3>
              <p className="text-xs text-zinc-500 mb-3">Links to ChatGPT conversations for this approach</p>

              {chatgptLinks.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {chatgptLinks.map((url, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-emerald-400 font-medium truncate hover:underline">
                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                      </a>
                      <button onClick={() => removeChatgpt(idx)} title="Remove link" className="text-zinc-500 hover:text-red-400 p-1 transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 mb-3 rounded-lg border border-dashed border-zinc-800 text-xs text-zinc-500 text-center">
                  No ChatGPT links added yet for {approachLabel.toLowerCase()}.
                </div>
              )}

              <AddLinkInline
                icon={MessageSquare}
                label="ChatGPT"
                colorClass="text-emerald-400"
                bgClass="bg-emerald-500/10"
                borderClass="border-emerald-500/30"
                onAdd={addChatgpt}
              />
            </div>

            <div className="pt-4 border-t border-zinc-800/60">
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-1">
                <PlayCircle className="w-4 h-4 text-red-400" />
                YouTube Video Tutorials
              </h3>
              <p className="text-xs text-zinc-500 mb-3">Video walk-throughs and explanation videos</p>

              {youtubeLinks.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {youtubeLinks.map((url, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-red-400 font-medium truncate hover:underline">
                        <PlayCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                      </a>
                      <button onClick={() => removeYoutube(idx)} title="Remove link" className="text-zinc-500 hover:text-red-400 p-1 transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 mb-3 rounded-lg border border-dashed border-zinc-800 text-xs text-zinc-500 text-center">
                  No YouTube links added yet for {approachLabel.toLowerCase()}.
                </div>
              )}

              <AddLinkInline
                icon={PlayCircle}
                label="YouTube"
                colorClass="text-red-400"
                bgClass="bg-red-500/10"
                borderClass="border-red-500/30"
                onAdd={addYoutube}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
