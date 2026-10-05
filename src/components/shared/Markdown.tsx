import { Fragment, type ReactNode } from 'react'

/**
 * The one renderer for the owner's texts on the public page.  (BR-095, S1-060)
 *
 * Minimal markdown only -- **bold**, *italic* / _italic_, and `- ` bullets -- because
 * that is all the backoffice editor writes. Anything else is shown as plain text,
 * never dropped and never interpreted: React escapes it, and there is no HTML path.
 * Shared, so it must never touch the session.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={blocks.length} className="list-disc space-y-1 pl-5">
        {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
      </ul>,
    )
    bullets = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      bullets.push(bullet[1])
      continue
    }
    flush()
    if (line !== '') blocks.push(<p key={blocks.length}>{inline(line)}</p>)
  }
  flush()
  return <div className={`space-y-2 ${className ?? ''}`}>{blocks}</div>
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g
  let last = 0
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push(s.slice(last, m.index))
    out.push(m[1] ? <strong key={m.index}>{m[1]}</strong> : <em key={m.index}>{m[2] ?? m[3]}</em>)
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return out.map((n, i) => <Fragment key={i}>{n}</Fragment>)
}
