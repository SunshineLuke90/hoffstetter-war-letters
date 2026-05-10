import { type ReactNode } from 'react'
import { WaButton, WaDivider } from '@awesome.me/webawesome/dist/react'

type LayoutProps = {
  activeView: string
  onNavigate: (viewId: string) => void
  views: Array<{
    id: string
    label: string
  }>
  children: ReactNode
}

function Layout ({ activeView, onNavigate, views, children }: LayoutProps) {
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
              <WaButton
                appearance={isActive ? 'filled-outlined' : 'plain'}
                className="view-nav__button"
                data-selected={isActive ? 'true' : 'false'}
                key={view.id}
                onClick={() => onNavigate(view.id)}
                size="small"
                variant="neutral"
              >
                {view.label}
              </WaButton>
            )
          })}
        </nav>
      </section>

      <WaDivider className="section-divider" />

      {children}
    </main>
  )
}

export default Layout
