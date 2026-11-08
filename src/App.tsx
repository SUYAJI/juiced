import { useEffect, useState } from 'react'
import ExperienceApp from './ExperienceApp'
import FlatApp from './FlatApp'

/**
 * `#flat`      the game alone (2D, for testing)
 * `#handheld`  straight to the handheld in hand (skips the lunchbox)
 * anything else: the full experience, starting with the closed lunchbox
 */
export default function App() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    document.body.dataset.view = hash === '#flat' ? 'flat' : 'handheld'
  }, [hash])
  if (hash === '#flat') return <FlatApp key="flat" />
  return <ExperienceApp key={hash === '#handheld' ? 'in-hand' : 'intro'} startInHand={hash === '#handheld'} />
}
