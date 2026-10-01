// Home theme (HW-48, Tomvis fork only): build-time remap of upstream's GitHub-dark palette
// literals to the home tokens (homelab-stacks theme/dist/tokens.resolved.json, dark mode).
// Components hardcode these hexes in hundreds of places; remapping the emitted JS/CSS keeps
// the fork's diff to this file + one plugin line, so rebases onto upstream stay clean.
// Runs on the final bundle only (`apply: 'build'`): Tailwind generates `.bg-\[\#00d4ff\]`
// from the source, so class strings and selectors must be rewritten together, in the output.
// Unmapped colours (node-type palette, user picks) pass through untouched.
import type { Plugin } from 'vite'

export const HOME_HEX: Record<string, string> = {
  '0d1117': '16222a', // base bg        -> bg
  '161b22': '1f2f38', // elevated       -> surface
  '21262d': '283b45', // card           -> surface-2
  '30363d': '3a525d', // border         -> border
  'e6edf3': 'eaf0f0', // text           -> text
  '8b949e': '8ba4ae', // muted text     -> text-disabled
  '00d4ff': '8db0bd', // primary cyan   -> primary (cyan is "on right now" only)
  '22d3ee': '8db0bd', // second cyan (fibre edges, node accents) -> primary
  '39d353': '14d9c4', // online green   -> lit (the one live state)
  'f85149': 'ff8aa0', // offline/danger -> alarm
  'e3b341': 'f5b14c', // pending        -> warning
}

const HEX_RE = new RegExp(`(#)(${Object.keys(HOME_HEX).join('|')})(?=(?:[0-9a-f]{2})?(?![0-9a-f]))`, 'gi')
const RGB: [RegExp, string][] = [
  [/(rgba?\(\s*)0\s*,\s*212\s*,\s*255(?=\s*[,)])/g, '$1141, 176, 189'],
  [/(rgba?\(\s*)13\s*,\s*17\s*,\s*23(?=\s*[,)])/g, '$122, 34, 42'],
  [/(rgba?\(\s*)57\s*,\s*211\s*,\s*83(?=\s*[,)])/g, '$120, 217, 196'],
]
const FONT_RE = /(?<![\w-])(['"]?)(?:Inter Variable|Inter|JetBrains Mono)\1(?=\s*,)/g

/** Remap palette literals; `fonts` also renames inline font stacks (JS only, never @font-face CSS). */
export function remapHome(code: string, fonts = false): string {
  let out = code.replace(HEX_RE, (_m, hash: string, hex: string) => hash + HOME_HEX[hex.toLowerCase()])
  for (const [re, to] of RGB) out = out.replace(re, to)
  if (fonts) out = out.replace(FONT_RE, '$1Rubik$1')
  return out
}

export function homeTheme(): Plugin {
  return {
    name: 'home-theme',
    apply: 'build',
    enforce: 'post',
    renderChunk(code) {
      return { code: remapHome(code, true), map: null }
    },
    generateBundle(_opts, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css') && typeof file.source === 'string') {
          file.source = remapHome(file.source)
        }
      }
    },
  }
}
