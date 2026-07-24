/**
 * TopicsManager.jsx
 * ------------------
 * Manage topics and subtopics stored in the Supabase `topics` table.
 *
 * Columns expected in `topics` table:
 *   id         uuid (primary key, default gen_random_uuid())
 *   name       text
 *   sort_order int
 *   subtopics  jsonb  (array of strings)
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Tag,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchCustomTopics, upsertTopic, deleteTopic } from '../lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// TopicModal
// ─────────────────────────────────────────────────────────────────────────────
function TopicModal({ initial, allTopics, onSave, onClose }) {
  const isEdit = !!initial?.id
  const [name, setName] = useState(initial?.name ?? '')
  const [subtopicsRaw, setSubtopicsRaw] = useState(
    (initial?.subtopics ?? []).join('\n')
  )
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Topic name is required.'); return }
    const isDupe = allTopics.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.id !== initial?.id
    )
    if (isDupe) { setError('A topic with this name already exists.'); return }
    const subtopics = subtopicsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    const maxOrder = allTopics.reduce((m, t) => Math.max(m, t.sort_order ?? 0), 0)
    onSave({
      ...(isEdit ? { id: initial.id } : {}),
      name: trimmed,
      sort_order: isEdit ? (initial.sort_order ?? maxOrder + 1) : maxOrder + 1,
      subtopics,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-white">{isEdit ? 'Edit Topic' : 'New Topic'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Topic Name <span className="text-orange-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="e.g. Dynamic Programming"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Subtopics <span className="text-zinc-600 font-normal">(one per line)</span>
            </label>
            <textarea
              value={subtopicsRaw}
              onChange={(e) => setSubtopicsRaw(e.target.value)}
              placeholder={'1D DP\n2D / Grid DP\nKnapsack\nGeneral'}
              rows={6}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition resize-none font-mono"
            />
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 text-white transition">
              {isEdit ? 'Save Changes' : 'Create Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SubtopicModal
// ─────────────────────────────────────────────────────────────────────────────
function SubtopicModal({ initialValue, onSave, onClose }) {
  const [value, setValue] = useState(initialValue ?? '')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) { setError('Subtopic name is required.'); return }
    onSave(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-white">{initialValue ? 'Edit Subtopic' : 'New Subtopic'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Subtopic Name <span className="text-orange-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError('') }}
              placeholder="e.g. Two Pointers"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition"
            />
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 text-white transition">
              {initialValue ? 'Save' : 'Add Subtopic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDialog
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-zinc-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TopicCard
// ─────────────────────────────────────────────────────────────────────────────
function TopicCard({ topic, onEdit, onDelete, onSaveSubtopics }) {
  const [expanded, setExpanded] = useState(false)
  const [subtopicModal, setSubtopicModal] = useState(null)
  const [confirmDeleteSub, setConfirmDeleteSub] = useState(null)

  const handleAddSubtopic = (value) => {
    onSaveSubtopics(topic, [...(topic.subtopics ?? []), value])
    setSubtopicModal(null)
  }

  const handleEditSubtopic = (index, value) => {
    const updated = [...(topic.subtopics ?? [])]
    updated[index] = value
    onSaveSubtopics(topic, updated)
    setSubtopicModal(null)
  }

  const handleDeleteSubtopic = (index) => {
    onSaveSubtopics(topic, (topic.subtopics ?? []).filter((_, i) => i !== index))
    setConfirmDeleteSub(null)
  }

  return (
    <>
      {subtopicModal === 'add' && (
        <SubtopicModal onSave={handleAddSubtopic} onClose={() => setSubtopicModal(null)} />
      )}
      {subtopicModal !== null && subtopicModal !== 'add' && (
        <SubtopicModal
          initialValue={subtopicModal.value}
          onSave={(v) => handleEditSubtopic(subtopicModal.index, v)}
          onClose={() => setSubtopicModal(null)}
        />
      )}
      {confirmDeleteSub !== null && (
        <ConfirmDialog
          title="Delete Subtopic"
          message={`Remove "${topic.subtopics[confirmDeleteSub]}" from ${topic.name}?`}
          onConfirm={() => handleDeleteSubtopic(confirmDeleteSub)}
          onClose={() => setConfirmDeleteSub(null)}
        />
      )}

      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
        {/* Header row */}
        <div
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/30 transition select-none"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition flex-shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100 truncate">{topic.name}</span>
          </div>

          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md flex-shrink-0">
            {(topic.subtopics ?? []).length} subtopic{(topic.subtopics ?? []).length !== 1 ? 's' : ''}
          </span>

          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEdit(topic)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-orange-400 hover:bg-orange-500/10 transition"
              title="Edit topic"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(topic)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
              title="Delete topic"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtopics */}
        {expanded && (
          <div className="border-t border-zinc-800/60 px-4 py-3 space-y-1.5">
            {(topic.subtopics ?? []).length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No subtopics yet.</p>
            ) : (
              topic.subtopics.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition">
                  <span className="w-1 h-1 rounded-full bg-orange-500/60 flex-shrink-0" />
                  <span className="flex-1 text-xs text-zinc-300">{sub}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setSubtopicModal({ index: idx, value: sub })}
                      className="p-1 rounded text-zinc-600 hover:text-orange-400 transition"
                      title="Edit subtopic"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteSub(idx)}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 transition"
                      title="Delete subtopic"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => setSubtopicModal('add')}
              className="mt-1 flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition px-2 py-1 rounded-lg hover:bg-orange-500/10"
            >
              <Plus className="w-3.5 h-3.5" /> Add subtopic
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Export
// ─────────────────────────────────────────────────────────────────────────────
export default function TopicsManager() {
  const queryClient = useQueryClient()
  const [topicModal, setTopicModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: dbTopics = [], isLoading, isError } = useQuery({
    queryKey: ['customTopics'],
    queryFn: fetchCustomTopics,
    staleTime: 1000 * 60 * 2,
  })

  const topics = useMemo(() => {
    return dbTopics.map((topic) => ({
      ...topic,
      subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [],
    }))
  }, [dbTopics])

  const upsertMut = useMutation({
    mutationFn: upsertTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customTopics'] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      toast.success('Topic saved!')
      setTopicModal(null)
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteTopic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customTopics'] })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      toast.success('Topic deleted.')
      setConfirmDelete(null)
    },
    onError: (err) => toast.error(`Failed to delete: ${err.message}`),
  })

  const handleSaveTopic = (payload) => upsertMut.mutate(payload)
  const handleDeleteTopic = (topic) => { if (topic.id) deleteMut.mutate(topic.id) }

  const handleSaveSubtopics = (topic, updatedSubtopics) => {
    upsertMut.mutate(
      { id: topic.id, name: topic.name, sort_order: topic.sort_order, subtopics: updatedSubtopics }
    )
  }

  return (
    <>
      {topicModal !== null && (
        <TopicModal
          initial={topicModal === 'add' ? null : topicModal}
          allTopics={topics}
          onSave={handleSaveTopic}
          onClose={() => setTopicModal(null)}
        />
      )}
      {confirmDelete !== null && (
        <ConfirmDialog
          title="Delete Topic"
          message={`Permanently delete "${confirmDelete.name}" and all its subtopics? This cannot be undone.`}
          onConfirm={() => handleDeleteTopic(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-5 h-5 text-orange-400" />
                <h1 className="text-2xl font-bold text-white tracking-tight">Topics Manager</h1>
              </div>
              <p className="text-sm text-zinc-400">
                Add, edit, or delete topics and subtopics stored in your database.
              </p>
            </div>
            <button
              onClick={() => setTopicModal('add')}
              className="flex-shrink-0 self-start flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" /> New Topic
            </button>
          </div>

          {/* Stats */}
          {!isLoading && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span>
                <span className="text-orange-400 font-semibold">{topics.length}</span> topics
              </span>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Failed to load topics from Supabase. Check your connection.
            </div>
          )}

          {/* Skeletons */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-zinc-900/60 border border-zinc-800/60 rounded-xl h-14" />
              ))}
            </div>
          )}

          {/* List */}
          {!isLoading && (
            <div className="space-y-3">
              {topics.length === 0 ? (
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-6 py-12 text-center space-y-3">
                  <Tag className="mx-auto w-10 h-10 text-zinc-600" />
                  <p className="text-zinc-400 text-sm">No topics yet. Create your first one!</p>
                  <button
                    onClick={() => setTopicModal('add')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition"
                  >
                    <Plus className="w-4 h-4" /> New Topic
                  </button>
                </div>
              ) : (
                topics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onEdit={(t) => setTopicModal(t)}
                    onDelete={(t) => setConfirmDelete(t)}
                    onSaveSubtopics={handleSaveSubtopics}
                  />
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
