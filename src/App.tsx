import { startTransition, useEffect, useState } from 'react'
import {
  WaBadge,
  WaButton,
  WaCallout,
  WaCard,
  WaDivider,
  WaTab,
  WaTabGroup,
  WaTabPanel,
} from '@awesome.me/webawesome/dist/react'
import { getLetterById, letters, type Letter, type LetterPage } from './letterData'
import './App.css'

type Selection = {
  letterId: string | null
  pageId: string | null
}

const totalLetters = letters.length
const firstReadableLetter = letters.find((letter) => letter.hasTranscription) ?? letters[0]
const transcribedLetters = letters.filter((letter) => letter.hasTranscription).length
const yearGroups = Object.entries(
  letters.reduce<Record<string, Letter[]>>((groups, letter) => {
    const year = letter.id.slice(0, 4)
    groups[year] ??= []
    groups[year].push(letter)
    return groups
  }, {}),
)

function readSelectionFromUrl (): Selection {
  const params = new URLSearchParams(window.location.search)
  return {
    letterId: params.get('letter'),
    pageId: params.get('page'),
  }
}

function syncSelectionToUrl (selection: Selection, mode: 'push' | 'replace') {
  const url = new URL(window.location.href)

  if (selection.letterId) {
    url.searchParams.set('letter', selection.letterId)
  } else {
    url.searchParams.delete('letter')
  }

  if (selection.pageId) {
    url.searchParams.set('page', selection.pageId)
  } else {
    url.searchParams.delete('page')
  }

  window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url)
}

function resolveSelection (selection: Selection) {
  const selectedLetter = getLetterById(selection.letterId) ?? firstReadableLetter
  const selectedPage = selectedLetter?.pages.find((page) => page.id === selection.pageId)
    ?? selectedLetter?.pages[0]

  return {
    selectedLetter,
    selectedPage,
  }
}

function formatPageLabel (page: LetterPage) {
  if (page.kind === 'envelope') {
    return 'Envelope'
  }

  if (page.kind === 'page') {
    return `Page ${page.sortOrder}`
  }

  return page.name.replace(/(^|\s)\S/g, (match) => match.toUpperCase())
}

function getLetterStatus (letter: Letter) {
  if (!letter.pageCount) {
    return {
      badgeLabel: 'Awaiting scans',
      helperLabel: 'Awaiting scans',
      variant: 'warning' as const,
    }
  }

  if (!letter.transcribedPageCount) {
    return {
      badgeLabel: 'Transcript pending',
      helperLabel: 'Transcript pending',
      variant: 'neutral' as const,
    }
  }

  if (letter.transcribedPageCount === letter.pageCount) {
    return {
      badgeLabel: 'Fully transcribed',
      helperLabel: `${letter.pageCount} transcribed pages`,
      variant: 'success' as const,
    }
  }

  return {
    badgeLabel: 'Partially transcribed',
    helperLabel: `${letter.transcribedPageCount} of ${letter.pageCount} pages transcribed`,
    variant: 'warning' as const,
  }
}

