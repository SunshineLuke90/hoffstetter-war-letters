type LetterPageKind = 'envelope' | 'page' | 'other'

export type LetterPage = {
  id: string
  name: string
  imageSrc?: string
  transcription?: string
  kind: LetterPageKind
  sortOrder: number
}

export type Letter = {
  id: string
  title: string
  dateLabel: string
  pdfSrc?: string
  pages: LetterPage[]
  hasTranscription: boolean
  transcribedPageCount: number
  pageCount: number
}

const imageModules = import.meta.glob('/letters/pngs/*/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const textModules = import.meta.glob('/letters/pngs/*/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const pdfModules = import.meta.glob('/letters/*.pdf', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function getLetterIdFromPath (path: string) {
  const match = path.match(/\/letters\/(?:pngs\/)?([^/.]+)(?:\/|\.)/)
  return match?.[1]
}

function getPageIdFromPath (path: string) {
  return path.split('/').pop()?.replace(/\.[^.]+$/, '')
}

function getPageMeta (pageId: string): Pick<LetterPage, 'kind' | 'sortOrder'> {
  if (pageId === 'envelope') {
    return { kind: 'envelope', sortOrder: -1 }
  }

  const pageMatch = pageId.match(/^page-(\d+)$/)
  if (pageMatch) {
    return { kind: 'page', sortOrder: Number(pageMatch[1]) }
  }

  return { kind: 'other', sortOrder: Number.MAX_SAFE_INTEGER }
}

function buildLetters () {
  const letters = new Map<string, Letter>()

  for (const [path, pdfSrc] of Object.entries(pdfModules)) {
    const letterId = getLetterIdFromPath(path)
    if (!letterId) {
      continue
    }

    const letterDate = new Date(`${letterId}T12:00:00`)
    letters.set(letterId, {
      id: letterId,
      title: `Letter from ${dateFormatter.format(letterDate)}`,
      dateLabel: dateFormatter.format(letterDate),
      pdfSrc,
      pages: [],
      hasTranscription: false,
      transcribedPageCount: 0,
      pageCount: 0,
    })
  }

  const upsertPage = (path: string, value: string, type: 'image' | 'text') => {
    const letterId = getLetterIdFromPath(path)
    const pageId = getPageIdFromPath(path)
    if (!letterId || !pageId) {
      return
    }

    const existingLetter = letters.get(letterId)
    if (!existingLetter) {
      const letterDate = new Date(`${letterId}T12:00:00`)
      letters.set(letterId, {
        id: letterId,
        title: `Letter from ${dateFormatter.format(letterDate)}`,
        dateLabel: dateFormatter.format(letterDate),
        pages: [],
        hasTranscription: false,
        transcribedPageCount: 0,
        pageCount: 0,
      })
    }

    const letter = letters.get(letterId)
    if (!letter) {
      return
    }

    const page =
      letter.pages.find((entry) => entry.id === pageId) ??
      (() => {
        const nextPage: LetterPage = {
          id: pageId,
          name: pageId.replace(/-/g, ' '),
          ...getPageMeta(pageId),
        }
        letter.pages.push(nextPage)
        return nextPage
      })()

    if (type === 'image') {
      page.imageSrc = value
      return
    }

    page.transcription = value.trim()
  }

  for (const [path, imageSrc] of Object.entries(imageModules)) {
    upsertPage(path, imageSrc, 'image')
  }

  for (const [path, transcription] of Object.entries(textModules)) {
    upsertPage(path, transcription, 'text')
  }

  return Array.from(letters.values())
    .map((letter) => {
      letter.pages.sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder
        }

        return left.id.localeCompare(right.id)
      })

      letter.pageCount = letter.pages.length
      letter.transcribedPageCount = letter.pages.filter(
        (page) => Boolean(page.transcription),
      ).length
      letter.hasTranscription = letter.transcribedPageCount > 0

      return letter
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

export const letters = buildLetters()

export function getLetterById (letterId: string | null) {
  if (!letterId) {
    return undefined
  }

  return letters.find((letter) => letter.id === letterId)
}