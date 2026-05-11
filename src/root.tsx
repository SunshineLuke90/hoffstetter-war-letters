import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'
import type { ReactNode } from 'react'
import AppLayout from './assets/Layout'
import WebAwesomeElementsClient from './webawesome-elements-client'
import '@awesome.me/webawesome/dist/styles/webawesome.css'
import './index.css'
import './App.css'

export function Layout ({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <WebAwesomeElementsClient />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function Root () {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

export function ErrorBoundary ({ error }: { error: unknown }) {
  let message = 'Error'
  let details = 'An unexpected error occurred.'

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details = error.status === 404 ? 'The requested page could not be found.' : error.statusText
  } else if (error instanceof Error) {
    details = error.message
  }

  return (
    <AppLayout>
      <section className="placeholder-panel" aria-live="polite">
        <wa-card className="placeholder-card" appearance="outlined">
          <h2>{message}</h2>
          <p>{details}</p>
        </wa-card>
      </section>
    </AppLayout>
  )
}
