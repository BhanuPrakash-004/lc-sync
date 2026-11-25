import pdfMake from 'pdfmake/build/pdfmake'
import hljs from 'highlight.js/lib/common'
import scala from 'highlight.js/lib/languages/scala'
import atomOneDark from 'react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark'
import inter from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff?url'
import interItalic from '@fontsource/inter/files/inter-latin-400-italic.woff?url'
import interBoldItalic from '@fontsource/inter/files/inter-latin-700-italic.woff?url'
import mono from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url'
import monoBold from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?url'
import monoItalic from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-italic.woff?url'
import math from '@fontsource/noto-sans-math/files/noto-sans-math-latin-400-normal.woff?url'
import { codeLanguageColor } from './codeTheme'
import { createPDFImages, descriptionContent, LEETCODE, webUrl } from './pdfImages'

hljs.registerLanguage('scala', scala)
const fontUrl = (url) => new URL(url, window.location.href).href
const mathUrl = fontUrl(math)
pdfMake.addFonts({
  Inter: { normal: fontUrl(inter), bold: fontUrl(interBold), italics: fontUrl(interItalic), bolditalics: fontUrl(interBoldItalic) },
  Mono: { normal: fontUrl(mono), bold: fontUrl(monoBold), italics: fontUrl(monoItalic), bolditalics: fontUrl(monoItalic) },
  Math: { normal: mathUrl, bold: mathUrl, italics: mathUrl, bolditalics: mathUrl },
})

const TITLE = 'LC Sync Study Guide'
const MARGIN = 51
const color = {
  page: '#09090b', panel: '#18181b', border: '#27272a', editor: '#0f0f0f', toolbar: '#141414',
  title: '#ffffff', body: '#d4d4d8', description: '#f5f5f5', muted: '#a1a1aa', brand: '#ffa116',
  orange: '#fb923c', pale: '#fdba74', purple: '#c084fc', green: '#34d399',
  yellow: '#facc15', red: '#f87171', blue: '#93c5fd',
}
const difficulties = { Easy: color.green, Medium: color.yellow, Hard: color.red }
const aliases = new Map([
  ['python3', 'python'], ['pypy3', 'python'], ['golang', 'go'], ['c++', 'cpp'], ['c#', 'csharp'],
  ['mysql', 'sql'], ['postgresql', 'sql'],
])
function highlightedLines(code, language) {
  const name = language.trim().toLowerCase()
  const syntax = aliases.get(name) || name
  const template = document.createElement('template')
  if (hljs.getLanguage(syntax)) {
    template.innerHTML = hljs.highlight(code, { language: syntax }).value
  } else {
    template.content.append(document.createTextNode(code))
  }
  const tokens = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  const lines = [[]]
  while (tokens.nextNode()) {
    const token = tokens.currentNode
    const tokenStyle = Array.from(token.parentElement?.classList || [], (name) => atomOneDark[name]).find(Boolean)
    for (const [index, text] of token.data.split(/\r\n?|\n/).entries()) {
      if (index) lines.push([])
      if (text) lines.at(-1).push({
        text: text.replaceAll('\t', '    '),
        color: tokenStyle?.color,
        italics: tokenStyle?.fontStyle === 'italic',
        bold: tokenStyle?.fontWeight === 'bold',
      })
    }
  }
  return lines
}

function codeBlock(label, code, language = '', labelColor = color.orange) {
  if (!code) return []
  return [{
    margin: [0, 10, 0, 8],
    layout: {
      hLineWidth: (index) => index === 1 ? 0.5 : 0,
      hLineColor: () => color.border,
      vLineWidth: () => 0,
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: (index) => index === 0 ? 5 : 0,
      paddingBottom: (index) => index === 0 ? 5 : 0,
    },
    table: {
      widths: ['*'],
      headerRows: 1,
      keepWithHeaderRows: 1,
      body: [
        [{ fillColor: color.toolbar, columns: [
          { text: label, color: labelColor, bold: true },
          { text: language, color: codeLanguageColor(language), style: 'monoLabel', alignment: 'right', width: 'auto' },
        ] }],
        ...highlightedLines(code, language).map((runs) => [{
          text: runs.length ? runs : ' ',
          style: 'code',
          fillColor: color.editor,
          preserveLeadingSpaces: true,
        }]),
      ],
    },
  }]
}