function App () {
  const [selection, setSelection] = useState<Selection>(() => readSelectionFromUrl())
  const { selectedLetter, selectedPage } = resolveSelection(selection)

  useEffect(() => {
    const handlePopState = () => {
      startTransition(() => {
        setSelection(readSelectionFromUrl())
      })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!selectedLetter) {
      return
    }

    const normalizedSelection = {
      letterId: selectedLetter.id,
      pageId: selectedPage?.id ?? null,
    }

    if (
      normalizedSelection.letterId !== selection.letterId
      || normalizedSelection.pageId !== selection.pageId
    ) {
      startTransition(() => {
        setSelection(normalizedSelection)
      })
      return
    }

    syncSelectionToUrl(normalizedSelection, 'replace')
  }, [selectedLetter, selectedPage, selection.letterId, selection.pageId])

  if (!letters.length || !selectedLetter) {
    return (
      <main className="empty-state-shell">
        <WaCard className="empty-card" appearance="outlined">
          <div slot="header" className="card-header">
            <p className="eyebrow">Hoffstetter War Letters</p>
            <h1>No letters found</h1>
          </div>
          <WaCallout appearance="filled-outlined" variant="warning" size="small">
            Add PDFs or scanned pages to the letters directory to populate the archive.
          </WaCallout>
        </WaCard>
      </main>
    )
  }

  const selectedStatus = getLetterStatus(selectedLetter)

  const selectLetter = (letterId: string) => {
    const nextLetter = getLetterById(letterId)
    if (!nextLetter) {
      return
    }

    const nextSelection = {
      letterId: nextLetter.id,
      pageId: nextLetter.pages[0]?.id ?? null,
    }

    syncSelectionToUrl(nextSelection, 'push')
    startTransition(() => {
      setSelection(nextSelection)
    })
  }

  const selectPage = (pageId: string) => {
    const nextSelection = {
      letterId: selectedLetter.id,
      pageId,
    }

    syncSelectionToUrl(nextSelection, 'replace')
    startTransition(() => {
      setSelection(nextSelection)
    })
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">World War II correspondence archive</p>
          <h1>Hoffstetter War Letters</h1>
          <p className="lede">
            A chronological archive of letters exchanged between Ollie Hoffstetter and Martha Darrough
            during World War II, with scans and page-by-page transcriptions presented side by side.
          </p>
        </div>
        <div className="hero-stats" aria-label="Archive summary">
          <WaCard className="stat-card" appearance="plain">
            <p className="stat-value">{totalLetters}</p>
            <p className="stat-label">catalogued letters</p>
          </WaCard>
          <WaCard className="stat-card" appearance="plain">
            <p className="stat-value">{yearGroups.length}</p>
            <p className="stat-label">years spanned</p>
          </WaCard>
          <WaCard className="stat-card" appearance="plain">
            <p className="stat-value">{transcribedLetters}</p>
            <p className="stat-label">letters with transcripts</p>
          </WaCard>
        </div>
      </section>

      <WaDivider className="section-divider" />

      <section className="content-grid">
        <aside className="timeline-column" aria-label="Letter timeline">
          <div className="timeline-header">
            <h2>Letters by date</h2>
            <p className="timeline-copy">
              Each entry opens in place and updates the URL.
            </p>
          </div>

          <div className="timeline-scroll">
            {yearGroups.map(([year, group]) => (
              <section className="timeline-year" key={year}>
                <div className="timeline-year__label">{year}</div>
                <ol className="timeline-list">
                  {group.map((letter) => {
                    const isSelected = letter.id === selectedLetter.id
                    const status = getLetterStatus(letter)

                    return (
                      <li key={letter.id}>
                        <WaButton
                          aria-current={isSelected ? 'page' : undefined}
                          appearance={isSelected ? 'filled-outlined' : 'plain'}
                          className="timeline-button"
                          data-selected={isSelected ? 'true' : 'false'}
                          onClick={() => selectLetter(letter.id)}
                          size="large"
                          variant="neutral"
                        >
                          <span className="timeline-button__content">
                            <span className="timeline-button__date">{letter.dateLabel}</span>
                            <span className="timeline-button__meta">{status.helperLabel}</span>
                          </span>
                        </WaButton>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        </aside>

        <section className="reader-column" aria-live="polite">
          <section className="mobile-letter-menu" aria-label="Letter menu">
            <WaCard className="mobile-letter-menu__card" appearance="outlined">
              <div className="mobile-letter-menu__header">
                <div>
                  <h2 className="mobile-letter-menu__title">Choose a letter</h2>
                </div>
              </div>

              <label className="mobile-letter-menu__field">
                <select
                  className="mobile-letter-menu__select"
                  onChange={(event) => selectLetter(event.currentTarget.value)}
                  value={selectedLetter.id}
                >
                  {yearGroups.map(([year, group]) => (
                    <optgroup key={year} label={year}>
                      {group.map((letter) => {
                        const status = getLetterStatus(letter)

                        return (
                          <option key={letter.id} value={letter.id}>
                            {letter.dateLabel} - {status.helperLabel}
                          </option>
                        )
                      })}
                    </optgroup>
                  ))}
                </select>
              </label>
            </WaCard>
          </section>

          <WaCard className="reader-card" appearance="outlined">
            <div slot="header" className="reader-header">
              <div>
                <h2>{selectedLetter.dateLabel}</h2>
              </div>
              <div className="reader-header__actions">
                <WaBadge
                  appearance="filled-outlined"
                  className="status-badge"
                  pill
                  variant={selectedStatus.variant}
                >
                  {selectedStatus.badgeLabel}
                </WaBadge>
                {selectedLetter.pdfSrc ? (
                  <WaButton
                    appearance="outlined"
                    className="pdf-button"
                    href={selectedLetter.pdfSrc}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open PDF
                  </WaButton>
                ) : null}
              </div>
            </div>

            {selectedLetter.transcribedPageCount < selectedLetter.pageCount ? (
              <WaCallout appearance="filled-outlined" size="small" variant="warning">
                {selectedLetter.transcribedPageCount
                  ? 'Some pages are transcribed, but this letter is not yet complete.'
                  : 'This letter has been catalogued, but a transcription has not been added yet.'}
              </WaCallout>
            ) : null}

            {selectedLetter.pageCount ? (
              <WaTabGroup
                active={selectedPage?.id ?? ''}
                className="page-tabs"
                onWaTabShow={(event) => selectPage(event.detail.name)}
                placement="top"
              >
                {selectedLetter.pages.map((page) => (
                  <WaTab key={`tab-${page.id}`} panel={page.id} slot="nav">
                    {formatPageLabel(page)}
                  </WaTab>
                ))}

                {selectedLetter.pages.map((page) => (
                  <WaTabPanel key={`panel-${page.id}`} name={page.id}>
                    <div className="page-layout">
                      <section className="reader-pane">
                        <p className="section-label">Original scan</p>
                        {page.imageSrc ? (
                          <figure className="scan-frame">
                            <img
                              alt={`${formatPageLabel(page)} from ${selectedLetter.dateLabel}`}
                              className="scan-image"
                              loading="lazy"
                              src={page.imageSrc}
                            />
                          </figure>
                        ) : (
                          <div className="empty-pane">No scan image has been uploaded for this page.</div>
                        )}
                      </section>

                      <section className="reader-pane">
                        <p className="section-label">Transcription</p>
                        {page.transcription ? (
                          <article className="transcription-frame">
                            <p className="transcription-text">{page.transcription}</p>
                          </article>
                        ) : (
                          <div className="empty-pane">Transcription pending.</div>
                        )}
                      </section>
                    </div>
                  </WaTabPanel>
                ))}
              </WaTabGroup>
            ) : (
              <div className="empty-pane empty-pane--letter">
                This letter is listed in the archive, but no page images have been attached yet.
              </div>
            )}
          </WaCard>
        </section>
      </section>
    </main>
  )
}

export default App
