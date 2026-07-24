import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS — CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch submissions with filters, pagination.
 * Optimized: only selects columns needed for list view (no code/page_blocks).
 */
export async function fetchSubmissions({
  search = '',
  difficulty = '',
  tag = '',
  language = '',
  topic = '',
  sortBy = 'created_at',
  sortOrder = 'desc',
  page = 1,
  perPage = 10,   // Default 10 for infinite scroll
} = {}) {
  // Lightweight column selection for list view
  let query = supabase
    .from('submissions')
    .select(
      'id,problem_id,problem_title,problem_slug,difficulty,tags,language,runtime,memory,submission_time,created_at,updated_at,url,notes,user_topic,user_subtopic',
      { count: 'exact' }
    )
    .eq('is_accepted', true)

  // Sorting
  if (sortBy === 'created_at') {
    query = query.order('created_at', { ascending: sortOrder === 'asc' })
  } else if (sortBy === 'problem_id') {
    query = query.order('problem_id', { ascending: sortOrder === 'asc' })
  } else if (sortBy === 'problem_title') {
    query = query.order('problem_title', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range((page - 1) * perPage, page * perPage - 1)

  if (search) {
    query = query.or(
      `problem_title.ilike.%${search}%,notes.ilike.%${search}%`
    )
  }
  if (difficulty) query = query.eq('difficulty', difficulty)
  if (tag || topic) {
    const t = tag || topic
    query = query.contains('tags', [t])
  }
  if (language) query = query.eq('language', language)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count, total: count }
}

/**
 * Fetch a single submission by ID (includes all columns).
 */
export async function fetchSubmission(id) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/**
 * Update a submission.
 */
export async function updateSubmission(id, updates) {
  const { data, error } = await supabase
    .from('submissions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Extract all Supabase storage paths referenced by image blocks inside
 * a page_blocks array (or nested inside alternate_codes).
 * Returns an array of storage object paths like "<submissionId>/1234.png".
 */
function extractBlockImagePaths(submissionId, pageBlocks) {
  if (!Array.isArray(pageBlocks)) return []
  const base = `${submissionId}/`
  return pageBlocks
    .filter((b) => b.type === 'image' && typeof b.content === 'string' && b.content.includes(base))
    .map((b) => {
      // Extract just the path after the bucket URL
      // Public URL: https://<ref>.supabase.co/storage/v1/object/public/submission-images/<path>
      const marker = '/submission-images/'
      const idx = b.content.indexOf(marker)
      return idx !== -1 ? b.content.slice(idx + marker.length) : null
    })
    .filter(Boolean)
}

/**
 * Delete a submission (cascades to notes) and purge ALL its storage images:
 * - Files under the submission's folder in submission-images bucket
 * - Images embedded in page_blocks (primary + all alternate approaches)
 */
export async function deleteSubmission(id) {
  // 1. Fetch the submission to get page_blocks and alternate_codes
  const { data: sub } = await supabase
    .from('submissions')
    .select('page_blocks, alternate_codes')
    .eq('id', id)
    .single()

  // 2. Collect all storage paths to delete
  const pathsToDelete = new Set()

  // 2a. Files listed under the storage folder
  const { data: files } = await supabase.storage.from('submission-images').list(id)
  if (files && files.length > 0) {
    files.forEach((f) => pathsToDelete.add(`${id}/${f.name}`))
  }

  // 2b. Image blocks in primary page_blocks
  if (sub?.page_blocks) {
    extractBlockImagePaths(id, sub.page_blocks).forEach((p) => pathsToDelete.add(p))
  }

  // 2c. Image blocks in each alternate approach's page_blocks
  if (Array.isArray(sub?.alternate_codes)) {
    for (const alt of sub.alternate_codes) {
      if (alt.page_blocks) {
        extractBlockImagePaths(id, alt.page_blocks).forEach((p) => pathsToDelete.add(p))
      }
    }
  }

  // 3. Delete all storage files in one batch
  if (pathsToDelete.size > 0) {
    await supabase.storage.from('submission-images').remove([...pathsToDelete])
  }

  // 4. Delete the DB row (cascades to notes via FK)
  const { error } = await supabase.from('submissions').delete().eq('id', id)
  if (error) throw error
}

/**
 * Manually create a submission from the frontend.
 */
export async function createSubmission(submission) {
  const { data, error } = await supabase
    .from('submissions')
    .insert(submission)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Add an alternate code approach to an existing submission.
 * Prevents duplicates and identical code.
 */
export async function addAlternateCode(submissionId, { code, language, label, runtime, memory, notes, chatgpt_url, youtube_url }) {
  // Fetch current alternates
  const { data: existing, error: fetchErr } = await supabase
    .from('submissions')
    .select('code, alternate_codes')
    .eq('id', submissionId)
    .single()

  if (fetchErr) throw fetchErr

  // Prevent identical primary code
  if (existing.code && existing.code.trim() === code.trim()) {
    throw new Error('This code is identical to the primary solution.')
  }

  const alternates = Array.isArray(existing.alternate_codes) ? existing.alternate_codes : []

  // Prevent identical alternate
  const isDup = alternates.some((a) => a.code && a.code.trim() === code.trim())
  if (isDup) {
    throw new Error('This code is identical to an existing alternate approach.')
  }

  const newEntry = {
    id:          crypto.randomUUID ? crypto.randomUUID() : `alt-${Date.now()}`,
    code,
    language:    language    || 'Unknown',
    label:       label       || `Alternate Approach ${alternates.length + 1}`,
    runtime:     runtime     || null,
    memory:      memory      || null,
    notes:       notes       || null,
    chatgpt_url: chatgpt_url || null,
    youtube_url: youtube_url || null,
    saved_at:    new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('submissions')
    .update({ alternate_codes: [...alternates, newEntry] })
    .eq('id', submissionId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Remove an alternate code by its id.
 */
export async function removeAlternateCode(submissionId, altId) {
  const { data: existing, error: fetchErr } = await supabase
    .from('submissions')
    .select('alternate_codes')
    .eq('id', submissionId)
    .single()

  if (fetchErr) throw fetchErr

  const rawAlternates = (existing.alternate_codes || []).filter((a) => a.id !== altId)
  const alternates = rawAlternates.map((alt, idx) => {
    const label = alt.label ? alt.label.trim() : ''
    const isDefaultLabel = !label || /^(Alternate\s+)?(Approach|Code)\s+\d+$/i.test(label)
    return {
      ...alt,
      label: isDefaultLabel ? `Alternate Approach ${idx + 1}` : alt.label
    }
  })

  const { data, error } = await supabase
    .from('submissions')
    .update({ alternate_codes: alternates })
    .eq('id', submissionId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE BLOCKS — Notion-style content
// ─────────────────────────────────────────────────────────────────────────────

export async function savePageBlocks(submissionId, blocks) {
  return updateSubmission(submissionId, { page_blocks: blocks })
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGES
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadImage(file, submissionId) {
  const ext = file.name.split('.').pop()
  const filePath = `${submissionId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('submission-images')
    .upload(filePath, file, { upsert: true })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('submission-images')
    .getPublicUrl(filePath)

  return data.publicUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all stats needed by the Dashboard page.
 * Optimized: single query for all counts + derived stats.
 */
export async function fetchStats() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, easyRes, mediumRes, hardRes, allRes] = await Promise.all([
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('is_accepted', true),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('difficulty', 'Easy').eq('is_accepted', true),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('difficulty', 'Medium').eq('is_accepted', true),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('difficulty', 'Hard').eq('is_accepted', true),
    supabase
      .from('submissions')
      .select('created_at, tags, language')
      .eq('is_accepted', true)
      .gte('created_at', ninetyDaysAgo)  // Only last 90 days — keeps payload bounded
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const rows = allRes.data || []

  // Activity heatmap: local date string → count
  const activityMap = {}
  rows.forEach((r) => {
    const dateObj = new Date(r.submission_time || r.created_at)
    if (!isNaN(dateObj.getTime())) {
      const yyyy = dateObj.getFullYear()
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
      const dd = String(dateObj.getDate()).padStart(2, '0')
      const day = `${yyyy}-${mm}-${dd}`
      activityMap[day] = (activityMap[day] || 0) + 1
    }
  })

  // Tag frequency
  const tagCountMap = {}
  rows.forEach((r) =>
    (r.tags || []).forEach((t) => {
      tagCountMap[t] = (tagCountMap[t] || 0) + 1
    })
  )

  // Language frequency
  const langCountMap = {}
  rows.forEach((r) => {
    if (r.language) langCountMap[r.language] = (langCountMap[r.language] || 0) + 1
  })

  return {
    total:          totalRes.count  || 0,
    easy:           easyRes.count   || 0,
    medium:         mediumRes.count || 0,
    hard:           hardRes.count   || 0,
    activity:       activityMap,
    tagCounts:      tagCountMap,
    languageCounts: langCountMap,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOPICS — Striver-style grouped by tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all submissions grouped by their database-managed topic.
 * The `topics` table is the source of truth for the topic list, so empty
 * topics remain visible and submission tags cannot create sidebar entries.
 * Returns: { tagName: [submission, ...], ... }
 * Optimized: lightweight columns only.
 */
export async function fetchTopics() {
  const [submissionsRes, topicsRes] = await Promise.all([
    supabase
      .from('submissions')
      .select('id,problem_id,problem_title,difficulty,tags,user_topic,language,runtime,memory,created_at,url')
      .eq('is_accepted', true)
      .order('problem_id', { ascending: true }),
    supabase
      .from('topics')
      .select('name,sort_order')
      .order('sort_order', { ascending: true }),
  ])

  if (submissionsRes.error) throw submissionsRes.error
  if (topicsRes.error) throw topicsRes.error

  const grouped = {}

  // Seed all database topics first (with empty arrays).
  const canonicalTopics = topicsRes.data || []
  const canonicalNames = new Set(canonicalTopics.map((topic) => topic.name))
  canonicalTopics.forEach((t) => {
    if (!grouped[t.name]) grouped[t.name] = []
  })

  // Use the selected database topic. For legacy submissions without one, use
  // a matching tag only when that tag is already a database-managed topic.
  ;(submissionsRes.data || []).forEach((row) => {
    const topicName = row.user_topic || row.tags?.find((tag) => canonicalNames.has(tag))
    if (topicName && grouped[topicName]) grouped[topicName].push(row)
  })

  // Sort each group by problem_id
  Object.keys(grouped).forEach((tag) => {
    grouped[tag].sort((a, b) => (a.problem_id || 0) - (b.problem_id || 0))
  })

  return grouped
}

/**
 * Fetch submissions for a specific topic tag.
 */
export async function fetchSubmissionsByTopic(tag) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id,problem_id,problem_title,difficulty,tags,language,runtime,memory,created_at,url,notes')
    .eq('is_accepted', true)
    .contains('tags', [tag])
    .order('problem_id', { ascending: true })

  if (error) throw error
  return data || []
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Return sorted list of all unique topic tags in the DB.
 *  Tries the get_all_tags() RPC first (single aggregate); falls back to client-side dedup. */
export async function fetchAllTags() {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_tags')
  if (!rpcErr && Array.isArray(rpcData)) return rpcData.sort()

  // Fallback: fetch raw tags and deduplicate client-side
  const { data, error } = await supabase
    .from('submissions')
    .select('tags')
    .eq('is_accepted', true)
  if (error) throw error
  const tagSet = new Set()
  data?.forEach((row) => row.tags?.forEach((t) => tagSet.add(t)))
  return Array.from(tagSet).sort()
}

/** Return sorted list of all unique languages in the DB */
export async function fetchAllLanguages() {
  const { data, error } = await supabase
    .from('submissions')
    .select('language')
    .eq('is_accepted', true)
  if (error) throw error
  const langSet = new Set(data?.map((r) => r.language).filter(Boolean))
  return Array.from(langSet).sort()
}

// ─────────────────────────────────────────────────────────────────────────────
// REVISION — Spaced repetition helpers
// ─────────────────────────────────────────────────────────────────────────────

function getLocalDateString(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Fetch problems due for revision today (next_revision_date <= today).
 * Lightweight: only fetches id, problem_title, difficulty, next_revision_date, revision_count.
 */
export async function fetchRevisionDue() {
  const today = getLocalDateString(new Date());
  const { data, error } = await supabase
    .from('submissions')
    .select('id,problem_id,problem_title,difficulty,next_revision_date,revision_count,last_revised_at')
    .eq('is_accepted', true)
    .or(`next_revision_date.lte.${today},next_revision_date.is.null`)
    .order('next_revision_date', { ascending: true, nullsFirst: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

/**
 * Mark a problem as revised with a difficulty rating.
 * Updates last_revised_at, revision_count, next_revision_date using simple spacing:
 *  easy -> +7 days, medium -> +3 days, hard -> +1 day
 */
export async function updateRevision(submissionId, difficulty = 'medium') {
  const spacingDays = { easy: 7, medium: 3, hard: 1 };
  const days = spacingDays[difficulty] || 3;
  const nextDate = getLocalDateString(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

  // Increment revision_count by fetching current first
  const { data: current } = await supabase
    .from('submissions')
    .select('revision_count')
    .eq('id', submissionId)
    .single();

  const newCount = (current?.revision_count || 0) + 1;

  const { data, error } = await supabase
    .from('submissions')
    .update({
      last_revised_at: new Date().toISOString(),
      revision_count: newCount,
      next_revision_date: nextDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select('id,revision_count,next_revision_date')
    .single();

  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT / CLEAR
// ─────────────────────────────────────────────────────────────────────────────

export async function exportAllData() {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function clearAllData() {
  // 1. Fetch all submissions with page_blocks and alternate_codes
  const { data: rows } = await supabase
    .from('submissions')
    .select('id, page_blocks, alternate_codes')

  // 2. Collect all storage paths to delete
  if (rows && rows.length > 0) {
    const allPaths = new Set()

    for (const row of rows) {
      // 2a. Files listed under the storage folder
      const { data: files } = await supabase.storage.from('submission-images').list(row.id)
      if (files && files.length > 0) {
        files.forEach((f) => allPaths.add(`${row.id}/${f.name}`))
      }

      // 2b. Image blocks in primary page_blocks
      if (row.page_blocks) {
        extractBlockImagePaths(row.id, row.page_blocks).forEach((p) => allPaths.add(p))
      }

      // 2c. Image blocks in alternate approaches
      if (Array.isArray(row.alternate_codes)) {
        for (const alt of row.alternate_codes) {
          if (alt.page_blocks) {
            extractBlockImagePaths(row.id, alt.page_blocks).forEach((p) => allPaths.add(p))
          }
        }
      }
    }

    // Delete all collected storage files in one batch
    if (allPaths.size > 0) {
      await supabase.storage.from('submission-images').remove([...allPaths])
    }
  }

  // 3. Delete all submission rows (cascades to notes)
  const { error } = await supabase
    .from('submissions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// REVISION / QUALITY — new fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle is_revised flag on a submission.
 */
export async function toggleRevised(id, isRevised) {
  const { data, error } = await supabase
    .from('submissions')
    .update({ is_revised: isRevised, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,is_revised')
    .single()
  if (error) throw error
  return data
}

/**
 * Update quality rating (100, 90, 80, 70, 60, 50 or null).
 */
export async function updateQuality(id, quality) {
  const { data, error } = await supabase
    .from('submissions')
    .update({ quality, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,quality')
    .single()
  if (error) throw error
  return data
}

/**
 * Fetch all submissions grouped by topic → subtopic hierarchy.
 * Used by the Revision page.
 * Returns: { topicName: { subtopicName: [submission, ...], ... }, ... }
 */
export async function fetchRevisionData({ qualityFilter = null } = {}) {
  let query = supabase
    .from('submissions')
    .select('id,problem_id,problem_title,difficulty,tags,language,runtime,memory,created_at,url,user_topic,subtopic,is_revised,quality')
    .eq('is_accepted', true)
    .order('problem_id', { ascending: true })

  if (qualityFilter !== null) {
    query = query.eq('quality', qualityFilter)
  }

  const { data, error } = await query
  if (error) throw error

  // Group by user_topic (main) → subtopic
  const grouped = {}

  ;(data || []).forEach((row) => {
    const mainTopic = row.user_topic || (row.tags && row.tags[0]) || 'Uncategorized'
    const sub = row.subtopic || 'General'

    if (!grouped[mainTopic]) grouped[mainTopic] = {}
    if (!grouped[mainTopic][sub]) grouped[mainTopic][sub] = []
    grouped[mainTopic][sub].push(row)
  })

  return grouped
}

/**
 * Fetch all problems for a specific topic grouped by subtopic.
 */
export async function fetchTopicProblems(topicName) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id,problem_id,problem_title,difficulty,tags,language,runtime,url,user_topic,subtopic,is_revised,quality,created_at')
    .eq('is_accepted', true)
    .eq('user_topic', topicName)
    .order('problem_id', { ascending: true })

  if (error) throw error
  return data || []
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM TOPICS — user-managed topics/subtopics stored in `topics` table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all custom topics ordered by sort_order with their subtopics attached.
 * Returns array of { id, name, sort_order, description, subtopics: string[] }
 */
export async function fetchCustomTopics() {
  const [topicsRes, subtopicsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('subtopics')
      .select('*')
      .order('sort_order', { ascending: true }),
  ])

  if (topicsRes.error) throw topicsRes.error

  const subtopicsData = subtopicsRes.data || []
  const subtopicsByTopic = {}

  subtopicsData.forEach((s) => {
    if (!s.topic_name) return
    const key = s.topic_name.trim().toLowerCase()
    if (!subtopicsByTopic[key]) {
      subtopicsByTopic[key] = []
    }
    subtopicsByTopic[key].push(s.name)
  })

  const topics = (topicsRes.data || []).map((t) => {
    let subs = []
    if (Array.isArray(t.subtopics)) {
      subs = t.subtopics
    }
    const key = (t.name || '').trim().toLowerCase()
    const dbSubs = subtopicsByTopic[key] || []
    const combined = Array.from(new Set([...subs, ...dbSubs])).filter(Boolean)
    return {
      ...t,
      subtopics: combined,
    }
  })

  return topics
}

/**
 * Upsert (insert or update) a topic row and sync its subtopics with the `subtopics` table.
 * Pass { id?, name, sort_order, subtopics } — id is optional for inserts.
 */
export async function upsertTopic(topic) {
  const cleanSubtopics = Array.isArray(topic.subtopics)
    ? topic.subtopics.map((s) => (typeof s === 'string' ? s.trim() : s)).filter(Boolean)
    : []

  const topicData = {
    ...topic,
    subtopics: cleanSubtopics,
  }

  // 1. Upsert into topics table (including JSON subtopics column)
  const { data, error } = await supabase
    .from('topics')
    .upsert(topicData)
    .select()
    .single()

  if (error) throw error

  // 2. If subtopics array is provided, sync with relational subtopics table
  if (Array.isArray(topic.subtopics)) {
    const topicName = data.name

    // Fetch existing subtopics for this topic
    const { data: existingSubs } = await supabase
      .from('subtopics')
      .select('name')
      .eq('topic_name', topicName)

    const existingNames = new Set((existingSubs || []).map((s) => s.name))
    const newNames = new Set(cleanSubtopics)

    // Insert new subtopics
    const toInsert = cleanSubtopics
      .filter((s) => !existingNames.has(s))
      .map((s, idx) => ({
        topic_name: topicName,
        name: s,
        sort_order: idx + 1,
      }))

    if (toInsert.length > 0) {
      await supabase.from('subtopics').insert(toInsert)
    }

    // Delete removed subtopics
    const toDelete = Array.from(existingNames).filter((s) => !newNames.has(s))
    if (toDelete.length > 0) {
      await supabase
        .from('subtopics')
        .delete()
        .eq('topic_name', topicName)
        .in('name', toDelete)
    }
  }

  return { ...data, subtopics: cleanSubtopics }
}

/**
 * Delete a topic by id and clean up its subtopics from the subtopics table.
 */
export async function deleteTopic(id) {
  const { data: topic } = await supabase
    .from('topics')
    .select('name')
    .eq('id', id)
    .single()

  if (topic?.name) {
    await supabase.from('subtopics').delete().eq('topic_name', topic.name)
  }

  const { error } = await supabase.from('topics').delete().eq('id', id)
  if (error) throw error
}
