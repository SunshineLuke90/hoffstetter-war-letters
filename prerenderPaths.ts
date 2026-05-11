import { readdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'

type SenderId = 'ollie' | 'martha'

const senderIdByFolder: Record<string, SenderId> = {
  ollie: 'ollie',
  martha: 'martha',
}

const pageSourcePattern = /\.(png|jpe?g|webp|txt)$/i

async function readDirectorySafe (directoryPath: string) {
  try {
    return await readdir(directoryPath, { withFileTypes: true })
  } catch {
    return [] as Dirent[]
  }
}

function normalizeSenderId (folderName: string): SenderId | undefined {
  return senderIdByFolder[folderName.toLowerCase()]
}

function toLetterPath (senderId: SenderId, letterId: string, pageId?: string) {
  if (!letterId) {
    return `/letters/${senderId}`
  }

  if (!pageId) {
    return `/letters/${senderId}/${letterId}`
  }

  return `/letters/${senderId}/${letterId}/${pageId}`
}

export async function getLetterPrerenderPaths () {
  const lettersRoot = path.resolve(process.cwd(), 'letters')
  const senderEntries = await readDirectorySafe(lettersRoot)

  const paths = new Set<string>(['/', '/letters', '/photos'])

  for (const senderEntry of senderEntries) {
    if (!senderEntry.isDirectory()) {
      continue
    }

    const senderId = normalizeSenderId(senderEntry.name)
    if (!senderId) {
      continue
    }

    paths.add(`/letters/${senderId}`)

    const senderPath = path.join(lettersRoot, senderEntry.name)
    const pdfEntries = await readDirectorySafe(senderPath)
    const pngRoot = path.join(senderPath, 'pngs')
    const pngLetterEntries = await readDirectorySafe(pngRoot)

    const letterIds = new Set<string>()

    for (const entry of pdfEntries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.pdf')) {
        continue
      }

      letterIds.add(entry.name.replace(/\.pdf$/i, ''))
    }

    for (const entry of pngLetterEntries) {
      if (entry.isDirectory()) {
        letterIds.add(entry.name)
      }
    }

    const sortedLetterIds = Array.from(letterIds).sort((a, b) => a.localeCompare(b))

    for (const letterId of sortedLetterIds) {
      paths.add(toLetterPath(senderId, letterId))

      const pageEntries = await readDirectorySafe(path.join(pngRoot, letterId))
      const pageIds = pageEntries
        .filter((entry) => entry.isFile() && pageSourcePattern.test(entry.name))
        .map((entry) => entry.name.replace(/\.[^.]+$/, ''))

      const uniqueSortedPageIds = Array.from(new Set(pageIds)).sort((a, b) => a.localeCompare(b))

      for (const pageId of uniqueSortedPageIds) {
        paths.add(toLetterPath(senderId, letterId, pageId))
      }
    }
  }

  return Array.from(paths)
}
