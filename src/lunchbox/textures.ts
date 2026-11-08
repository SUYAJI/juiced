import * as THREE from 'three'

/**
 * Tiling normal map for ripstop nylon: a fine plain weave with the
 * slightly raised ripstop grid every 5 mm. One tile = 4 x 4 cm.
 */
export function fabricNormalTexture(): THREE.DataTexture {
  const S = 512
  const hgt = new Float32Array(S * S)
  const period = 8 // weave threads, px (128 px per cm)
  const grid = 64 // ripstop, every 0.5 cm
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const wx = 0.5 + 0.5 * Math.sin((2 * Math.PI * x) / period)
      const wy = 0.5 + 0.5 * Math.sin((2 * Math.PI * y) / period)
      const over = (Math.floor(x / period) + Math.floor(y / period)) % 2 === 0
      const weave = over ? wx * (0.6 + 0.4 * wy) : wy * (0.6 + 0.4 * wx)
      const dx = Math.min(x % grid, grid - (x % grid))
      const dy = Math.min(y % grid, grid - (y % grid))
      const rip = Math.exp(-((dx / 1.7) ** 2)) + Math.exp(-((dy / 1.7) ** 2))
      hgt[y * S + x] = 0.5 * weave + 0.32 * Math.min(1, rip)
    }
  }
  const data = new Uint8Array(S * S * 4)
  const strength = 1.6
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const l = hgt[y * S + ((x - 1 + S) % S)]
      const r = hgt[y * S + ((x + 1) % S)]
      const u = hgt[((y - 1 + S) % S) * S + x]
      const d = hgt[((y + 1) % S) * S + x]
      let nx = (l - r) * strength
      let ny = (d - u) * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const i = (y * S + x) * 4
      data[i] = (nx * 0.5 + 0.5) * 255
      data[i + 1] = (ny * 0.5 + 0.5) * 255
      data[i + 2] = (nz * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

/** Zipper tape with interlocking teeth. u repeats every tooth pair. */
export function zipperTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#141317'
  ctx.fillRect(0, 0, 64, 64)
  // tape weave
  ctx.fillStyle = 'rgba(255,255,255,0.035)'
  for (let y = 0; y < 64; y += 3) ctx.fillRect(0, y, 64, 1)
  // teeth: upper row on the left half, lower row on the right half
  const tooth = (x: number, y: number, h: number) => {
    ctx.fillStyle = '#2c2b31'
    ctx.fillRect(x, y, 26, h)
    ctx.fillStyle = '#45444c'
    ctx.fillRect(x + 2, y + 2, 22, 3)
    ctx.fillStyle = '#0c0b0e'
    ctx.fillRect(x, y + h - 2, 26, 2)
  }
  tooth(3, 18, 17)
  tooth(35, 29, 17)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
