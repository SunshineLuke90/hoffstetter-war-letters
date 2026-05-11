import type { Config } from '@react-router/dev/config'
import { getLetterPrerenderPaths } from './prerenderPaths'

export default {
  appDirectory: 'src',
  ssr: false,
  async prerender ({ getStaticPaths }) {
    const staticPaths = await getStaticPaths()
    const letterPaths = await getLetterPrerenderPaths()

    return Array.from(new Set([...staticPaths, ...letterPaths]))
  },
} satisfies Config