function resource(label, url, base, textColor = color.orange) {
  const href = webUrl(url, base)
  return href ? [{ text: label, link: href, color: textColor, decoration: 'underline' }] : []
}

function stats(item) {
  return [
    ...(item.runtime ? [{ text: `Runtime ${item.runtime}   `, color: color.purple }] : []),
    ...(item.memory ? [{ text: `Memory ${item.memory}   `, color: color.blue }] : []),
  ]
}

function resourceItems(item, base, approach = '') {
  return [
    ['ChatGPT', item.chatgpt_urls, item.chatgpt_url, color.green],
    ['YouTube', item.youtube_urls, item.youtube_url, color.red],
  ].flatMap(([label, urls, legacy, textColor]) => {
    const values = [...new Set([...(Array.isArray(urls) ? urls : []), legacy].filter(Boolean))]
    return values.flatMap((url, index) => resource(
      label + (values.length > 1 ? ` ${index + 1}` : '') + (approach ? ` (${approach})` : ''), url, base, textColor
    ))
  })
}

async function notes(item, title, base, images) {
  const blocks = Array.isArray(item.page_blocks) ? item.page_blocks.filter(Boolean) : []
  if (!item.notes && !blocks.length) return []
  const rendered = await Promise.all(blocks.map(async (block) => {
    const text = block.content || ''
    const paragraph = { text, margin: [0, 3, 0, 4], preserveLeadingSpaces: true }
    switch (block.type) {
      case 'h1': return [{ ...paragraph, style: 'subtopic' }]
      case 'h2':
      case 'h3': return [{ ...paragraph, color: color.title, bold: true }]
      case 'bullet': return [{ ...paragraph, text: `• ${text}` }]
      case 'todo': return [{ ...paragraph, text: `[${block.checked ? 'x' : ' '}] ${text}`, decoration: block.checked ? 'lineThrough' : undefined }]
      case 'code': return codeBlock('Code', text, block.language || '', color.muted)
      case 'image': return text ? [
        await images.get([text], base, block.caption),
        ...(block.caption ? [{ text: block.caption, style: 'muted' }] : []),
      ] : []
      case 'link': return resource(block.title || block.url, block.url, base)
      case 'chatgpt': return resource(block.title || 'ChatGPT Discussion', block.url, base, color.green)
      case 'callout': return [{ ...paragraph, color: color.pale }]
      case 'divider': return [rule(color.border, 5)]
      default: return text ? [paragraph] : []
    }
  }))
  return [
    { text: title, style: 'heading', color: color.purple },
    ...(item.notes ? [{ text: item.notes, preserveLeadingSpaces: true }] : []),
    ...rendered.flat(),
  ]
}

function rule(stroke, spacing, width = 493) {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.5, lineColor: stroke }],
    margin: [0, spacing, 0, spacing],
  }
}

