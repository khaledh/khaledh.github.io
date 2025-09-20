import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token'

const TRAILING_ATTRS_RE = /\s*\{([^}]*)\}\s*$/

function parseAttrPairs(src: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([A-Za-z_:][\w:-]*)=(?:"([^"]*)"|'([^']*)'|([^\s"'}]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const key = m[1]
    const val = m[2] ?? m[3] ?? m[4] ?? ''
    out[key] = val
  }
  return out
}

export default function tableCellSpanPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'table-cell-span', (state) => {
    const tokens = state.tokens

    for (let i = 0; i < tokens.length; i++) {
      const inlineTok = tokens[i]
      const openTok = tokens[i - 1]

      if (
        !inlineTok ||
        inlineTok.type !== 'inline' ||
        !openTok ||
        (openTok.type !== 'th_open' && openTok.type !== 'td_open')
      ) {
        continue
      }

      // Look for trailing {...} in the cell's combined text
      const m = inlineTok.content.match(TRAILING_ATTRS_RE)
      if (!m) continue

      const attrs = parseAttrPairs(m[1])
      let span = 1

      for (const [k, v] of Object.entries(attrs)) {
        if ((k === 'colspan' || k === 'rowspan') && /^\d+$/.test(v)) {
          openTok.attrSet(k, v)
          if (k === 'colspan') span = parseInt(v, 10)
        }
      }

      if (span <= 1) continue

      // Strip the trailing {...} from text
      inlineTok.content = inlineTok.content.replace(TRAILING_ATTRS_RE, '')
      const children: Token[] = inlineTok.children ?? []
      for (let j = children.length - 1; j >= 0; j--) {
        if (children[j].type === 'text') {
          children[j].content = children[j].content.replace(TRAILING_ATTRS_RE, '')
          break
        }
      }

      // 🔥 Remove the redundant cells from the token stream
      // Each table cell = open, inline, close (3 tokens)
      const removeCount = (span - 1) * 3
      if (removeCount > 0) {
        tokens.splice(i + 1, removeCount)
        // Adjust index so we don’t skip tokens
        i -= removeCount
      }
    }
  })
}
