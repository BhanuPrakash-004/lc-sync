/**
 * SetupPage.jsx
 * -------------
 * First-run setup guide shown when Supabase environment variables are missing
 * or when the database connection cannot be established.
 */

import { useState } from 'react'
import {
  ExternalLink, RefreshCw, Copy, Check, BookOpen, GitBranch, ChevronRight, Zap,
  Puzzle, Database, Lock, Code2, ChevronDown, ChevronUp
} from 'lucide-react'

const GITHUB_URL = 'https://github.com/BhanuPrakash-004/lc-sync'
const SETUP_URL = `${GITHUB_URL}/blob/main/SETUP.md`

const ENV_TEMPLATE = `# Supabase project credentials (Settings -> API)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_AUTH_ENABLED=false`

const CANONICAL_SQL_SHORT = `-- LC Sync — Supabase Database Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Submissions table: stores accepted LeetCode solutions, metadata, notes, and alternate approaches
CREATE TABLE IF NOT EXISTS public.submissions (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             text,
    problem_id          integer         NOT NULL DEFAULT 0,
    problem_title       text            NOT NULL DEFAULT 'Unknown Problem',
    problem_slug        text,
    difficulty          text            CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    tags                text[],
    user_topic          text,
    user_subtopic       text,
    subtopic            text,
    language            text            NOT NULL DEFAULT 'Unknown',
    code                text            NOT NULL DEFAULT '',
    alternate_codes     jsonb           NOT NULL DEFAULT '[]'::jsonb,
    page_blocks         jsonb           NOT NULL DEFAULT '[]'::jsonb,
    notes               text,
    description         text,
    images              jsonb           NOT NULL DEFAULT '[]'::jsonb,
    url                 text,
    chatgpt_url         text,
    chatgpt_urls        jsonb           NOT NULL DEFAULT '[]'::jsonb,
    youtube_url         text,
    youtube_urls        jsonb           NOT NULL DEFAULT '[]'::jsonb,
    runtime             text,
    memory              text,
    is_accepted         boolean         NOT NULL DEFAULT true,
    submission_time     timestamptz     DEFAULT now(),
    last_revised_at     timestamptz,
    revision_count      integer         NOT NULL DEFAULT 0,
    next_revision_date  date,
    is_revised          boolean         NOT NULL DEFAULT false,
    quality             integer         CHECK (quality IN (100, 90, 80, 70, 60, 50)),
    created_at          timestamptz     NOT NULL DEFAULT now(),
    updated_at          timestamptz     NOT NULL DEFAULT now()
);

-- Topics table: main problem categories
CREATE TABLE IF NOT EXISTS public.topics (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL UNIQUE,
    description text,
    sort_order  integer     NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Subtopics table: specific sub-patterns under each main topic
CREATE TABLE IF NOT EXISTS public.subtopics (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_name  text        NOT NULL REFERENCES public.topics(name) ON DELETE CASCADE,
    name        text        NOT NULL,
    description TEXT,
    sort_order  integer     NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(topic_name, name)
);

-- Notes table: auxiliary linked notes for submissions
CREATE TABLE IF NOT EXISTS public.notes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   uuid        REFERENCES public.submissions(id) ON DELETE CASCADE,
    content         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_submissions_updated_at
    BEFORE UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_problem_id    ON public.submissions (problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_difficulty    ON public.submissions (difficulty);
CREATE INDEX IF NOT EXISTS idx_submissions_language      ON public.submissions (language);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id       ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at    ON public.submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_is_accepted   ON public.submissions (is_accepted);
CREATE INDEX IF NOT EXISTS idx_submissions_user_topic    ON public.submissions (user_topic) WHERE user_topic IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_subtopic      ON public.submissions (subtopic) WHERE subtopic IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_is_revised    ON public.submissions (is_revised);
CREATE INDEX IF NOT EXISTS idx_submissions_quality       ON public.submissions (quality) WHERE quality IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_tags          ON public.submissions USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_submissions_page_blocks   ON public.submissions USING GIN (page_blocks);
CREATE INDEX IF NOT EXISTS idx_submissions_alt_codes     ON public.submissions USING GIN (alternate_codes);

CREATE INDEX IF NOT EXISTS idx_topics_name               ON public.topics (name);
CREATE INDEX IF NOT EXISTS idx_topics_sort_order         ON public.topics (sort_order);
CREATE INDEX IF NOT EXISTS idx_subtopics_topic_name      ON public.subtopics (topic_name);

-- Row Level Security (RLS) policies allowing client API calls with anon key
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes       ENABLE ROW LEVEL SECURITY;

-- ── anon (unauthenticated / VITE_AUTH_ENABLED=false) ────────────────────────
CREATE POLICY "anon_select_submissions" ON public.submissions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_submissions" ON public.submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_submissions" ON public.submissions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_submissions" ON public.submissions FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_topics" ON public.topics FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_topics" ON public.topics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_topics" ON public.topics FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_topics" ON public.topics FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_subtopics" ON public.subtopics FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_subtopics" ON public.subtopics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_subtopics" ON public.subtopics FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_subtopics" ON public.subtopics FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_notes" ON public.notes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_notes" ON public.notes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_notes" ON public.notes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_notes" ON public.notes FOR DELETE TO anon USING (true);

-- ── authenticated (logged-in users / VITE_AUTH_ENABLED=true) ─────────────────
CREATE POLICY "auth_select_submissions" ON public.submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_submissions" ON public.submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_submissions" ON public.submissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_submissions" ON public.submissions FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_topics" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_topics" ON public.topics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_topics" ON public.topics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_topics" ON public.topics FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_subtopics" ON public.subtopics FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_subtopics" ON public.subtopics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_subtopics" ON public.subtopics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_subtopics" ON public.subtopics FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_notes" ON public.notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_notes" ON public.notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_notes" ON public.notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_notes" ON public.notes FOR DELETE TO authenticated USING (true);

-- Default Topics Seed Data
INSERT INTO public.topics (name, description, sort_order) VALUES
('Array','Fundamental collection of elements stored at contiguous memory locations.',1),
('Strings','Sequence of characters and common string manipulation patterns.',2),
('Binary Search','Efficient search algorithm that divides the search interval in half.',3),
('Stack','LIFO (Last In First Out) data structure patterns.',4),
('Recursion','Solving problems by breaking them down into smaller, self-similar subproblems.',5),
('Linked List','Linear data structure where elements are not stored at contiguous memory locations.',6),
('Double Linked List','Linked List with navigation in both forward and backward directions.',7),
('HashMap','Key-value pair data structure for O(1) average time complexity lookups.',8),
('Tree','Hierarchical data structure with a root value and subtrees of children.',9),
('Binary Search Tree','Tree data structure where left child < root < right child.',10),
('Graph','Non-linear data structure consisting of nodes and edges.',11),
('Heap','Priority Queue data structure for efficient retrieval of highest/lowest priority elements.',12),
('Backtracking','Algorithmic technique for solving problems recursively by trying to build a solution incrementally.',13),
('Greedy','Algorithm paradigm that follows the problem solving heuristic of making the locally optimal choice.',14),
('Dynamic Programming','Optimization method involving breaking down problems into simpler subproblems and storing their solutions.',15),
('Trie','Tree-based data structure used for efficiently storing and retrieving keys in a dataset of strings.',16),
('Bit Manipulation','Techniques that perform operations on data at the bit level.',17)
ON CONFLICT (name) DO NOTHING;

-- Default Subtopics Seed Data
INSERT INTO public.subtopics (topic_name,name,description,sort_order) VALUES

-- Array
('Array','Two-Pointer','Use two indices that move towards or away from each other to reduce redundant comparisons.',1),
('Array','Sliding Window','Maintain a window of fixed size or expand/shrink it to satisfy a condition.',2),
('Array','Prefix Sum','Precompute cumulative sums so any subarray or range sum can be answered in O(1).',3),
('Array','Kadane''s Algorithm','Track the best subarray sum ending at each index and update the global maximum.',4),

-- Strings
('Strings','Two-Pointer (Palindrome)','Compare characters from both ends and move inward until the condition fails.',1),
('Strings','Sliding Window (String)','Maintain a moving window and adjust its size to satisfy character constraints.',2),

-- Binary Search
('Binary Search','Classic Binary Search','Divide-and-conquer → narrow search space in sorted array.',1),
('Binary Search','Lower / Upper Bound','Find first/last occurrence or smallest/largest index satisfying a condition.',2),
('Binary Search','Binary Search on Answers','Treat answer space as sorted → binary search to find minimum/maximum feasible value.',3),
('Binary Search','Search in 2D Matrix','Apply binary search row-wise / column-wise or flattened array.',4),

-- Stack
('Stack','Monotonic Stack','Maintain a monotonic increasing/decreasing stack to find next/prev greater/smaller, histogram ranges, or collisions.',1),
('Stack','Expression Evaluation','Use two stacks or postfix evaluation to handle numbers and operators efficiently.',2),
('Stack','Stack Simulation / Undo Operation','Simulate operations using a stack → pop on undo, remove adjacent duplicates, collapse characters.',3),
('Stack','Parenthesis & Scoring','Push opening symbols and validate closing ones; sometimes track count or score.',4),
('Stack','Stack-Based Design','Use two stacks to implement another data structure or maintain extra info.',5),
('Stack','Stack + Greedy','Combine stack properties with greedy choices to optimize strings or numbers.',6),
('Stack','Recursive Stack','Handle top/head element recursively → recurse on remaining stack/list → combine/insert results.',7),

-- Recursion
('Recursion','Linear Recursion','Solve problems by reducing them to a simpler instance of the same problem.',1),
('Recursion','Non-Linear Recursion','Make multiple recursive calls at each step to explore different branches and combine their results.',2),
('Recursion','Divide & Conquer','Divide the problem into smaller subproblems, solve them recursively, and combine results.',3),
('Recursion','Recursion on LinkedList/Stack','Process data structures recursively by handling the first/last element and recursing on the rest.',4),
('Recursion','Subsequences','Explore all possible subsets by choosing to include or exclude each element.',5),

-- Linked List
('Linked List','Basic Operations','Directly manipulate pointers to insert, delete, traverse, and get length.',1),
('Linked List','Fast and Slow Pointers','Use two pointers at different speeds to detect cycles, middle node, or duplicates.',2),
('Linked List','Reversal Pattern','Reverse entire list, partial list, or groups to reorder nodes.',3),
('Linked List','Merge / Sort','Merge sorted lists, sort list using merge sort, or reorder using middle + reverse + merge.',4),
('Linked List','LinkedList with Stack/HashMap','Use a stack to handle backward traversal, carry logic, or next greater node.',5),

-- Double Linked List
('Double Linked List','Basic DLL Operations','Maintain prev and next pointers carefully for insert, delete, traversal; use DLL + HashMap for O(1) cache operations.',1),
('Double Linked List','Merge / Sort / Reorder','Use DLL properties (prev/next) to efficiently merge, sort, reorder, flatten, or perform pointer-based checks.',2),

-- HashMap
('HashMap','Frequency Map / Counting','Count elements to find majority, top-k frequent, or sort by frequency.',1),
('HashMap','Prefix-Sum with Map','Track cumulative sums; map stores first occurrence → solve subarray sum problems.',2),

-- Tree
('Tree','DFS Traversals','Standard DFS → used for max depth, path sums, subtree calculations.',1),
('Tree','BFS / Level-Order','Use queue → traverse level by level → calculate sums, averages, or side views.',2),
('Tree','Lowest Common Ancestor','DFS recursion or parent-pointer mapping → find common ancestor efficiently.',3),
('Tree','Serialization / Construction','Preorder / level-order encode-decode → reconstruct tree or flatten.',4),

-- Binary Search Tree
('Binary Search Tree','BST Operations','Leverage BST property (left < root < right) for search, insertion, deletion, and range queries.',1),
('Binary Search Tree','LCA & Range Queries','Use BST property → traverse from root to find split point → LCA.',2),

-- Graph
('Graph','BFS (Unweighted Path)','Standard BFS → track distance/levels → queue-based traversal → multi-source if needed.',1),
('Graph','DFS (Connectivity)','DFS recursion or stack → track visited → identify connected components or detect cycles.',2),
('Graph','Topological Sort','DFS postorder or BFS (Kahn''s algorithm) → order nodes respecting dependencies.',3),
('Graph','MST / Union-Find','Use Kruskal''s / Prim''s algorithm or Union-Find → find MST, minimum cost connections, or detect cycles.',4),
('Graph','Dijkstra (Weighted)','Use priority queue → relax edges → track shortest distances.',5),
('Graph','Bellman-Ford','Relax all edges V-1 times → detect negative cycles.',6),
('Graph','Floyd-Warshall','DP over adjacency matrix → shortest paths between all pairs of nodes.',7),

-- Heap
('Heap','Top-K Elements','Use min-heap for top-k largest, max-heap for top-k smallest → maintain heap of size k.',1),
('Heap','Merge K Sorted','Use min-heap to merge multiple sorted arrays/lists efficiently.',2),
('Heap','Heap with Sliding Window','Maintain a heap of elements in the window → pop outdated elements → track maximum.',3),
('Heap','Implementation of Heap','Design heap.',4),
('Heap','Huffman Pattern','Repeatedly combine the two smallest elements to minimize the total cost.',5),

-- Backtracking
('Backtracking','Choice-Based Backtracking','It is commonly used in problems that ask to generate all possible combinations, subsets, or permutations.',1),
('Backtracking','Constraint-Based Backtracking','At each step, choose whether to include an element → explore all subsets/choices recursively.',2),
('Backtracking','Grid / Path Backtracking','Move in grid recursively → explore all valid paths → backtrack after each move.',3),
('Backtracking','Decision Tree / Sequence Generation','Generate sequences or strings recursively by making a choice at each step.',4),

-- Greedy
('Greedy','Intervals & Reach','Sort intervals or extend reach as far as possible from current position → maximize tasks done / minimize steps.',1),
('Greedy','Sorting / Local Choice','Sort array or select elements → make locally optimal choice → achieve global optimum.',2),

-- Dynamic Programming
('Dynamic Programming','1D / Linear DP','Track optimal solution using a 1D array → sequences, sums, or counts.',1),
('Dynamic Programming','2D / Grid DP','Use 2D array → track states for row/column → movement or path constraints.',2),
('Dynamic Programming','DP on Strings','Use 2D DP → index i,j represent substrings/subsequences → solve LCS, palindrome, or edit distance.',3),
('Dynamic Programming','DP on Intervals','Track optimal solutions for subarrays/intervals → matrix chain, merging, or balloon burst patterns.',4),
('Dynamic Programming','DP on Trees / DAGs','Recursion + memoization → track states along tree paths → post-order traversal.',5),
('Dynamic Programming','Knapsack / Subset Sum','Track states based on weight/value → classic 0-1 / bounded / unbounded variants.',6),
('Dynamic Programming','DP on Stocks','State machine DP to track whether you are holding a stock or not.',7),

-- Trie
('Trie','Basic Trie Operations','Build Trie → insert words → search full word or prefix efficiently → collect suggestions in lexicographic order.',1),
('Trie','Word Break / Segmentation','Use Trie for fast lookup → combine with DP or backtracking for word segmentation and concatenation.',2),
('Trie','Bitwise Trie / XOR','Use Trie for binary representation of numbers → efficiently find maximum/minimum XOR or subset XOR.',3),

-- Bit Manipulation
('Bit Manipulation','Basic Bit Operations','Use XOR / AND / OR / shift operations → detect single/missing numbers or count bits efficiently.',1),
('Bit Manipulation','Subsets / Bitmask','Iterate through all subsets using bits → solve combinatorial or DP counting problems.',2),
('Bit Manipulation','Advanced XOR','Use XOR properties → maximize/minimize XOR over array/subarray or ranges.',3)

ON CONFLICT (topic_name,name) DO NOTHING;

-- RPC Functions
CREATE OR REPLACE FUNCTION get_all_tags()
RETURNS text[]
LANGUAGE sql STABLE AS $$
    SELECT ARRAY(
        SELECT DISTINCT unnest(tags)
        FROM   public.submissions
        WHERE  is_accepted = true
        ORDER  BY 1
    );
$$;

CREATE OR REPLACE FUNCTION get_submission_activity(days_back int DEFAULT 90)
RETURNS TABLE(day text, cnt bigint)
LANGUAGE sql STABLE AS $$
    SELECT
        date_trunc('day', created_at AT TIME ZONE 'UTC')::date::text AS day,
        COUNT(*)                                                       AS cnt
    FROM   public.submissions
    WHERE  is_accepted  = true
      AND  created_at  >= now() - (days_back || ' days')::interval
    GROUP  BY 1
    ORDER  BY 1;
$$;

CREATE OR REPLACE FUNCTION get_revision_stats()
RETURNS TABLE(total bigint, revised_count bigint, quality_avg numeric)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint AS total,
        COUNT(CASE WHEN is_revised = true THEN 1 END)::bigint AS revised_count,
        ROUND(AVG(quality), 1)::numeric AS quality_avg
    FROM public.submissions
    WHERE is_accepted = true;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: submission-images bucket
-- Stores images attached to block editor blocks (uploaded via BlockEditor.jsx)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'submission-images',
    'submission-images',
    true,                  -- public bucket so image URLs work without auth tokens
    10485760,              -- 10 MB per file
    ARRAY[
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow anon and authenticated users to upload images
CREATE POLICY "storage_allow_insert_anon"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'submission-images');

CREATE POLICY "storage_allow_insert_auth"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'submission-images');

-- Allow anyone to view/download images (required for public URLs)
CREATE POLICY "storage_allow_select_anon"
    ON storage.objects FOR SELECT
    TO anon
    USING (bucket_id = 'submission-images');

CREATE POLICY "storage_allow_select_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'submission-images');

-- Allow deletion (used when submissions or blocks are deleted)
CREATE POLICY "storage_allow_delete_anon"
    ON storage.objects FOR DELETE
    TO anon
    USING (bucket_id = 'submission-images');

CREATE POLICY "storage_allow_delete_auth"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'submission-images');
`