async function problemSection({ problem, id, unit, subtopic, unitNumber, firstInUnit, firstInSubtopic }, images, separatePage) {
  const base = webUrl(problem.url, LEETCODE) || LEETCODE
  const title = problem.problem_title || 'Problem'
  const alternates = Array.isArray(problem.alternate_codes) ? problem.alternate_codes.filter(Boolean) : []
  const [description, attachments, mainNotes, alternateNotes] = await Promise.all([
    descriptionContent(problem.description, base, images),
    Promise.all((Array.isArray(problem.images) ? problem.images.filter(Boolean) : []).map((image) => images.get([image], base))),
    notes(problem, 'Notes & Highlights', base, images),
    Promise.all(alternates.map((alt, index) => notes(alt, `${alt.label || `Alternate Approach ${index + 1}`} Notes`, base, images))),
  ])
  const header = [
    ...(firstInUnit ? [
      { text: `UNIT ${unitNumber}`, style: 'label' },
      { text: unit, style: 'unit' },
    ] : []),
    { text: firstInSubtopic ? subtopic : `${unit} › ${subtopic}`, style: firstInSubtopic ? 'subtopic' : 'label' },
    { text: title, style: 'problem' },
    { text: [
      ...(problem.problem_id > 0 ? [{ text: `LC #${problem.problem_id}   `, color: color.orange, font: 'Mono' }] : []),
      ...(problem.difficulty ? [{ text: `${problem.difficulty}   `, color: difficulties[problem.difficulty], bold: true }] : []),
      ...stats(problem),
      ...resource('LeetCode', problem.url, LEETCODE),
    ], fontSize: 9, margin: [0, 0, 0, 8] },
  ]
  if (!separatePage) {
    const date = new Date(problem.submission_time || problem.created_at)
    const tags = (problem.tags || []).map((tag) => typeof tag === 'string' ? tag : tag?.name).filter(Boolean)
    const details = [Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(), ...tags].filter(Boolean)
    if (details.length) header.push({ text: details.join(' · '), style: 'muted' })
  }
  Object.assign(header[0], { id, pageBreak: separatePage ? 'before' : undefined })

  const links = resourceItems(problem, base)
  const approaches = alternates.flatMap((alt, index) => {
    const label = alt.label || `Alternate Approach ${index + 1}`
    links.push(...resourceItems(alt, base, label))
    const performance = stats(alt)
    return [
      ...codeBlock(label, alt.code, alt.language || problem.language || '', color.purple),
      ...(performance.length ? [{ text: performance, fontSize: 9 }] : []),
      ...alternateNotes[index],
    ]
  })
  return [
    ...header,
    ...(description.length ? [
      { text: 'Problem description', style: 'heading', color: color.orange },
      { stack: description, color: color.description },
    ] : []),
    ...attachments,
    ...codeBlock('Primary Solution', problem.code, problem.language || ''),
    ...mainNotes,
    ...approaches,
    ...(links.length ? [
      { text: 'Resources', style: 'heading', color: color.green },
      { text: links.flatMap((link, index) => index ? ['   ', link] : [link]) },
    ] : []),
  ]
}

function contentsRow(text, id, level) {
  return {
    margin: [level * 12, level === 0 ? 7 : 0, 0, 0],
    unbreakable: true,
    stack: [{
      columns: [
        { text, linkToDestination: id },
        { pageReference: id, alignment: 'right', width: 36, color: color.title },
      ],
      columnGap: 8,
      bold: level < 2,
      color: level === 0 ? color.orange : level === 1 ? color.title : color.body,
    }, ...(level === 2 ? [rule(color.border, 2, 469)] : [])],
  }
}

function organize(groups) {
  const entries = []
  const contents = []
  for (const [unitIndex, unit] of groups.entries()) {
    contents.push(contentsRow(`Unit ${unitIndex + 1} · ${unit.name}`, `problem-${entries.length + 1}`, 0))
    for (const [sectionIndex, section] of unit.subtopics.entries()) {
      contents.push(contentsRow(section.name, `problem-${entries.length + 1}`, 1))
      for (const [problemIndex, problem] of section.problems.entries()) {
        const id = `problem-${entries.length + 1}`
        const label = [
          problem.problem_title || 'Problem',
          ...(problem.problem_id > 0 ? [{ text: ` (LC #${problem.problem_id})`, color: color.orange, font: 'Mono', fontSize: 9 }] : []),
        ]
        contents.push(contentsRow(label, id, 2))
        entries.push({
          problem, id, unit: unit.name, subtopic: section.name, unitNumber: unitIndex + 1,
          firstInUnit: sectionIndex === 0 && problemIndex === 0, firstInSubtopic: problemIndex === 0,
        })
      }
    }
  }
  return { entries, contents }
}

