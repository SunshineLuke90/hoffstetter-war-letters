import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import {
  getLetterById,
  getLettersBySender,
  letters,
  senderOptions,
  type Letter,
  type LetterPage,
  type LetterSenderId,
} from '../letterData'

type Selection = {
  senderId: LetterSenderId
  letterId: string | null
  pageId: string | null
}

type LettersRouteParams = {
  senderId?: string
  letterId?: string
  pageId?: string
}

const totalLetters = letters.length
const transcribedLetters = letters.filter((letter) => letter.hasTranscription).length

const defaultSenderId = senderOptions.find((sender) => getLettersBySender(sender.id).length)?.id
  ?? senderOptions[0].id

function getDefaultLetterForSender (senderId: LetterSenderId) {
  const senderLetters = getLettersBySender(senderId)
  return senderLetters.find((letter) => letter.hasTranscription) ?? senderLetters[0]
}

function getSenderFromRouteParam (value: string | undefined): LetterSenderId {
  const normalizedValue = value?.toLowerCase()
  const matchedSender = senderOptions.find((sender) => sender.id === normalizedValue)
  return matchedSender?.id ?? defaultSenderId
}

function buildLettersPath (selection: Selection) {
  const baseSegments = ['/letters', selection.senderId]

  if (!selection.letterId) {
    return baseSegments.join('/')
  }

  if (!selection.pageId) {
    return [...baseSegments, selection.letterId].join('/')
  }

  return [...baseSegments, selection.letterId, selection.pageId].join('/')
}

