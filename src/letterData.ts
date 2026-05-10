type LetterPageKind = 'envelope' | 'page' | 'other'

export type LetterSenderId = 'ollie' | 'martha'

export type LetterSenderOption = {
  id: LetterSenderId
  label: string
  folderName: string
}

export const senderOptions: LetterSenderOption[] = [
  { id: 'ollie', label: 'Ollie', folderName: 'Ollie' },
  { id: 'martha', label: 'Martha', folderName: 'Martha' },
]

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
  sender: LetterSenderId
  title: string
  dateLabel: string
  pdfSrc?: string
  pages: LetterPage[]
  hasTranscription: boolean
  transcribedPageCount: number
  pageCount: number
}

const imageModules = import.meta.glob('/letters/*/pngs/*/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const textModules = import.meta.glob('/letters/*/pngs/*/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const pdfModules = import.meta.glob('/letters/*/*.pdf', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function getLetterIdFromPath (path: string) {
  const pageMatch = path.match(/^\/letters\/[^/]+\/pngs\/([^/]+)\//)
  if (pageMatch) {
    return pageMatch[1]
  }

  const fileName = path.split('/').pop()
  if (!fileName) {
    return undefined
  }

  return fileName.replace(/\.[^.]+$/, '')
}

function getSenderFromPath (path: string) {
  const senderFolder = path.match(/^\/letters\/([^/]+)\//)?.[1]
  if (!senderFolder) {
    return undefined
  }

  return senderOptions.find(
    (senderOption) => senderOption.folderName.toLowerCase() === senderFolder.toLowerCase(),
  )?.id
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

function formatLetterDateLabel (letterId: string) {
  const letterDateId = letterId.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? letterId
  const letterDate = new Date(`${letterDateId}T12:00:00`)

  if (Number.isNaN(letterDate.getTime())) {
    return letterDateId
  }

  return dateFormatter.format(letterDate)
}

function buildLetters () {
  const letters = new Map<string, Letter>()

  for (const [path, pdfSrc] of Object.entries(pdfModules)) {
    const sender = getSenderFromPath(path)
    const letterId = getLetterIdFromPath(path)
    if (!sender || !letterId) {
      continue
    }

    const letterKey = `${sender}:${letterId}`
    letters.set(letterKey, {
      id: letterId,
      sender,
      title: `Letter from ${formatLetterDateLabel(letterId)}`,
      dateLabel: formatLetterDateLabel(letterId),
      pdfSrc,
      pages: [],
      hasTranscription: false,
      transcribedPageCount: 0,
      pageCount: 0,
    })
  }

  const upsertPage = (path: string, value: string, type: 'image' | 'text') => {
    const sender = getSenderFromPath(path)
    const letterId = getLetterIdFromPath(path)
    const pageId = getPageIdFromPath(path)
    if (!sender || !letterId || !pageId) {
      return
    }

    const letterKey = `${sender}:${letterId}`
    const existingLetter = letters.get(letterKey)
    if (!existingLetter) {
      letters.set(letterKey, {
        id: letterId,
        sender,
        title: `Letter from ${formatLetterDateLabel(letterId)}`,
        dateLabel: formatLetterDateLabel(letterId),
        pages: [],
        hasTranscription: false,
        transcribedPageCount: 0,
        pageCount: 0,
      })
    }

    const letter = letters.get(letterKey)
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

  const senderOrder = senderOptions.reduce<Record<LetterSenderId, number>>(
    (order, senderOption, index) => {
      order[senderOption.id] = index
      return order
    },
    {
      ollie: 0,
      martha: 1,
    },
  )

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
    .sort((left, right) => {
      if (left.sender !== right.sender) {
        return senderOrder[left.sender] - senderOrder[right.sender]
      }

      return left.id.localeCompare(right.id)
    })
}

export const letters = buildLetters()

export function getLettersBySender (sender: LetterSenderId) {
  return letters.filter((letter) => letter.sender === sender)
}

export function getLetterById (letterId: string | null, sender?: LetterSenderId) {
  if (!letterId) {
    return undefined
  }

  return letters.find((letter) => {
    if (sender && letter.sender !== sender) {
      return false
    }

    return letter.id === letterId
  })
}