import DOMPurify from 'dompurify'
import htmlToPdfmake from 'html-to-pdfmake'

export const LEETCODE = 'https://leetcode.com/'

export function webUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value, base)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function imageUrl(value, base) {
  return /^data:image\/(?:png|jpeg|gif|webp|avif|bmp|svg\+xml)[;,]/i.test(value) ? value : webUrl(value, base)
}

function imageRequestUrl(source) {
  const url = new URL(source)
  if (['assets.leetcode.com', 'leetcode.com'].includes(url.hostname) && url.pathname.startsWith('/uploads/')) {
    return `${import.meta.env.BASE_URL}pdf-images${url.pathname}${url.search}`
  }
  return source
}

async function readImage(source) {
  const response = await fetch(imageRequestUrl(source), {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Image request failed')
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('Expected an image')

  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1500 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    const format = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    return { data: canvas.toDataURL(format, 0.94), width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function createPDFImages() {
  const images = {}
  const cache = new Map()
  let missing = 0

  const get = async (sources, base, caption) => {
    const candidates = new Set(sources.map((source) => imageUrl(source?.trim(), base)).filter(Boolean))
    for (const source of candidates) {
      if (!cache.has(source)) {
        const key = `image-${cache.size + 1}`
        cache.set(source, readImage(source).then(({ data, width, height }) => {
          images[key] = data
          return { image: key, fit: [Math.min(width * 0.75, 487), Math.min(height * 0.75, 275)], margin: [0, 6, 0, 6] }
        }).catch(() => null))
      }
      const image = await cache.get(source)
      if (image) return { ...image }
    }
    missing += 1
    const link = Array.from(candidates).find((source) => source.startsWith('http'))
    return { text: caption ? `Image unavailable (${caption})` : 'Image unavailable', style: 'muted', link }
  }

  return { images, get, missingCount: () => missing }
}

export async function descriptionContent(description, base, images) {
  if (!description?.trim()) return []
  if (!/<[a-z][^>]*>/i.test(description)) return [{ text: description, font: 'Mono', preserveLeadingSpaces: true }]

  const template = document.createElement('template')
  template.content.append(DOMPurify.sanitize(description, {
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'audio', 'video'],
    FORBID_ATTR: ['style', 'class', 'id', 'data-pdfmake', 'width', 'height'],
  }))

  for (const link of template.content.querySelectorAll('a[href]')) {
    const url = webUrl(link.getAttribute('href'), base)
    if (url) link.setAttribute('href', url)
    else link.removeAttribute('href')
  }
  await Promise.all(Array.from(template.content.querySelectorAll('img'), async (element) => {
    const picture = element.closest('picture')
    const src = element.getAttribute('src')
    const srcset = element.getAttribute('srcset') || element.getAttribute('data-srcset') ||
      picture?.querySelector('source')?.getAttribute('srcset') || ''
    const responsive = srcset.trim().split(/\s+/, 1)[0].replace(/,+$/, '')
    const image = await images.get([
      element.getAttribute('data-src'), element.getAttribute('data-original'),
      element.getAttribute('data-lazy-src'), src?.startsWith('data:') ? responsive : src, responsive, src,
    ], base, element.getAttribute('alt'))
    const replacement = template.content.ownerDocument.createElement(image.image ? 'img' : 'span')
    if (image.image) {
      replacement.setAttribute('src', image.image)
      replacement.setAttribute('data-pdfmake', JSON.stringify({ fit: image.fit, margin: image.margin }))
    } else {
      replacement.textContent = image.text
      replacement.style.color = '#a1a1aa'
    }
    const original = picture || element
    original.replaceWith(replacement)
  }))
  return htmlToPdfmake(template.innerHTML, {
    defaultStyles: {
      a: { color: '#fb923c', decoration: 'underline' },
      p: { margin: [0, 3, 0, 5] },
      pre: { font: 'Mono', fontSize: 9.5, background: '#27272a', margin: [0, 6, 0, 6] },
      code: { font: 'Mono', color: '#fdba74' },
      th: { bold: true, fillColor: '#18181b' },
    },
    collapseMargins: true,
  })
}
