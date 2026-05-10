import { WaCard } from '@awesome.me/webawesome/dist/react'

function Homepage () {
  return (
    <section className="placeholder-panel">
      <WaCard className="placeholder-card" appearance="outlined">
        <div slot="header" className="card-header">
          <p className="eyebrow">Homepage</p>
          <h2>Welcome to the archive</h2>
        </div>
        <p className="placeholder-copy">
          This homepage will introduce the collection and highlight featured letters, historical context,
          and navigation paths for new visitors.
        </p>
      </WaCard>
    </section>
  )
}

export default Homepage
