import * as THREE from 'three'

/** Draw into an offscreen canvas and wrap it as an sRGB texture. */
export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { linear?: boolean } = {},
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif'
const ROUND = '"Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif'

export const WORD_COLORS = ['#f28c38', '#f2c14e', '#9fd65a', '#5fc9d9', '#ef7aa8', '#b48cf0']

/** The wordmark under the screen, where the console's own logo would be. */
export function wordmarkTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 192, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.textBaseline = 'middle'
    ctx.font = `900 118px ${ROUND}`
    const word = 'JUICED'
    const widths = [...word].map((ch) => ctx.measureText(ch).width)
    const gap = 6
    const total = widths.reduce((a, b) => a + b, 0) + gap * (word.length - 1)
    let x = (w - total) / 2
    ;[...word].forEach((ch, i) => {
      ctx.fillStyle = WORD_COLORS[i % WORD_COLORS.length]
      ctx.fillText(ch, x, h / 2 + 4)
      x += widths[i] + gap
    })
  })
}

/** Small embossed brand oval above the buttons. */
export function brandOvalTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 192, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.42)'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, w / 2 - 14, h / 2 - 14, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(w / 2 + 2, h / 2 + 3, w / 2 - 14, h / 2 - 14, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.font = `800 78px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('JUICED', w / 2, h / 2 + 4)
  })
}

/** "POWER" label and the three fading arcs beside the LED. */
export function powerLabelTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#c9c4d8'
    ctx.font = `700 34px ${SANS}`
    ctx.textAlign = 'center'
    ctx.fillText('POWER', w / 2, h - 18)
    ctx.strokeStyle = '#c9c4d8'
    ctx.lineWidth = 7
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 1 - i * 0.3
      ctx.beginPath()
      ctx.arc(70, 40, 22 + i * 18, -0.65, 0.65)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  })
}

/** Letter on an A/B button top. */
export function buttonLetterTexture(letter: string): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.font = `700 64px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(letter, w / 2, h / 2 + 4)
  })
}

/** Regulatory-style plate on the back, rewritten for JUICED. */
export function backLabelTexture(): THREE.CanvasTexture {
  return canvasTexture(1000, 410, (ctx, w, h) => {
    ctx.fillStyle = '#26212f'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#4a4458'
    ctx.lineWidth = 3
    ctx.strokeRect(6, 6, w - 12, h - 12)

    ctx.fillStyle = '#d9d3e6'
    ctx.font = `900 54px ${ROUND}`
    ctx.fillText('JUICED', 40, 72)
    ctx.font = `600 26px ${SANS}`
    ctx.fillText('HANDHELD', 268, 72)
    ctx.font = `700 24px ${SANS}`
    ctx.fillText('MODEL NO.', 560, 72)
    ctx.font = `800 30px ${SANS}`
    ctx.fillText('JCD-001', 700, 72)

    ctx.font = `500 21px ${SANS}`
    ctx.fillStyle = '#bdb6cc'
    ctx.fillText('RATING : DC3V 0.6W', 40, 118)
    ctx.fillText('BATTERY : LR6 (AA) x2', 40, 148)
    ctx.fillText('© 2026 SKY FUZELL CASEY', 420, 118)
    ctx.fillText('FOUR PITCHES. EIGHT STEPS. THREE FRUIT.', 420, 148)

    ctx.font = `500 15px ${SANS}`
    const lines = [
      'THIS DEVICE RUNS ON MUSIC. OPERATION IS SUBJECT TO THE FOLLOWING TWO CONDITIONS : (1) THIS',
      'DEVICE MAY CAUSE HUMMING, AND (2) THIS DEVICE MUST ACCEPT ANY MELODY RECEIVED, INCLUDING',
      'MELODIES THAT DO NOT REACH ALL THREE FRUIT. ORIGINAL HARDWARE PRESERVED SINCE 1998.',
      'STICKERS APPLIED CIRCA 1999 AND NOT TO BE REMOVED. KEEP AWAY FROM ACTUAL JUICE.',
    ]
    lines.forEach((l, i) => ctx.fillText(l, 40, 196 + i * 22))

    ctx.font = `600 20px ${SANS}`
    ctx.fillStyle = '#d9d3e6'
    ctx.fillText('MADE IN A LUNCH BOX', 40, 320)
    ctx.fillText('C/JCD-SEA-1', 330, 320)
    ctx.fillStyle = '#9b93ad'
    ctx.fillText('SERIAL  CG504528192', 560, 320)

    // Small circled mark and model badge, like the originals' marks
    ctx.strokeStyle = '#bdb6cc'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(w - 120, 300, 22, 0, Math.PI * 2)
    ctx.stroke()
    ctx.font = `800 26px ${SANS}`
    ctx.textAlign = 'center'
    ctx.fillStyle = '#d9d3e6'
    ctx.fillText('J', w - 120, 309)
    ctx.strokeRect(w - 76, 48, 46, 36)
    ctx.font = `800 22px ${SANS}`
    ctx.fillText('V', w - 53, 74)
  })
}

/** Barcode sticker with a worn, slightly yellowed look. */
export function barcodeTexture(): THREE.CanvasTexture {
  return canvasTexture(660, 230, (ctx, w, h) => {
    ctx.fillStyle = '#e8e0cc'
    ctx.fillRect(0, 0, w, h)
    // smudges
    ctx.fillStyle = 'rgba(120,100,70,0.12)'
    ctx.beginPath()
    ctx.ellipse(120, 40, 90, 24, 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(560, 190, 70, 20, -0.3, 0, Math.PI * 2)
    ctx.fill()
    // bars (deterministic pseudo-random widths)
    let x = 40
    let seed = 7
    ctx.fillStyle = '#1b1820'
    while (x < w - 40) {
      seed = (seed * 9301 + 49297) % 233280
      const bw = 3 + Math.floor((seed / 233280) * 9)
      seed = (seed * 9301 + 49297) % 233280
      const gap = 3 + Math.floor((seed / 233280) * 7)
      ctx.fillRect(x, 28, bw, 128)
      x += bw + gap
    }
    ctx.font = `600 30px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.fillText('JCD 2026 0001 SEA', w / 2, 200)
  })
}

