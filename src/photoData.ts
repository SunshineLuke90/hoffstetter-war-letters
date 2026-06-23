export type PhotoMetadata = {
  accessible: string
  subject: string
  date: string
}

export type PhotoCardData = {
  id: string
  folderName: string
  subject: string
  accessible: string
  date: string
  frontSrc: string
  backSrc?: string
}

const photoMetadataModules = import.meta.glob('/photos/*/data.json', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const photoImageModules = import.meta.glob('/photos/*/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

type PhotoBuildEntry = {
  id: string
  folderName: string
  frontSrc?: string
  backSrc?: string
  fallbackImages: string[]
  metadata?: PhotoMetadata
}

const ignoredPhotoFolders = new Set(['photoexample'])

function shouldIgnoreFolder (folderName: string) {
  return ignoredPhotoFolders.has(folderName.toLowerCase())
}

function getFolderFromPath (path: string) {
  return path.match(/^\/photos\/([^/]+)\//)?.[1]
}

function getStemFromPath (path: string) {
  const fileName = path.split('/').pop()
  if (!fileName) return undefined
  return fileName.replace(/\.[^.]+$/, '').toLowerCase()
}

function parseMetadata (jsonText: string): PhotoMetadata | undefined {
  try {
    const parsed = JSON.parse(jsonText) as Partial<PhotoMetadata>

    if (typeof parsed !== 'object' || parsed === null) {
      return undefined
    }

    return {
      accessible: typeof parsed.accessible === 'string' ? parsed.accessible.trim() : '',
      subject: typeof parsed.subject === 'string' ? parsed.subject.trim() : '',
      date: typeof parsed.date === 'string' ? parsed.date.trim() : '',
    }
  } catch {
    return undefined
  }
}

function buildPhotoCards () {
  const entries = new Map<string, PhotoBuildEntry>()

  for (const [path, jsonText] of Object.entries(photoMetadataModules)) {
    const folderName = getFolderFromPath(path)
    if (!folderName) continue
    if (shouldIgnoreFolder(folderName)) continue

    const existing =
      entries.get(folderName) ?? {
        id: folderName,
        folderName,
        fallbackImages: [],
      }

    existing.metadata = parseMetadata(jsonText)
    entries.set(folderName, existing)
  }

  for (const [path, imageSrc] of Object.entries(photoImageModules)) {
    const folderName = getFolderFromPath(path)
    const stem = getStemFromPath(path)
    if (!folderName || !stem) continue
    if (shouldIgnoreFolder(folderName)) continue

    const existing =
      entries.get(folderName) ?? {
        id: folderName,
        folderName,
        fallbackImages: [],
      }

    if (stem === 'front') {
      existing.frontSrc = imageSrc
    } else if (stem === 'back') {
      existing.backSrc = imageSrc
    } else {
      existing.fallbackImages.push(imageSrc)
    }

    entries.set(folderName, existing)
  }

  return Array.from(entries.values())
    .map((entry): PhotoCardData | undefined => {
      const frontSrc = entry.frontSrc ?? entry.fallbackImages[0]
      if (!frontSrc) {
        return undefined
      }

      const subject = entry.metadata?.subject || entry.folderName
      const accessible = entry.metadata?.accessible || subject
      const date = entry.metadata?.date || 'Unknown date'

      return {
        id: entry.id,
        folderName: entry.folderName,
        subject,
        accessible,
        date,
        frontSrc,
        backSrc: entry.backSrc,
      }
    })
    .filter((entry): entry is PhotoCardData => Boolean(entry))
    .sort((left, right) => left.folderName.localeCompare(right.folderName))
}

export const photos = buildPhotoCards()
