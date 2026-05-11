import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

type LayoutProps = {
  children: ReactNode
}

const views = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'letters', label: 'Letters', path: '/letters' },
  { id: 'photos', label: 'Photos', path: '/photos' },
] as const

function getActiveViewId (pathname: string) {
  if (pathname.startsWith('/letters')) {
    return 'letters'
  }

  if (pathname.startsWith('/photos')) {
    return 'photos'
  }

  return 'home'
}

function Layout ({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeView = getActiveViewId(location.pathname)

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">World War II Correspondance Archive</p>
          <h1>Hoffstetter War Letters</h1>
          <p className="lede">
            A chronological archive of letters exchanged between Ollie Hoffstetter and Martha Darrough
            during World War II, with scans and page-by-page transcriptions presented side by side.
          </p>
        </div>

        <nav className="view-nav" aria-label="Archive sections">
          {views.map((view) => {
            const isActive = view.id === activeView

            return (
              <wa-button
                appearance={isActive ? 'filled-outlined' : 'plain'}
                className="view-nav__button"
                data-selected={isActive ? 'true' : 'false'}
                key={view.id}
                onClick={() => navigate(view.path, { preventScrollReset: true })}
                size="small"
                variant="neutral"
              >
                {view.label}
              </wa-button>
            )
          })}
        </nav>
      </section>

      <wa-divider className="section-divider" />

      {children}
    </main>
  )
}

export default Layout
