/** Emoji offered in the stop icon picker. Any emoji in imported GeoJSON also works. */
export const ICONS = [
  '📍', '⭐', '❤️', '🚩', '🏁', '🏠',
  '🏨', '⛺', '🍽️', '☕', '🍺', '🛒',
  '⛽', '🏛️', '🏰', '⛪', '🎡', '🎟️',
  '🏖️', '⛰️', '🌲', '🥾', '📷', '🚗',
  '✈️', '🚆', '⛴️', '🚲', '🅿️', '🏥',
]

export const EMOJI_IMAGE_PREFIX = 'emoji:'

/**
 * Render an emoji to an image MapLibre can use as an icon. Map fonts (SDF glyphs)
 * can't draw colour emoji, so we rasterize with the browser's emoji font instead.
 */
export function emojiImage(emoji: string, cssSize = 18) {
  const ratio = 2
  const px = Math.ceil(cssSize * 1.25 * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  const ctx = canvas.getContext('2d')!
  ctx.font = `${cssSize * ratio}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, px / 2, px / 2 + ratio)
  return { data: ctx.getImageData(0, 0, px, px), pixelRatio: ratio }
}

// ---- Emoji IDs ----
// In GeoJSON an icon is stored as its Unicode code point sequence: uppercase hex,
// hyphen-separated, e.g. 🏨 → "1F3E8", 🏛️ → "1F3DB-FE0F", 🇯🇵 → "1F1EF-1F1F5".
// This matches the "unified" IDs used by Unicode emoji data, Twemoji, Noto and OpenMoji.

const ID_RE = /^(?:U\+)?[0-9A-F]{4,6}(?:[-_ ](?:U\+)?[0-9A-F]{4,6})*$/i
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** 🏨 → "1F3E8" */
export function emojiToId(emoji: string): string {
  return [...emoji].map((c) => c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join('-')
}

/** First emoji in a string (whole grapheme, so ZWJ sequences and flags stay intact), or ''. */
export function firstEmoji(text: string): string {
  for (const { segment } of segmenter.segment(text)) {
    if (EMOJI_RE.test(segment)) return segment
  }
  return ''
}

/** Accepts "1F3E8", "U+1F3E8", "1f3db-fe0f", or a literal emoji. Returns the emoji or ''. */
export function idToEmoji(value: string): string {
  const v = value.trim()
  if (ID_RE.test(v)) {
    try {
      const emoji = String.fromCodePoint(...v.split(/[-_ ]/).map((p) => parseInt(p.replace(/^U\+/i, ''), 16)))
      return firstEmoji(emoji)
    } catch {
      return ''
    }
  }
  return firstEmoji(v)
}
