import { useState, useEffect, useRef } from 'react'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Image as ImageIcon,
  Link as LinkIcon,
  CheckSquare,
  List,
  Minus,
  AlertCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  ExternalLink,
  Smile,
  MessageSquare,
  Pencil,
  Check
} from 'lucide-react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import toast from 'react-hot-toast'
import { uploadImage } from '../lib/api'

// Helper to generate unique block IDs
const generateId = () => `block-${Math.random().toString(36).substr(2, 9)}`

// Initial blocks template if page_blocks is empty
const defaultBlocks = () => [
  { id: generateId(), type: 'h1', content: 'Approach & Explanation' },
  { id: generateId(), type: 'text', content: 'Write your thoughts here. Click any block to edit, reorder, or delete. Use the bar below to add new Notion-style blocks!' },
  { id: generateId(), type: 'divider', content: '' },
  { id: generateId(), type: 'callout', content: 'Key Insight: Try to solve this in O(N) time and O(1) space.', icon: '💡' }
]

export default function BlockEditor({ value, onChange, submissionId, isEditing, onToggleEdit, onSaveBlocks }) {
  const [blocks, setBlocks] = useState([])
  const [focusedBlockId, setFocusedBlockId] = useState(null)
  const [editingCodeBlockId, setEditingCodeBlockId] = useState(null)
  // Local draft URL state for image URL paste inputs (keyed by block.id)
  const [urlDrafts, setUrlDrafts] = useState({})
  const fileInputRefs = useRef({})
  // Track whether blocks have been seeded from value (to avoid spurious onChange on mount)
  const seededRef = useRef(false)

  // Sync blocks whenever the value prop changes (e.g. switching between approaches)
  // We always sync — even when the incoming value is empty — so switching from
  // Primary (has blocks) to a fresh Alternate (empty blocks) correctly resets.
  useEffect(() => {
    if (value && Array.isArray(value) && value.length > 0) {
      setBlocks(value)
    } else if (Array.isArray(value) && value.length === 0 && seededRef.current) {
      // Switching to an approach that has no blocks yet — show default template
      setBlocks(defaultBlocks())
    } else if (!seededRef.current) {
      setBlocks(defaultBlocks())
    }
    seededRef.current = true
  }, [value])

  // Trigger onChange to parent — only on real user edits
  const updateBlocks = (newBlocks) => {
    setBlocks(newBlocks)
    if (onChange) onChange(newBlocks)
  }

  // Edit block content
  const handleBlockChange = (id, fields) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, ...fields } : b))
    updateBlocks(updated)
  }

  // Add block of a certain type
  const addBlock = (type, index = blocks.length) => {
    const newBlock = {
      id: generateId(),
      type,
      content: '',
      ...(type === 'code' && { language: 'javascript' }),
      ...(type === 'todo' && { checked: false }),
      ...(type === 'callout' && { icon: '💡' }),
      ...(type === 'link' && { title: 'Link Title', url: 'https://' }),
      ...(type === 'chatgpt' && { title: 'ChatGPT Discussion', url: 'https://chatgpt.com/' }),
    }
    const updated = [...blocks]
    updated.splice(index + 1, 0, newBlock)
    updateBlocks(updated)
    setFocusedBlockId(newBlock.id)
  }

  // Remove block
  const deleteBlock = (id) => {
    if (blocks.length <= 1) {
      toast.error("Can't delete the last block. Try clearing it instead.")
      return
    }
    const updated = blocks.filter((b) => b.id !== id)
    updateBlocks(updated)
    if (focusedBlockId === id) setFocusedBlockId(null)
  }

  // Move block up or down
  const moveBlock = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= blocks.length) return
    const updated = [...blocks]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    updateBlocks(updated)
  }

  // Handle local image file upload — saves to Supabase Storage then auto-persists blocks
  const handleImageUpload = async (id, file) => {
    if (!file) return
    const loadingToast = toast.loading('Uploading image...')
    try {
      if (!submissionId) throw new Error('No submission ID — save the submission first.')
      const publicUrl = await uploadImage(file, submissionId)
      // Update the block content with the new URL
      const newBlocks = blocks.map((b) => b.id === id ? { ...b, content: publicUrl } : b)
      updateBlocks(newBlocks)
      // Immediately persist blocks to DB so the image survives a page refresh
      if (onSaveBlocks) {
        await onSaveBlocks(newBlocks)
      }
      toast.success('Image uploaded!', { id: loadingToast })
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`, { id: loadingToast })
    }
  }

  // Commit a typed image URL to the block
  const commitImageUrl = (id) => {
    const url = (urlDrafts[id] || '').trim()
    if (url) {
      handleBlockChange(id, { content: url })
      setUrlDrafts((d) => ({ ...d, [id]: '' }))
    }
  }

  return (
    <div className="space-y-3 max-w-4xl mx-auto">

      {/* Mode 1: Clean preview */}
      {!isEditing ? (
        <div className="space-y-2.5 font-sans">
          {blocks.map((block) => (
            <div key={block.id} className="group/block cursor-pointer hover:bg-zinc-900/40 p-1.5 rounded-lg transition-colors">
              {block.type === 'h1' && (
                <h1 className="text-2xl font-bold text-white mt-3 mb-1.5 tracking-tight">
                  {block.content || <span className="text-zinc-600 italic">Empty Heading 1</span>}
                </h1>
              )}
              {block.type === 'h2' && (
                <h2 className="text-xl font-bold text-white mt-2.5 mb-1 tracking-tight">
                  {block.content || <span className="text-zinc-600 italic">Empty Heading 2</span>}
                </h2>
              )}
              {block.type === 'h3' && (
                <h3 className="text-lg font-semibold text-zinc-200 mt-2 mb-1">
                  {block.content || <span className="text-zinc-600 italic">Empty Heading 3</span>}
                </h3>
              )}
              {block.type === 'text' && (
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {block.content || <span className="text-zinc-600 italic">Empty text block</span>}
                </p>
              )}
              {block.type === 'bullet' && (
                <div className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-orange-400 font-bold select-none">•</span>
                  <span>{block.content}</span>
                </div>
              )}
              {block.type === 'todo' && (
                <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={block.checked || false}
                    onChange={(e) => handleBlockChange(block.id, { checked: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-orange-500 cursor-pointer"
                  />
                  <span className={block.checked ? 'line-through text-zinc-500' : ''}>
                    {block.content}
                  </span>
                </div>
              )}
              {block.type === 'code' && (
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden my-3">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/70 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                    <span>{(block.language || 'python').toUpperCase()}</span>
                    <span className="text-[10px] text-zinc-500">CODE</span>
                  </div>
                  {block.content ? (
                    <SyntaxHighlighter
                      language={(block.language || 'python').toLowerCase()}
                      style={atomOneDark}
                      customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'transparent',
                        fontSize: '0.75rem',
                        lineHeight: '1.625',
                      }}
                    >
                      {block.content}
                    </SyntaxHighlighter>
                  ) : (
                    <div className="p-4 text-xs font-mono text-zinc-600 italic">// Empty code block</div>
                  )}
                </div>
              )}
              {block.type === 'image' && (
                <div className="my-3">
                  {block.content ? (
                    <img
                      src={block.content}
                      alt={block.caption || 'Notion image'}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="rounded-xl border border-zinc-800/80 max-h-[360px] object-contain mx-auto shadow-md"
                    />
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                      No image uploaded
                    </div>
                  )}
                  {block.caption && (
                    <p className="text-center text-xs text-zinc-500 italic mt-1">{block.caption}</p>
                  )}
                </div>
              )}
              {block.type === 'link' && (
                <a
                  href={block.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl hover:border-orange-500/40 text-xs transition my-2"
                >
                  <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-zinc-200 truncate">{block.title || block.url}</div>
                    <div className="text-zinc-500 truncate text-[11px]">{block.url}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                </a>
              )}
              {block.type === 'chatgpt' && (
                <a
                  href={block.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-3 p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl hover:border-emerald-500/40 text-xs transition my-2"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-emerald-300 truncate">{block.title || 'ChatGPT Discussion'}</div>
                    <div className="text-emerald-500/70 truncate text-[11px]">{block.url}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-500/60 flex-shrink-0" />
                </a>
              )}
              {block.type === 'callout' && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex gap-3 my-3 text-sm text-orange-200">
                  <span className="text-xl select-none">{block.icon || '💡'}</span>
                  <div className="leading-relaxed whitespace-pre-wrap">{block.content}</div>
                </div>
              )}
              {block.type === 'divider' && (
                <hr className="border-zinc-800 my-4" />
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Mode 2: Interactive editing */
        <div className="space-y-3">
          <div className="space-y-3">
            {blocks.map((block, index) => {
              const isFocused = focusedBlockId === block.id

              return (
                <div
                  key={block.id}
                  onClick={() => setFocusedBlockId(block.id)}
                  className={`relative group flex gap-3 p-2 rounded-xl transition-all duration-200 border ${
                    isFocused
                      ? 'border-brand-orange/40 bg-dark-800/40 shadow-orange-sm'
                      : 'border-transparent hover:bg-dark-850'
                  }`}
                >
                  {/* Left Action Handle */}
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-10 bg-dark-700/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        moveBlock(index, 'up')
                      }}
                      disabled={index === 0}
                      className="p-1 hover:text-brand-orange rounded disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        moveBlock(index, 'down')
                      }}
                      disabled={index === blocks.length - 1}
                      className="p-1 hover:text-brand-orange rounded disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteBlock(block.id)
                      }}
                      className="p-1 hover:text-danger rounded"
                      title="Delete Block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Block Icon Type Indicator */}
                  <div className="flex-shrink-0 mt-1 text-white/30 group-hover:text-white/60 transition-colors">
                    {block.type === 'h1' && <Heading1 className="w-5 h-5" />}
                    {block.type === 'h2' && <Heading2 className="w-5 h-5" />}
                    {block.type === 'h3' && <Heading3 className="w-5 h-5" />}
                    {block.type === 'text' && <Type className="w-5 h-5" />}
                    {block.type === 'code' && <Code className="w-5 h-5" />}
                    {block.type === 'image' && <ImageIcon className="w-5 h-5" />}
                    {block.type === 'link' && <LinkIcon className="w-5 h-5" />}
                    {block.type === 'chatgpt' && <MessageSquare className="w-5 h-5 text-emerald-500" />}
                    {block.type === 'todo' && <CheckSquare className="w-5 h-5" />}
                    {block.type === 'bullet' && <List className="w-5 h-5" />}
                    {block.type === 'divider' && <Minus className="w-5 h-5" />}
                    {block.type === 'callout' && <AlertCircle className="w-5 h-5" />}
                  </div>

                  {/* Editable Content Region */}
                  <div className="flex-1 min-w-0 pr-16 select-text">
                    {/* 1. Headings */}
                    {block.type === 'h1' && (
                      <input
                        type="text"
                        value={block.content}
                        onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                        placeholder="Heading 1"
                        className="w-full bg-transparent border-none text-2xl font-bold text-white focus:outline-none placeholder-white/20"
                      />
                    )}
                    {block.type === 'h2' && (
                      <input
                        type="text"
                        value={block.content}
                        onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                        placeholder="Heading 2"
                        className="w-full bg-transparent border-none text-xl font-bold text-white focus:outline-none placeholder-white/20"
                      />
                    )}
                    {block.type === 'h3' && (
                      <input
                        type="text"
                        value={block.content}
                        onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                        placeholder="Heading 3"
                        className="w-full bg-transparent border-none text-lg font-bold text-white focus:outline-none placeholder-white/20"
                      />
                    )}

                    {/* 2. Text / Paragraph */}
                    {block.type === 'text' && (
                      <textarea
                        value={block.content}
                        onChange={(e) => {
                          handleBlockChange(block.id, { content: e.target.value })
                          e.target.style.height = 'auto'
                          e.target.style.height = `${e.target.scrollHeight}px`
                        }}
                        placeholder="Type '/' for commands or type something..."
                        rows={1}
                        className="w-full bg-transparent border-none text-sm text-white/90 focus:outline-none placeholder-white/25 resize-none overflow-hidden h-auto"
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto'
                            el.style.height = `${el.scrollHeight}px`
                          }
                        }}
                      />
                    )}

                    {/* 3. Bullet */}
                    {block.type === 'bullet' && (
                      <div className="flex items-start gap-2">
                        <span className="text-brand-orange text-lg leading-none mt-0.5">•</span>
                        <input
                          type="text"
                          value={block.content}
                          onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                          placeholder="List item"
                          className="w-full bg-transparent border-none text-sm text-white focus:outline-none placeholder-white/20"
                        />
                      </div>
                    )}

                    {/* 4. Checkbox / To-do */}
                    {block.type === 'todo' && (
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={block.checked || false}
                          onChange={(e) => handleBlockChange(block.id, { checked: e.target.checked })}
                          className="w-4.5 h-4.5 mt-0.5 rounded border-white/20 text-brand-orange bg-dark-700 focus:ring-brand-orange/40 focus:ring-offset-dark-900 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={block.content}
                          onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                          placeholder="To-do list item"
                          className={`w-full bg-transparent border-none text-sm focus:outline-none placeholder-white/20 ${
                            block.checked ? 'line-through text-white/40' : 'text-white'
                          }`}
                        />
                      </div>
                    )}

                    {/* 5. Divider */}
                    {block.type === 'divider' && (
                      <div className="py-3 cursor-default">
                        <div className="h-px bg-white/10 w-full" />
                      </div>
                    )}

                    {/* 6. Code Block */}
                    {block.type === 'code' && (
                      <div className="bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/80 border-b border-white/5 text-xs">
                          <select
                            value={block.language || 'python'}
                            onChange={(e) => handleBlockChange(block.id, { language: e.target.value })}
                            className="bg-transparent border-none text-xs text-white/70 hover:text-white focus:outline-none cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {['python', 'javascript', 'typescript', 'java', 'cpp', 'golang', 'rust', 'sql', 'bash', 'c', 'kotlin', 'swift'].map((lang) => (
                              <option key={lang} value={lang} className="bg-zinc-800 text-white">
                                {lang.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-white/30">CODE</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingCodeBlockId(editingCodeBlockId === block.id ? null : block.id)
                              }}
                              className="px-2 py-0.5 rounded text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white transition"
                            >
                              {editingCodeBlockId === block.id ? 'Done' : 'Edit'}
                            </button>
                          </div>
                        </div>

                        {editingCodeBlockId === block.id ? (
                          <textarea
                            autoFocus
                            value={block.content}
                            onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                            placeholder="// Paste or write code here..."
                            className="w-full bg-transparent border-none p-4 font-mono text-xs text-emerald-400 focus:outline-none placeholder-white/20 min-h-[120px] resize-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingCodeBlockId(block.id)
                            }}
                            title="Click to edit"
                            className="cursor-pointer"
                          >
                            {block.content ? (
                              <SyntaxHighlighter
                                language={(block.language || 'python').toLowerCase()}
                                style={atomOneDark}
                                customStyle={{
                                  margin: 0,
                                  padding: '1rem',
                                  background: 'transparent',
                                  fontSize: '0.75rem',
                                  lineHeight: '1.625',
                                }}
                              >
                                {block.content}
                              </SyntaxHighlighter>
                            ) : (
                              <div className="p-4 text-xs font-mono text-zinc-600 italic">// Click to write code…</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7. Image Block */}
                    {block.type === 'image' && (
                      <div className="space-y-2">
                        {block.content ? (
                          <div className="relative group/img rounded-xl overflow-hidden border border-white/10 bg-dark-900 max-h-[300px]">
                            <img
                              src={block.content}
                              alt={block.caption || 'Notion image'}
                              className="w-full h-full object-contain max-h-[298px] mx-auto"
                              onError={() => toast.error('Failed to load image. Check the URL.')}
                            />
                            <button
                              onClick={() => handleBlockChange(block.id, { content: '' })}
                              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity"
                              title="Remove Image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl hover:border-brand-orange/40 transition-colors">
                            <Upload className="w-8 h-8 text-white/30 mb-2 animate-bounce" />
                            <span className="text-xs text-white/60 mb-2">Upload image or paste URL below</span>
                            <div className="flex gap-2 w-full max-w-md">
                              <input
                                type="text"
                                value={urlDrafts[block.id] || ''}
                                placeholder="Paste image URL..."
                                className="input text-xs"
                                onChange={(e) =>
                                  setUrlDrafts((d) => ({ ...d, [block.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    commitImageUrl(block.id)
                                  }
                                }}
                                onBlur={() => commitImageUrl(block.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  fileInputRefs.current[block.id]?.click()
                                }}
                                className="btn-secondary px-3 text-xs flex gap-1 items-center shrink-0"
                              >
                                Browse
                              </button>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => (fileInputRefs.current[block.id] = el)}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleImageUpload(block.id, file)
                                // Reset so the same file can be re-selected
                                e.target.value = ''
                              }}
                            />
                          </div>
                        )}
                        <input
                          type="text"
                          value={block.caption || ''}
                          onChange={(e) => handleBlockChange(block.id, { caption: e.target.value })}
                          placeholder="Add an image caption..."
                          className="w-full bg-transparent border-none text-xs text-white/50 italic focus:outline-none placeholder-white/10"
                        />
                      </div>
                    )}

                    {/* 8. Link Block */}
                    {block.type === 'link' && (
                      <div className="bg-dark-900 border border-white/5 rounded-xl p-3 hover:border-brand-orange/20 transition-all flex gap-3 items-center">
                        <div className="w-10 h-10 bg-brand-orange/10 rounded-lg flex items-center justify-center text-brand-orange shrink-0">
                          <LinkIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0 grid gap-1">
                          <input
                            type="text"
                            value={block.title || ''}
                            onChange={(e) => handleBlockChange(block.id, { title: e.target.value })}
                            placeholder="Link Title"
                            className="bg-transparent border-none text-sm font-semibold text-white focus:outline-none p-0"
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={block.url || ''}
                              onChange={(e) => handleBlockChange(block.id, { url: e.target.value })}
                              placeholder="https://..."
                              className="bg-transparent border-none text-xs text-white/40 focus:outline-none p-0 w-full"
                            />
                            {block.url && (
                              <a
                                href={block.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/40 hover:text-brand-orange shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 8b. ChatGPT Block */}
                    {block.type === 'chatgpt' && (
                      <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-xl p-3 hover:border-emerald-500/20 transition-all flex gap-3 items-center">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-450 shrink-0">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0 grid gap-1">
                          <input
                            type="text"
                            value={block.title || ''}
                            onChange={(e) => handleBlockChange(block.id, { title: e.target.value })}
                            placeholder="ChatGPT Conversation"
                            className="bg-transparent border-none text-sm font-semibold text-white focus:outline-none p-0"
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={block.url || ''}
                              onChange={(e) => handleBlockChange(block.id, { url: e.target.value })}
                              placeholder="https://chatgpt.com/c/..."
                              className="bg-transparent border-none text-xs text-emerald-450/70 focus:outline-none p-0 w-full"
                            />
                            {block.url && (
                              <a
                                href={block.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400/60 hover:text-emerald-300 shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 9. Callout */}
                    {block.type === 'callout' && (
                      <div className="bg-brand-orange/5 border border-brand-orange/15 rounded-xl p-4 flex gap-3">
                        <div className="relative">
                          <span className="text-xl select-none cursor-pointer" title="Change Emoji">
                            {block.icon || '💡'}
                          </span>
                          <input
                            type="text"
                            value={block.icon || ''}
                            onChange={(e) => handleBlockChange(block.id, { icon: e.target.value })}
                            className="absolute inset-0 opacity-0 w-6 h-6 cursor-pointer"
                            maxLength={2}
                          />
                        </div>
                        <textarea
                          value={block.content}
                          onChange={(e) => {
                            handleBlockChange(block.id, { content: e.target.value })
                            e.target.style.height = 'auto'
                            e.target.style.height = `${e.target.scrollHeight}px`
                          }}
                          placeholder="Callout text..."
                          rows={1}
                          className="w-full bg-transparent border-none text-sm text-brand-orange-light focus:outline-none placeholder-brand-orange/30 resize-none overflow-hidden h-auto leading-relaxed"
                          ref={(el) => {
                            if (el) {
                              el.style.height = 'auto'
                              el.style.height = `${el.scrollHeight}px`
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Block creation bar */}
          <div className="border-t border-zinc-800/60 pt-3 mt-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-semibold">Add Block</p>
              {onToggleEdit && (
                <button
                  onClick={onToggleEdit}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  <Check className="w-3 h-3" />
                  Done
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { type: 'text', icon: Type, label: 'Text' },
                { type: 'h1', icon: Heading1, label: 'H1' },
                { type: 'h2', icon: Heading2, label: 'H2' },
                { type: 'h3', icon: Heading3, label: 'H3' },
                { type: 'todo', icon: CheckSquare, label: 'To-do' },
                { type: 'bullet', icon: List, label: 'Bullet' },
                { type: 'code', icon: Code, label: 'Code' },
                { type: 'image', icon: ImageIcon, label: 'Image' },
                { type: 'link', icon: LinkIcon, label: 'Link' },
                { type: 'chatgpt', icon: MessageSquare, label: 'ChatGPT' },
                { type: 'callout', icon: AlertCircle, label: 'Callout' },
                { type: 'divider', icon: Minus, label: 'Divider' }
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => addBlock(item.type)}
                  className="btn-secondary text-xs px-2.5 py-1.5 gap-1.5 hover:border-brand-orange/40 hover:text-white"
                >
                  <item.icon className="w-3.5 h-3.5 text-white/50" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

