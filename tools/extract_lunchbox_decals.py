# Cuts the handwriting and drawings out of the lunchbox photos.
# Each region is perspective-rectified, then the yellow fabric is keyed out:
# brightness is corrected to the 3D fabric colour and a feathered ink mask
# keeps the original marker pixels. Run from the project root:
#   python3 tools/extract_lunchbox_decals.py
import cv2, numpy as np
P2 = cv2.imread('assets-src/lunchbox/photos/lunchbox-my-mom-end.jpg')
P3 = cv2.imread('assets-src/lunchbox/photos/lunchbox-this-is-me-end.jpg')
P4 = cv2.imread('assets-src/lunchbox/photos/lunchbox-front-skyler.jpg')
S = 4/3
REF = np.array([16, 150, 214], np.float32)  # BGR of the 3D fabric albedo (#d69610)

def quad(img, pts, w, h):
    src = np.float32([[x*S, y*S] for x, y in pts]); dst = np.float32([[0,0],[w,0],[w,h],[0,h]])
    return cv2.warpPerspective(img, cv2.getPerspectiveTransform(src, dst), (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

def decal(img, t=24, grow=4, feather=9, k=61, keep_bright=None, erase=(), gain=1.0, white_b=40):
    f = img.astype(np.float32)
    bg = np.dstack([cv2.medianBlur(img[:,:,c], k) for c in range(3)]).astype(np.float32)
    B,G,R = [f[:,:,i] for i in range(3)]; bB,bG,bR = [bg[:,:,i] for i in range(3)]
    dark = np.maximum(bR-R, bG-G)                 # most inks darken red/green
    blue = (B-bB) - 0.5*np.maximum(R-bR, 0)       # purple/blue/white raise blue
    m = np.maximum(dark, blue*1.2)
    mask = (m > t).astype(np.uint8)
    # whites (eyes, teeth) only inside given boxes
    if keep_bright:
        lum = f.mean(2); blum = bg.mean(2)
        white = ((lum - blum) > 35) & ((B - bB) > white_b)
        wm = np.zeros_like(mask)
        for (x0,y0,x1,y1) in keep_bright: wm[y0:y1, x0:x1] = 1
        mask |= (white & (wm > 0)).astype(np.uint8)
    # specular glints on marker are brighter than the fabric itself: drop
    # them (except inside keep_bright boxes, where whites are drawn)
    lumv = f.mean(2); blumv = bg.mean(2)
    glint = (lumv > blumv + 18).astype(np.uint8)
    if keep_bright:
        for (x0,y0,x1,y1) in keep_bright: glint[y0:y1, x0:x1] = glint[y0:y1, x0:x1] & ((B[y0:y1, x0:x1] - bB[y0:y1, x0:x1]) < 40)
    mask[glint > 0] = 0
    for poly in erase:
        cv2.fillPoly(mask, [np.int32(poly)], 0)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2,2), np.uint8))
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*grow+1, 2*grow+1)))
    a = cv2.GaussianBlur(mask.astype(np.float32), (2*feather+1, 2*feather+1), 0)
    a = np.clip(a*1.6, 0, 1)
    # brightness-only correction keeps marker hues; fabric pixels are then
    # pulled toward the 3D fabric colour so feathered edges don't halo
    lum = lambda x: 0.114*x[...,0] + 0.587*x[...,1] + 0.299*x[...,2]
    s = (lum(REF[None,None,:]) / np.maximum(lum(bg), 1))[..., None] * gain
    ink = np.clip(m / 55.0, 0, 1)[..., None]
    col = f * s + (REF - bg * s) * (1 - ink)
    col = np.clip(col, 0, 255)
    hsv = cv2.cvtColor(col.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * (1 + 0.4 * ink[..., 0]), 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * (1 + 0.18 * ink[..., 0]), 0, 255)
    col = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    return np.dstack([col, a*255]).astype(np.uint8)

out = {}
r = quad(P2, [(487,612),(512,262),(722,262),(700,600)], 900, 720)
out['back-skys-lunch-box'] = decal(r, t=26, erase=[[(780,560),(900,560),(900,720),(780,720)]])
r = quad(P2, [(150,590),(520,600),(510,850),(140,830)], 900, 600)
out['end-my-mom-97'] = decal(r, t=26, keep_bright=[(60,150,560,560)],
    erase=[[(0,0),(900,0),(900,95),(0,95)], [(560,0),(900,0),(900,190),(560,110)], [(0,470),(120,470),(120,600),(0,600)], [(860,0),(900,0),(900,600),(860,600)]])
r = quad(P3, [(170,480),(620,480),(620,650),(170,650)], 1000, 380)
out['end-this-is-me'] = decal(r, t=14, grow=6, feather=11, k=81, keep_bright=[(700,60,1000,340)])
for k, v in out.items():
    cv2.imwrite(f'assets-src/lunchbox/decals/{k}.png', v)
print('ok')

# Front of the upper section: SKYLER with the blue splat flowers, red/white
# dots and black squiggles, from the top of the dome down to the zipper.
r = quad(P4, [(0,300),(800,296),(792,652),(0,688)], 1600, 540)
cv2.imwrite('assets-src/lunchbox/decals/front-skyler.png',
            decal(r, t=26, grow=3, feather=5, k=61, keep_bright=[(0,120,1600,540)], white_b=85,
                  erase=[[(0,0),(1600,0),(1600,22),(0,22)],               # dome edge
                         [(0,0),(600,0),(600,135),(0,165)],               # glare and handle base, left
                         [(1040,0),(1600,0),(1600,175),(1040,140)],       # handle webbing, right
                         [(1480,440),(1600,420),(1600,540),(1460,540)]])) # glare, bottom right
