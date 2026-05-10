import { WaCard } from '@awesome.me/webawesome/dist/react'

function Photos () {
  return (
    <section className="placeholder-panel">
      <WaCard className="placeholder-card" appearance="outlined">
        <div slot="header" className="card-header">
          <p className="eyebrow">Photo Gallery</p>
          <h2>Gallery view coming soon</h2>
        </div>
        <p className="placeholder-copy">
          This page is reserved for a visual photo gallery with larger previews, grouping, and date-based browsing.
        </p>
      </WaCard>
    </section>
  )
}

export default Photos