const styles = {
  cover: { fontSize: 30, bold: true, color: color.title, margin: [0, 0, 0, 5] },
  unit: { fontSize: 24, bold: true, color: color.title },
  subtopic: { fontSize: 14, bold: true, color: color.pale, margin: [0, 1, 0, 7] },
  problem: { fontSize: 21, bold: true, color: color.title, lineHeight: 1.08, margin: [0, 0, 0, 8] },
  heading: { fontSize: 12, bold: true, color: color.title, margin: [0, 9, 0, 4] },
  label: { fontSize: 9, bold: true, color: color.pale },
  muted: { fontSize: 9, color: color.muted },
  monoLabel: { font: 'Mono', fontSize: 9 },
  code: { font: 'Mono', fontSize: 9, color: '#abb2bf', lineHeight: 1.07 },
}

function documentDefinition(title, content, images) {
  return {
    info: { title, creator: 'LC Sync' },
    pageSize: 'A4',
    pageMargins: [MARGIN, 47, MARGIN, 52],
    defaultStyle: { font: 'Inter', fontSize: 10.5, color: color.body, lineHeight: 1.2 },
    styles,
    background: (_, { width, height }) => ({
      canvas: [{ type: 'rect', x: 0, y: 0, w: width, h: height, color: color.page }],
    }),
    footer: (page, pages) => ({
      margin: [MARGIN, 2, MARGIN, 0],
      stack: [
        rule(color.border, 6),
        { columns: [
          { text: TITLE, style: 'muted' },
          { text: `Page ${page} of ${pages}`, alignment: 'right', bold: true, color: color.title, fontSize: 10 },
        ] },
      ],
    }),
    images,
    content,
  }
}

function applyMathFont(node) {
  if (typeof node === 'string') {
    const segments = node.split(/([\u0370-\u03ff\u2190-\u22ff\u27c0-\u2aff]+)/u)
    return segments.length === 1 ? node : {
      text: segments.flatMap((text, index) => text ? [{ text, font: index % 2 ? 'Math' : undefined }] : []),
    }
  }
  if (Array.isArray(node)) return node.map(applyMathFont)
  if (!node || typeof node !== 'object') return node
  if (node.text != null) {
    const text = applyMathFont(node.text)
    node.text = typeof node.text === 'string' && typeof text === 'object' ? text.text : text
  }
  for (const key of ['stack', 'columns', 'ul', 'ol']) {
    if (node[key]) node[key] = applyMathFont(node[key])
  }
  if (node.table?.body) node.table.body = applyMathFont(node.table.body)
  return node
}

export async function downloadPDF(groups, { single = false, onProgress = () => {} } = {}) {
  const { entries, contents } = organize(groups)
  const images = createPDFImages()
  const problems = []
  onProgress('Preparing problems and images…')
  const batchSize = 12
  for (let index = 0; index < entries.length; index += batchSize) {
    const sections = await Promise.all(entries.slice(index, index + batchSize).map(
      (entry) => problemSection(entry, images, !single)
    ))
    problems.push(...sections.flat())
  }

  const title = single ? entries[0].problem.problem_title || 'LC Sync Problem' : TITLE
  const frontMatter = single ? [] : [
    rule(color.brand, 5),
    { text: TITLE, style: 'cover' },
    { text: `${groups.length} ${groups.length === 1 ? 'unit' : 'units'} · ${entries.length} ${entries.length === 1 ? 'problem' : 'problems'}`, style: 'muted' },
    { text: 'Contents', style: 'heading', fontSize: 19, margin: [0, 16, 0, 4] },
    { text: 'Page', alignment: 'right', style: 'muted' },
    ...contents,
  ]
  onProgress('Building PDF…')
  const content = applyMathFont([...frontMatter, ...problems])
  const pdf = pdfMake.createPdf(documentDefinition(title, content, images.images))
  const blob = await pdf.getBlob()
  const slug = single ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) : 'study-guide'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lc-sync-${slug || 'problem'}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return images.missingCount()
}
