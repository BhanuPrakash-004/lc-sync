/**
 * CodeEditor.jsx
 * ---------------
 * Read / Edit code display with:
 *  - Syntax highlighting (via react-syntax-highlighter)
 *  - Language label with color dot
 *  - Copy-to-clipboard button
 *  - Toggle between read-only highlighted view and editable textarea
 *  - Dark #0F0F0F background
 *
 * Props:
 *  - code      : string
 *  - language  : string
 *  - editable  : boolean  – shows edit toggle when true
 *  - onChange  : (newCode: string) => void
 *  - fillHeight : boolean – fills parent container height
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Copy, Check, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

/* ─── Language → display color ─────────────────────────────────────────────── */
const LANG_COLORS = {
  python:     '#3B82F6',
  python3:    '#3B82F6',
  javascript: '#F59E0B',
  typescript: '#60A5FA',
  java:       '#F97316',
  cpp:        '#A78BFA',
  'c++':      '#A78BFA',
  c:          '#6B7280',
  go:         '#34D399',
  rust:       '#FB923C',
  ruby:       '#F43F5E',
  kotlin:     '#818CF8',
  swift:      '#FF6E40',
  scala:      '#EF4444',
  sql:        '#22D3EE',
}

/* ─── Language → react-syntax-highlighter language name ───────────────────── */
const LANG_MAP = {
  python:     'python',
  python3:    'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java:       'java',
  cpp:        'cpp',
  'c++':      'cpp',
  c:          'c',
  go:         'go',
  rust:       'rust',
  ruby:       'ruby',
  kotlin:     'kotlin',
  swift:      'swift',
  scala:      'scala',
  sql:        'sql',
  mysql:      'sql',
  postgresql: 'sql',
}

function langColor(lang = '') {
  return LANG_COLORS[lang.toLowerCase()] ?? '#9CA3AF'
}

function hlLang(lang = '') {
  return LANG_MAP[lang.toLowerCase()] ?? 'plaintext'
}

/* ─── Copy button ───────────────────────────────────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const timeout = useRef(null)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      clearTimeout(timeout.current)
      timeout.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [text])

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy code'}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
        border transition-all duration-200
        ${copied
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'
        }
      `}
    >
      {copied
        ? <><Check className="w-3.5 h-3.5" /> Copied</>
        : <><Copy className="w-3.5 h-3.5" /> Copy</>
      }
    </button>
  )
}

/* ─── Syntax-highlighted read view ─────────────────────────────────────────── */
function SyntaxView({ code, language, collapsed, maxCollapsedLines = 30, fillHeight }) {
  const lines = (code ?? '').split('\n')
  const displayCode = collapsed ? lines.slice(0, maxCollapsedLines).join('\n') : (code ?? '')
  const hlLanguage = hlLang(language)

  const customStyle = {
    margin: 0,
    padding: '12px 0',
    background: 'transparent',
    fontSize: '13px',
    lineHeight: '1.6',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
    ...(fillHeight ? { height: '100%', overflow: 'auto' } : {}),
  }

  const lineNumberStyle = {
    minWidth: '2.5em',
    paddingRight: '1em',
    paddingLeft: '0.75em',
    color: '#4B5563',
    userSelect: 'none',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    display: 'inline-block',
    textAlign: 'right',
    fontSize: '12px',
  }

  return (
    <div className={`overflow-x-auto select-text ${fillHeight ? 'h-full' : ''}`}>
      <SyntaxHighlighter
        language={hlLanguage}
        style={atomOneDark}
        showLineNumbers
        lineNumberStyle={lineNumberStyle}
        customStyle={customStyle}
        wrapLines={false}
        PreTag="div"
        CodeTag="code"
      >
        {displayCode || ' '}
      </SyntaxHighlighter>

      {/* Collapsed overflow hint */}
      {collapsed && lines.length > maxCollapsedLines && (
        <div className="px-4 py-1 text-xs text-gray-600 italic border-t border-white/5">
          … {lines.length - maxCollapsedLines} more line{lines.length - maxCollapsedLines > 1 ? 's' : ''} hidden
        </div>
      )}
    </div>
  )
}