function resolveSelection (selection: Selection) {
  const senderLetters = getLettersBySender(selection.senderId)
  const selectedLetter = senderLetters.find((letter) => letter.id === selection.letterId)
    ?? getDefaultLetterForSender(selection.senderId)
  const selectedPage = selectedLetter?.pages.find((page) => page.id === selection.pageId)
    ?? selectedLetter?.pages[0]

  return {
    senderLetters,
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
      badgeLabel: 'Awaiting image conversion',
      helperLabel: 'Awaiting image conversion',
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

function getStackPages (letter: Letter | undefined, selectedPageIndex: number, maxCards = 3) {
  if (!letter || selectedPageIndex < 0) {
    return []
  }

  return letter.pages.slice(selectedPageIndex, selectedPageIndex + maxCards)
}

function Letters () {
  const { senderId, letterId, pageId } = useParams<LettersRouteParams>()
  const location = useLocation()
  const navigate = useNavigate()
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const selection: Selection = {
    senderId: getSenderFromRouteParam(senderId),
    letterId: letterId ?? null,
    pageId: pageId ?? null,
  }

  const { senderLetters, selectedLetter, selectedPage } = resolveSelection(selection)

  const normalizedSelection: Selection = {
    senderId: selection.senderId,
    letterId: selectedLetter?.id ?? null,
    pageId: selectedPage?.id ?? null,
  }

  const canonicalPath = buildLettersPath(normalizedSelection)

  useEffect(() => {
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true, preventScrollReset: true })
    }
  }, [canonicalPath, location.pathname, navigate])

  const activeSender = senderOptions.find((sender) => sender.id === selection.senderId)
    ?? senderOptions[0]

  const yearGroups = Object.entries(
    senderLetters.reduce<Record<string, Letter[]>>((groups, letter) => {
      const year = letter.id.slice(0, 4)
      groups[year] ??= []
      groups[year].push(letter)
      return groups
    }, {}),
  )

  const senderLetterCounts = senderOptions.reduce<Record<LetterSenderId, number>>(
    (counts, sender) => {
      counts[sender.id] = getLettersBySender(sender.id).length
      return counts
    },
    {
      ollie: 0,
      martha: 0,
    },
  )

  if (!letters.length) {
    return (
      <section className="empty-state-shell">
        <wa-card className="empty-card" appearance="outlined">
          <div slot="header" className="card-header">
            <p className="eyebrow">Hoffstetter War Letters</p>
            <h2>No letters found</h2>
          </div>
          <wa-callout appearance="filled-outlined" variant="warning" size="small">
            Add PDFs or scanned pages to the letters directory to populate the archive.
          </wa-callout>
        </wa-card>
      </section>
    )
  }

  const selectedStatus = selectedLetter ? getLetterStatus(selectedLetter) : null
  const currentPage = selectedPage ?? selectedLetter?.pages[0]
  const selectedPageIndex = selectedLetter && currentPage
    ? selectedLetter.pages.findIndex((page) => page.id === currentPage.id)
    : -1
  const stackPages = getStackPages(selectedLetter, selectedPageIndex)
  const hasPreviousPage = selectedPageIndex > 0
  const hasNextPage = selectedLetter
    ? selectedPageIndex >= 0 && selectedPageIndex < selectedLetter.pages.length - 1
    : false

  const navigateToSelection = (nextSelection: Selection, mode: 'push' | 'replace') => {
    navigate(buildLettersPath(nextSelection), {
      replace: mode === 'replace',
      preventScrollReset: true,
    })
  }

  const selectSender = (nextSenderId: LetterSenderId) => {
    if (nextSenderId === selection.senderId) {
      return
    }

    const nextLetter = getDefaultLetterForSender(nextSenderId)
    navigateToSelection(
      {
        senderId: nextSenderId,
        letterId: nextLetter?.id ?? null,
        pageId: nextLetter?.pages[0]?.id ?? null,
      },
      'push',
    )
  }

  const selectLetter = (nextLetterId: string) => {
    const nextLetter = getLetterById(nextLetterId, selection.senderId)
    if (!nextLetter) {
      return
    }

    navigateToSelection(
      {
        senderId: selection.senderId,
        letterId: nextLetter.id,
        pageId: nextLetter.pages[0]?.id ?? null,
      },
      'push',
    )
  }

  const selectPage = (nextPageId: string) => {
    if (!selectedLetter) {
      return
    }

    navigateToSelection(
      {
        senderId: selection.senderId,
        letterId: selectedLetter.id,
        pageId: nextPageId,
      },
      'replace',
    )
  }

  const selectAdjacentPage = (offset: -1 | 1) => {
    if (!selectedLetter || selectedPageIndex < 0) {
      return
    }

    const nextIndex = selectedPageIndex + offset
    if (nextIndex < 0 || nextIndex >= selectedLetter.pages.length) {
      return
    }

    selectPage(selectedLetter.pages[nextIndex].id)
  }

  return (
    <section className="letters-page">
      <section className="hero-stats" aria-label="Archive summary">
        <wa-card className="stat-card" appearance="plain">
          <p className="stat-value">{totalLetters}</p>
          <p className="stat-label">catalogued letters</p>
        </wa-card>
        <wa-card className="stat-card" appearance="plain">
          <p className="stat-value">{yearGroups.length}</p>
          <p className="stat-label">years spanned</p>
        </wa-card>
        <wa-card className="stat-card" appearance="plain">
          <p className="stat-value">{transcribedLetters}</p>
          <p className="stat-label">letters with transcripts</p>
        </wa-card>
      </section>

      <wa-divider className="section-divider" />

      <section className={`content-grid${isTimelineCollapsed ? ' content-grid--timeline-collapsed' : ''}`}>
        <aside
          aria-label="Letter timeline"
          className={`timeline-column${isTimelineCollapsed ? ' timeline-column--collapsed' : ''}`}
        >
          <div className="timeline-toggle-rail">
            <wa-button
              appearance="plain"
              aria-expanded={!isTimelineCollapsed}
              aria-label={isTimelineCollapsed ? 'Expand letters by date panel' : 'Collapse letters by date panel'}
              className="timeline-collapse-button"
              onClick={() => setIsTimelineCollapsed((current) => !current)}
              size="small"
              variant="neutral"
            >
              {isTimelineCollapsed ? '>' : '<'}
            </wa-button>
          </div>

          {!isTimelineCollapsed ? (
            <>
              <div className="timeline-header">
                <h2>Letters by date</h2>
                <div className="sender-toggle" aria-label="View letters by sender" role="tablist">
                  {senderOptions.map((sender) => {
                    const isActive = sender.id === selection.senderId
                    const count = senderLetterCounts[sender.id]

                    return (
                      <wa-button
                        appearance={isActive ? 'filled-outlined' : 'plain'}
                        className="sender-toggle__button"
                        data-selected={isActive ? 'true' : 'false'}
                        onClick={() => selectSender(sender.id)}
                        size="small"
                        variant="neutral"
                      >
                        {sender.label} ({count})
                      </wa-button>
                    )
                  })}
                </div>
                <p className="timeline-copy">
                  Showing letters from {activeSender.label}. Each entry updates the route path.
                </p>
              </div>

              <div className="timeline-scroll">
                {yearGroups.length ? (
                  yearGroups.map(([year, group]) => (
                    <section className="timeline-year" key={year}>
                      <div className="timeline-year__label">{year}</div>
                      <ol className="timeline-list">
                        {group.map((letter) => {
                          const isSelected = letter.id === selectedLetter?.id
                          const status = getLetterStatus(letter)

                          return (
                            <li key={`${letter.sender}-${letter.id}`}>
                              <wa-button
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
                              </wa-button>
                            </li>
                          )
                        })}
                      </ol>
                    </section>
                  ))
                ) : (
                  <div className="timeline-empty">
                    No letters from {activeSender.label} have been added yet.
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="timeline-column__collapsed-label" aria-hidden>
              Letters
            </p>
          )}
        </aside>

        <section className="reader-column" aria-live="polite">
          <section className="mobile-letter-menu" aria-label="Letter menu">
            <wa-card className="mobile-letter-menu__card" appearance="outlined">
              <div className="mobile-letter-menu__header">
                <div>
                  <h2 className="mobile-letter-menu__title">Choose a letter</h2>
                </div>
                <div className="sender-toggle mobile-sender-toggle" aria-label="View letters by sender" role="tablist">
                  {senderOptions.map((sender) => {
                    const isActive = sender.id === selection.senderId
                    const count = senderLetterCounts[sender.id]

                    return (
                      <wa-button
                        appearance={isActive ? 'filled-outlined' : 'plain'}
                        className="sender-toggle__button"
                        data-selected={isActive ? 'true' : 'false'}
                        onClick={() => selectSender(sender.id)}
                        size="small"
                        variant="neutral"
                      >
                        {sender.label} ({count})
                      </wa-button>
                    )
                  })}
                </div>
              </div>

              {selectedLetter ? (
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
                            <option key={`${letter.sender}-${letter.id}`} value={letter.id}>
                              {letter.dateLabel} - {status.helperLabel}
                            </option>
                          )
                        })}
                      </optgroup>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="mobile-letter-menu__summary">
                  No letters from {activeSender.label} are available yet.
                </p>
              )}
            </wa-card>
          </section>

          <wa-card className="reader-card" appearance="outlined">
            <div slot="header" className="reader-header">
              <div>
                <h2>{selectedLetter ? selectedLetter.dateLabel : `${activeSender.label} letters`}</h2>
              </div>
              <div className="reader-header__actions">
                {selectedStatus ? (
                  <wa-badge
                    appearance="outlined"
                    className="status-badge"
                    pill
                    variant={selectedStatus.variant}
                  >
                    {selectedStatus.badgeLabel}
                  </wa-badge>
                ) : null}
                {selectedLetter?.pdfSrc ? (
                  <wa-button
                    appearance="plain"
                    className="pdf-button"
                    pill
                    href={selectedLetter?.pdfSrc}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open PDF
                  </wa-button>
                ) : null}
              </div>
            </div>

            {selectedLetter && selectedLetter.transcribedPageCount < selectedLetter.pageCount ? (
              <wa-callout appearance="filled-outlined" size="small" variant="warning">
                {selectedLetter.transcribedPageCount
                  ? 'Some pages are transcribed, but this letter is not yet complete.'
                  : 'This letter has been catalogued, but a transcription has not been added yet.'}
              </wa-callout>
            ) : null}

            {selectedLetter?.pageCount ? (
              <div className="page-layout">
                <section className="reader-pane">
                  <p className="section-label">Original scan</p>
                  {currentPage ? (
                    <>
                      <figure className="scan-frame scan-frame--stack">
                        <div className="scan-stack__deck" aria-live="polite">
                          {stackPages.map((page, index) => (
                            <div
                              className="scan-stack__card"
                              data-depth={index}
                              key={`stack-${page.id}`}
                            >
                              {page.imageSrc ? (
                                <>
                                  {index === 0 && (
                                    <>
                                      <wa-dialog
                                        className="scan-image-dialog"
                                        label='Expanded view of letter page'
                                        open={isDialogOpen}
                                        without-header
                                        light-dismiss
                                        onwa-after-hide={() => setIsDialogOpen(false)}
                                        style={{ "--width": 'min(96svw, 40rem)', "--spacing": "8px" }}
                                      >
                                        <img
                                          alt={`${formatPageLabel(page)} from ${selectedLetter.dateLabel}`}
                                          className="scan-image"
                                          src={page.imageSrc}
                                        />
                                      </wa-dialog>
                                      <wa-button
                                        appearance="plain"
                                        className="scan-stack__expand-button"
                                        onClick={() => setIsDialogOpen(true)}
                                        size="small"
                                        variant="neutral"
                                        isIconButton={true}
                                        pill
                                      >
                                        <wa-icon name="magnifying-glass" />
                                      </wa-button>
                                    </>
                                  )}
                                  <img
                                    alt={`${formatPageLabel(page)} from ${selectedLetter.dateLabel}`}
                                    className="scan-image"
                                    loading="lazy"
                                    src={page.imageSrc}
                                  />
                                </>
                              ) : (
                                <div className="empty-pane">
                                  No scan image has been uploaded for this page.
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </figure>

                      <div className="scan-pager" aria-label="Page navigation">
                        <wa-button
                          appearance="plain"
                          className="scan-pager__button"
                          disabled={!hasPreviousPage}
                          onClick={() => selectAdjacentPage(-1)}
                          size="small"
                          variant="neutral"
                        >
                          &lt;
                        </wa-button>
                        <span className="scan-pager__status">
                          {selectedPageIndex + 1}/{selectedLetter.pageCount}
                        </span>
                        <wa-button
                          appearance="plain"
                          className="scan-pager__button"
                          disabled={!hasNextPage}
                          onClick={() => selectAdjacentPage(1)}
                          size="small"
                          variant="neutral"
                        >
                          &gt;
                        </wa-button>
                      </div>
                    </>
                  ) : (
                    <div className="empty-pane">No scan image has been uploaded for this page.</div>
                  )}
                </section>

                <section className="reader-pane">
                  <p className="section-label">Transcription</p>
                  {currentPage?.transcription ? (
                    <article className="transcription-frame">
                      <p className="transcription-text">{currentPage.transcription}</p>
                    </article>
                  ) : (
                    <div className="empty-pane">Transcription pending.</div>
                  )}
                </section>
              </div>
            ) : selectedLetter ? (
              <div className="empty-pane empty-pane--letter">
                This letter is listed in the archive, but no page images have been created yet.
              </div>
            ) : (
              <div className="empty-pane empty-pane--letter">
                No letters from {activeSender.label} have been added yet.
              </div>
            )}
          </wa-card>
        </section>
      </section>
    </section>
  )
}

export default Letters
