import { useState } from 'react'
import { photos } from '../photoData'

function Photos () {
  const [flippedById, setFlippedById] = useState<Record<string, boolean>>({})

  const togglePhotoFlip = (photoId: string) => {
    setFlippedById((current) => ({
      ...current,
      [photoId]: !current[photoId],
    }))
  }

  return (
    <section className="photos-panel">
      {photos.map((photo) => {
        const hasBack = Boolean(photo.backSrc)
        const isFlipped = hasBack ? Boolean(flippedById[photo.id]) : false

        return (
          <article className="photo-card" data-flipped={isFlipped ? 'true' : 'false'} key={photo.id}>
            <div className="photo-card__media-wrap">
              <div className="photo-card__media-flipper">
                <div className="photo-card__media-face photo-card__media-face--front">
                  <img src={photo.frontSrc} alt={photo.accessible} />
                </div>
                {hasBack ? (
                  <div className="photo-card__media-face photo-card__media-face--back">
                    <img src={photo.backSrc} alt={`${photo.accessible} (back)`} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="photo-card__content">
              <p className="photo-card__description">{photo.subject}</p>
              <time className="photo-card__date">{photo.date}</time>
            </div>

            {hasBack ? (
              <wa-button
                variant="neutral"
                appearance="filled-outlined"
                size="small"
                pill
                className="photo-card__flip-button sender-toggle__button"
                onClick={() => togglePhotoFlip(photo.id)}

              >
                <wa-icon name="arrow-right-arrow-left" style={{ "color": "var(--wa-color-text-normal)" }} />
              </wa-button>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}

export default Photos
