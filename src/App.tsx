import { useEffect, useState } from 'react'
import FlatApp from './FlatApp'
import HandheldApp from './HandheldApp'

/** `#flat` runs the game alone (2D, for testing); anything else is the 3D handheld. */
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
  return hash === '#flat' ? <FlatApp key="flat" /> : <HandheldApp key="handheld" />
}