/** Cartridge label: yellow, in the spirit of a classic cart but all JUICED. */
export function cartLabelTexture(): THREE.CanvasTexture {
  return canvasTexture(1100, 400, (ctx, w, h) => {
    ctx.fillStyle = '#f3c845'
    ctx.fillRect(0, 0, w, h)
    // worn corner and edge scuffs
    ctx.fillStyle = 'rgba(120,90,30,0.18)'
    ctx.fillRect(0, h - 14, w, 14)
    ctx.beginPath()
    ctx.ellipse(w - 60, 40, 80, 30, 0.3, 0, Math.PI * 2)
    ctx.fill()

    // rating box
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(40, 80, 70, 96)
    ctx.strokeStyle = '#2a1f44'
    ctx.lineWidth = 5
    ctx.strokeRect(40, 80, 70, 96)
    ctx.fillStyle = '#2a1f44'
    ctx.font = `900 64px ${SANS}`
    ctx.textAlign = 'center'
    ctx.fillText('F', 75, 150)
    ctx.font = `700 14px ${SANS}`
    ctx.fillText('FRUITY', 75, 170)

    // title
    ctx.font = `900 170px ${ROUND}`
    ctx.fillStyle = '#7a2d1b'
    ctx.fillText('JUICED', w / 2 + 34, 236)
    ctx.fillStyle = '#ef5a3c'
    ctx.fillText('JUICED', w / 2 + 24, 226)
    ctx.lineWidth = 6
    ctx.strokeStyle = '#2a1f44'
    ctx.strokeText('JUICED', w / 2 + 24, 226)
    ctx.fillStyle = '#2a1f44'
    ctx.font = `800 34px ${SANS}`
    ctx.fillText('A MUSICAL FRUIT MACHINE', w / 2 + 24, 290)

    // round seal at right
    ctx.beginPath()
    ctx.arc(w - 90, 230, 44, 0, Math.PI * 2)
    ctx.fillStyle = '#fff1cf'
    ctx.fill()
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.fillStyle = '#2a1f44'
    ctx.font = `800 18px ${SANS}`
    ctx.fillText('100', w - 90, 226)
    ctx.fillText('BPM', w - 90, 248)

    ctx.textAlign = 'right'
    ctx.font = `700 26px ${SANS}`
    ctx.fillText('JCD-SKY-USA', w - 40, 350)
  })
}

/** Battery wrap: blue label with silver ends. u runs around, v along the length. */
export function batteryTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#2d4ed8'
    ctx.fillRect(0, 0, w, h)
    const silver = ctx.createLinearGradient(0, 0, w, 0)
    silver.addColorStop(0, '#b9bcc4')
    silver.addColorStop(0.5, '#f0f1f4')
    silver.addColorStop(1, '#b9bcc4')
    ctx.fillStyle = silver
    ctx.fillRect(0, 0, w, 150)
    ctx.fillRect(0, h - 70, w, 70)
    // a lighter blue sweep and two white streaks
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(0, 150, w, 60)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(60, 900)
    ctx.lineTo(180, 600)
    ctx.stroke()
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(100, 900)
    ctx.lineTo(220, 600)
    ctx.stroke()
    // text along the length
    ctx.save()
    ctx.translate(w / 2, h / 2 + 40)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = '#ffffff'
    ctx.font = `900 92px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ULTRA ALKALINE', 0, -60)
    ctx.font = `700 46px ${SANS}`
    ctx.fillText('AA  LR6  1.5V', 0, 30)
    ctx.restore()
  })
}

/**
 * Wear map for the shell: mostly even roughness with scratches and scuffs.
 * Used as a roughness map, so values are greyscale and linear.
 */
export function wearTexture(): THREE.CanvasTexture {
  const t = canvasTexture(
    1024,
    1024,
    (ctx, w, h) => {
      ctx.fillStyle = '#8c8c8c'
      ctx.fillRect(0, 0, w, h)
      // fine grain
      const img = ctx.getImageData(0, 0, w, h)
      let seed = 1234
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const n = ((seed >> 8) & 0xff) / 255
        const v = 140 + (n - 0.5) * 36
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      }
      ctx.putImageData(img, 0, 0)
      // scuffed patches (rougher)
      for (let i = 0; i < 26; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const x = (seed % 1000) / 1000
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const y = (seed % 1000) / 1000
        const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, 40 + (seed % 90))
        g.addColorStop(0, 'rgba(200,200,200,0.35)')
        g.addColorStop(1, 'rgba(200,200,200,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
      // hairline scratches (shinier)
      ctx.strokeStyle = 'rgba(70,70,70,0.6)'
      for (let i = 0; i < 70; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const x = (seed % 1000) / 1000
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const y = (seed % 1000) / 1000
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const a = ((seed % 1000) / 1000) * Math.PI
        const len = 20 + (seed % 120)
        ctx.lineWidth = 1 + (seed % 2)
        ctx.beginPath()
        ctx.moveTo(x * w, y * h)
        ctx.lineTo(x * w + Math.cos(a) * len, y * h + Math.sin(a) * len)
        ctx.stroke()
      }
    },
    { linear: true },
  )
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.18, 0.18)
  return t
}

/** Little "RUMBLE"-style text for the top nub of the cartridge. */
export function cartNubTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.font = `800 96px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('JUICED', w / 2, h / 2 + 4)
  })
}