/* ─── Highlighted Editable Textarea Component ───────────────────────────────── */
export function HighlightedCodeArea({
  value = '',
  onChange = () => {},
  language = 'python',
  placeholder = 'Type or paste code here…',
  showLineNumbers = true,
  className = '',
  fillHeight = true,
}) {
  const backdropRef = useRef(null)
  const lineNumbersRef = useRef(null)
  const textareaRef = useRef(null)

  const hlLanguage = hlLang(language)
  const displayCode = value.endsWith('\n') ? value + ' ' : value
  const lines = (value || '').split('\n')

  const handleScroll = (e) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.target.scrollTop
      backdropRef.current.scrollLeft = e.target.scrollLeft
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      const val = e.target.value
      const newValue = val.substring(0, start) + '    ' + val.substring(end)
      onChange(newValue)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4
        }
      }, 0)
    }
  }

  return (
    <div className={`relative w-full flex bg-[#0F0F0F] overflow-hidden ${fillHeight ? 'h-full' : 'min-h-[200px]'} ${className}`}>
      {/* Line Numbers Gutter */}
      {showLineNumbers && (
        <div
          ref={lineNumbersRef}
          className="w-12 flex-shrink-0 overflow-hidden border-r border-white/5 bg-[#0B0B0B] select-none pointer-events-none pt-[12px] pr-3 text-right font-mono text-[13px] leading-[1.6] text-zinc-600"
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}

      {/* Main Editor Area */}
      <div className="relative flex-1 h-full overflow-hidden">
        {/* Syntax Highlighted Backdrop */}
        <div
          ref={backdropRef}
          className="absolute inset-0 overflow-hidden pointer-events-none"
        >
          <SyntaxHighlighter
            language={hlLanguage}
            style={atomOneDark}
            customStyle={{
              margin: 0,
              padding: '12px 16px',
              background: 'transparent',
              fontSize: '13px',
              lineHeight: '1.6',
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
              whiteSpace: 'pre',
              wordBreak: 'normal',
              tabSize: 4,
            }}
            wrapLines={false}
            PreTag="div"
            CodeTag="code"
          >
            {displayCode || ' '}
          </SyntaxHighlighter>
        </div>

        {/* Transparent Input Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-white focus:outline-none resize-none font-mono text-[13px] leading-[1.6] p-[12px_16px] white-space-pre overflow-auto border-none placeholder:text-zinc-600"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
            tabSize: 4,
          }}
        />
      </div>
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────────────────────── */
export default function CodeEditor({
  code      = '',
  language  = 'Python',
  editable  = false,
  onChange  = () => {},
  fillHeight = false,
}) {
  const [isEditing,   setIsEditing]   = useState(false)
  const [localCode,   setLocalCode]   = useState(code)
  const [collapsed,   setCollapsed]   = useState(false)

  const lines   = (code || '').split('\n')
  const isLong  = !fillHeight && lines.length > 30
  const color   = langColor(language)

  /* Keep local code in sync when prop changes */
  useEffect(() => { setLocalCode(code) }, [code])

  const handleChange = (e) => {
    setLocalCode(e.target.value)
    onChange(e.target.value)
  }

  const handleSave = () => {
    onChange(localCode)
    setIsEditing(false)
  }

  const handleDiscard = () => {
    setLocalCode(code)
    setIsEditing(false)
  }

  const wrapClass = fillHeight
    ? 'flex flex-col h-full overflow-hidden border-0 bg-[#0F0F0F]'
    : 'rounded-xl overflow-hidden border border-white/5 bg-[#0F0F0F]'

  return (
    <div className={wrapClass}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-[#141414]">
        {/* Language label */}
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-mono font-semibold" style={{ color }}>
            {language}
          </span>
          <span className="text-xs text-gray-600 font-mono">
            {lines.length} line{lines.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isEditing && <CopyButton text={localCode} />}

          {editable && !isEditing && (
            <button
              onClick={() => { setLocalCode(code); setIsEditing(true) }}
              className="
                flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                bg-white/5 border border-white/10 text-gray-400
                hover:text-gray-200 hover:border-white/20 transition-all duration-200
              "
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {isEditing && (
            <>
              <button
                onClick={handleDiscard}
                className="
                  flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                  bg-white/5 border border-white/10 text-gray-400
                  hover:text-gray-200 hover:border-white/20 transition-all
                "
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                className="
                  flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                  bg-[#FFA116]/10 border border-[#FFA116]/30 text-[#FFA116]
                  hover:bg-[#FFA116]/20 transition-all
                "
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Code area ─────────────────────────────────────────────────────── */}
      {isEditing ? (
        <HighlightedCodeArea
          value={localCode}
          onChange={(val) => {
            setLocalCode(val)
            onChange(val)
          }}
          language={language}
          fillHeight={fillHeight}
        />
      ) : (
        /* Read-only syntax-highlighted view */
        <div className={`select-text ${fillHeight ? 'flex-1 overflow-y-auto' : ''}`}>
          <SyntaxView
            code={localCode}
            language={language}
            collapsed={isLong && collapsed}
            maxCollapsedLines={30}
            fillHeight={fillHeight}
          />
        </div>
      )}

      {/* ── Expand / Collapse (only for long non-fill-height files) ─────────── */}
      {isLong && !isEditing && !fillHeight && (
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="
            w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium
            text-gray-500 hover:text-gray-300 border-t border-white/5
            bg-[#0D0D0D] hover:bg-[#141414] transition-all duration-200
          "
        >
          {collapsed ? (
            <><ChevronDown className="w-3.5 h-3.5" /> Show all {lines.length} lines</>
          ) : (
            <><ChevronUp className="w-3.5 h-3.5" /> Collapse</>
          )}
        </button>
      )}
    </div>
  )
}