// ─────────────────────────────────────────────────────────────────────────────
// Brand logo — uses the actual favicon.png from public/
// ─────────────────────────────────────────────────────────────────────────────
function LcLogo() {
  return (
    <img
      src="/favicon.png"
      alt="LC Sync"
      className="w-14 h-14 rounded-2xl drop-shadow-lg"
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Background glowing ambient orbs
// ─────────────────────────────────────────────────────────────────────────────
function BackgroundOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-orange-500/10 blur-3xl animate-pulse" />
      <div
        className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-amber-600/8 blur-3xl animate-pulse"
        style={{ animationDelay: '1.5s' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-orange-500/5 blur-2xl animate-pulse"
        style={{ animationDelay: '3s' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step card component
// ─────────────────────────────────────────────────────────────────────────────
function StepCard({ step, totalSteps, title, description, children }) {
  return (
    <div className="relative flex gap-4 group">
      {/* Connector line */}
      {step < totalSteps && (
        <div className="absolute left-5 top-12 bottom-0 w-px bg-gradient-to-b from-orange-500/30 via-orange-500/10 to-transparent" />
      )}
      {/* Number bubble */}
      <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center group-hover:bg-orange-500/25 transition-colors">
        <span className="text-orange-400 text-sm font-extrabold">{step}</span>
      </div>
      {/* Content */}
      <div className="flex-1 pb-8">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">
          {title}
        </h3>
        <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{description}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy button helper
// ─────────────────────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy' }) {
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
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700/60 transition-all active:scale-95"
      aria-label={label}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SetupPage Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function SetupPage() {
  const [showSqlPreview, setShowSqlPreview] = useState(false)
  const handleRefresh = () => window.location.reload()

  return (
    <div className="relative min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6 overflow-x-hidden">
      <BackgroundOrbs />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-2xl space-y-8 my-8">

        {/* ── Hero Banner ────────────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <LcLogo />
              <div className="absolute inset-0 rounded-xl ring-2 ring-orange-500/30 animate-ping" style={{ animationDuration: '3.5s' }} />
            </div>
          </div>

          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              LC{' '}
              <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
                Sync
              </span>
            </h1>
            <p className="mt-3 text-zinc-400 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
              Automatically sync your LeetCode solutions, notes &amp; alternate approaches directly into your private Supabase database.
            </p>
          </div>

          {/* Feature Badges */}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {[
              { label: 'Chrome Extension Backend', icon: Puzzle },
              { label: 'Supabase PostgreSQL', icon: Database },
              { label: 'Spaced Repetition', icon: Zap },
              { label: 'PDF Export', icon: Code2 },
            ].map((f) => {
              const Icon = f.icon
              return (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-zinc-300 text-xs font-medium"
                >
                  <Icon className="w-3 h-3 text-orange-400" />
                  {f.label}
                </span>
              )
            })}
          </div>
        </div>

        {/* ── Setup Steps Card ───────────────────────────────────────────── */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/80 shadow-2xl shadow-black/40 backdrop-blur-md px-6 sm:px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800/60">
            <h2 className="text-zinc-200 font-semibold text-xs uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Complete Setup Guide (4 Steps)
            </h2>
            <span className="text-zinc-500 text-xs font-mono">schema.sql v1.0</span>
          </div>

          {/* Step 1: Create Supabase Project */}
          <StepCard
            step={1}
            totalSteps={4}
            title="Create a Free Supabase Project"
            description="Sign up at supabase.com (free tier) and click New Project. Give it a name (e.g. lc-sync) and set a secure database password."
          >
            <a
              href="https://supabase.com/dashboard/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/60 text-xs font-medium transition-colors"
            >
              Open Supabase Dashboard
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </StepCard>

          {/* Step 2: Run Database Schema */}
          <StepCard
            step={2}
            totalSteps={4}
            title="Run Database Migration (supabase/schema.sql)"
            description="In your Supabase project, open SQL Editor → New Query. Copy and paste the complete database schema script and click Run."
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <a
                  href={`${GITHUB_URL}/blob/main/supabase/schema.sql`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 text-xs font-medium transition-colors"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  View Canonical supabase/schema.sql on GitHub
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>

                <button
                  onClick={() => setShowSqlPreview(!showSqlPreview)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition-colors"
                >
                  {showSqlPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showSqlPreview ? 'Hide SQL Code' : 'Preview SQL Code'}
                </button>
              </div>

              {showSqlPreview && (
                <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 mt-2 overflow-hidden">
                  <div className="flex justify-between items-center px-3 py-2 border-b border-zinc-800/60 text-zinc-500 text-[11px]">
                    <span className="font-mono">supabase/schema.sql</span>
                    <CopyBtn text={CANONICAL_SQL_SHORT} label="Copy Schema Code" />
                  </div>
                  <div className="overflow-x-auto p-3">
                    <pre className="whitespace-pre text-[11px] leading-relaxed text-zinc-300 font-mono min-w-0">
                      {CANONICAL_SQL_SHORT}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </StepCard>

          {/* Step 3: Install Extension Backend */}
          <StepCard
            step={3}
            totalSteps={4}
            title="Install Chrome Extension Backend"
            description="Go to chrome://extensions → Enable Developer mode → Load unpacked → Select the backend/ folder. Open Extension options and paste your Supabase URL & Anon Key."
          >
            <a
              href={`${SETUP_URL}#part-3----chrome-extension-backend-setup`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/60 text-xs font-medium transition-colors"
            >
              <Puzzle className="w-3.5 h-3.5 text-orange-400" />
              View Extension Setup Guide
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </StepCard>

          {/* Step 4: Configure Web App Environment */}
          <StepCard
            step={4}
            totalSteps={4}
            title="Configure Web App Environment (.env.local)"
            description="Create a .env.local (or .env) file in the frontend/ directory with your Supabase project URL and anon public key, then restart the dev server."
          >
            <div className="relative rounded-xl bg-zinc-950 border border-zinc-800/80 overflow-hidden mt-1">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/50">
                <span className="text-zinc-400 text-xs font-mono font-semibold">frontend/.env.local</span>
                <CopyBtn text={ENV_TEMPLATE} label="Copy .env Template" />
              </div>
              <pre className="text-xs font-mono text-zinc-300 px-4 py-3.5 leading-relaxed whitespace-pre overflow-x-auto">
                <span className="text-zinc-500"># Find these in Supabase Dashboard → Settings → API{'\n'}</span>
                <span className="text-emerald-400">VITE_SUPABASE_URL</span>
                <span className="text-zinc-400">=</span>
                <span className="text-orange-300">https://your-project-id.supabase.co{'\n'}</span>
                <span className="text-emerald-400">VITE_SUPABASE_ANON_KEY</span>
                <span className="text-zinc-400">=</span>
                <span className="text-orange-300">your-anon-key-here{'\n'}</span>
                <span className="text-emerald-400">VITE_AUTH_ENABLED</span>
                <span className="text-zinc-400">=</span>
                <span className="text-amber-300">false</span>
              </pre>
            </div>
          </StepCard>
        </div>

        {/* ── Action Buttons ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleRefresh}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-sm shadow-lg shadow-orange-500/20 transition-all duration-200 hover:shadow-orange-500/35 hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            I've Completed Setup — Refresh Page
          </button>

          <a
            href={SETUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 hover:text-white border border-zinc-700/60 text-sm font-medium transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            View Full Setup Guide
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
          </a>
        </div>

        {/* ── Footer Link ───────────────────────────────────────────────── */}
        <div className="text-center">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5" />
            {GITHUB_URL.replace('https://', '')}
          </a>
        </div>

      </div>
    </div>
  )
}
