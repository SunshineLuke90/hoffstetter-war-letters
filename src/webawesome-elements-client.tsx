import { useEffect } from 'react'

function WebAwesomeElementsClient () {
  useEffect(() => {
    void import('./webawesome-elements')
  }, [])

  return null
}

export default WebAwesomeElementsClient
