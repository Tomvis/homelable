// A ```mermaid fence drawn as a diagram (HW-302). Redrawn whenever the home theme changes.
// Until it is drawn, and when mermaid rejects it, the source shows as a normal code block.
import { useEffect, useState, useSyncExternalStore } from 'react'

import { getState, subscribe } from '@/homeTheme/runtime'
import { cn } from '@/lib/utils'

import { loadMermaid, mermaidConfig, nextRenderId, shortError } from './mermaid'

const BOX = 'my-4 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3'

export function MermaidDiagram({ source, className }: { source: string; className?: string }) {
  const theme = useSyncExternalStore(subscribe, getState)
  const [drawn, setDrawn] = useState<{ svg?: string; error?: string }>({})

  useEffect(() => {
    let live = true
    const id = nextRenderId()
    loadMermaid()
      .then((mermaid) => {
        mermaid.initialize(mermaidConfig(theme))
        return mermaid.render(id, source)
      })
      .then(({ svg }) => { if (live) setDrawn({ svg }) })
      .catch((e: unknown) => { if (live) setDrawn({ error: shortError(e) }) })
    return () => { live = false }
  }, [source, theme])

  if (drawn.svg) {
    return (
      <div
        role="img"
        aria-label="Diagram"
        className={cn(BOX, 'flex justify-center [&_svg]:h-auto [&_svg]:max-w-full', className)}
        // mermaid's own output under securityLevel 'strict' (DOMPurify-sanitised, no html labels)
        dangerouslySetInnerHTML={{ __html: drawn.svg }}
      />
    )
  }
  return (
    <div className={cn('my-4', className)}>
      <pre className={cn(BOX, 'my-0')} aria-busy={!drawn.error}>
        <code className="language-mermaid font-mono text-xs">{source}</code>
      </pre>
      {drawn.error && (
        <p className="mt-1 text-xs text-destructive">Diagram not drawn: {drawn.error}</p>
      )}
    </div>
  )
}
