import {
  Suspense,
  lazy,
  startTransition,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import '@awesome.me/webawesome/dist/styles/webawesome.css';
import { WaCard } from '@awesome.me/webawesome/dist/react'
import Layout from './assets/Layout'
import './App.css'

type ViewId = 'home' | 'letters' | 'photos'

const viewCatalog: Record<ViewId, {
  label: string
  component: LazyExoticComponent<ComponentType>
}> = {
  home: {
    label: 'Home',
    component: lazy(async () => import('./pages/Homepage')),
  },
  letters: {
    label: 'Letters',
    component: lazy(async () => import('./pages/Letters')),
  },
  photos: {
    label: 'Photos',
    component: lazy(async () => import('./pages/Photos')),
  },
}

const viewOrder: ViewId[] = ['home', 'letters', 'photos']

function getViewFromUrlParam (value: string | null): ViewId {
  const normalizedValue = value?.toLowerCase()
  if (normalizedValue === 'home' || normalizedValue === 'letters' || normalizedValue === 'photos') {
    return normalizedValue
  }

  return 'home'
}

function readViewFromUrl (): ViewId {
  const params = new URLSearchParams(window.location.search)
  return getViewFromUrlParam(params.get('view'))
}

function syncViewToUrl (viewId: ViewId, mode: 'push' | 'replace') {
  const url = new URL(window.location.href)
  url.searchParams.set('view', viewId)
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url)
}

function App () {
  const [activeView, setActiveView] = useState<ViewId>(() => readViewFromUrl())

  useEffect(() => {
    const handlePopState = () => {
      startTransition(() => {
        setActiveView(readViewFromUrl())
      })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    syncViewToUrl(activeView, 'replace')
  }, [activeView])

  const selectView = (viewId: ViewId) => {
    if (viewId === activeView) {
      return
    }

    syncViewToUrl(viewId, 'push')
    startTransition(() => {
      setActiveView(viewId)
    })
  }
  const ActivePageComponent = viewCatalog[activeView].component

  return (
    <Layout
      activeView={activeView}
      onNavigate={(viewId) => selectView(getViewFromUrlParam(viewId))}
      views={viewOrder.map((viewId) => ({
        id: viewId,
        label: viewCatalog[viewId].label,
      }))}
    >
      <Suspense
        fallback={(
          <section className="placeholder-panel" aria-live="polite">
            <WaCard className="placeholder-card" appearance="outlined">
              <h2>Loading view...</h2>
              <p>Please wait while this section is loaded.</p>
            </WaCard>
          </section>
        )}
      >
        <ActivePageComponent />
      </Suspense>
    </Layout>
  )
}

export default App
