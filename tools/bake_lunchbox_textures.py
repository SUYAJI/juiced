# Bakes the lunchbox panel colour maps: mustard fabric with low-frequency
# mottling, a faint ripstop grid, age grime, and the handwriting decals cut
# from the photos (tools/extract_lunchbox_decals.py) placed where they sit on
# the real lunchbox. Run from the project root:
#   python3 tools/bake_lunchbox_textures.py
#
# Panel coordinates are centimetres seen from outside, x to the right and
# y down from the top edge of the panel. Dimensions match src/lunchbox/dims.ts.

import cv2
import numpy as np
from PIL import Image

W, H, D = 24.0, 16.5, 16.0
ZIP = 8.5  # main zipper height; the cap is the top H - ZIP cm of each side panel
BASE = np.array([214, 150, 16], np.float32)  # sRGB #d69610, the bag's mustard
DECALS = 'assets-src/lunchbox/decals'
OUT = 'public/lunchbox'
rng = np.random.default_rng(1997)


def noise(w, h, sigma, seed):
    # smooth float noise, reflected at the borders (no bright edge artefacts)
    r = np.random.default_rng(seed).random((h, w)).astype(np.float32)
    k = int(sigma * 6) | 1
    a = cv2.GaussianBlur(r, (k, k), sigma, borderType=cv2.BORDER_REFLECT)
    a = (a - a.mean()) / (a.std() + 1e-6)
    return a


def fabric(w, h, cm_w, cm_h, seed, bottom_grime=True, sun=0.0):
    px = w / cm_w
    col = np.ones((h, w, 3), np.float32) * BASE
    n1 = noise(w, h, 40, seed)
    n2 = noise(w, h, 90, seed + 1)
    n3 = noise(w, h, 8, seed + 2)
    col *= (1 + 0.028 * n1 + 0.012 * n3)[..., None]
    col += (np.array([0.0, 2.5, -3.0]) * n2[..., None])
    # faint ripstop grid every 0.5 cm
    xs = np.arange(w)[None, :] / px
    ys = np.arange(h)[:, None] / px
    grid = ((np.abs(((xs + 0.25) % 0.5) - 0.25) < 0.018) | (np.abs(((ys + 0.25) % 0.5) - 0.25) < 0.018))
    col *= (1 + 0.012 * grid)[..., None]
    v = np.repeat((np.arange(h) / h)[:, None], w, 1)
    u = np.repeat((np.arange(w) / w)[None, :], h, 0)
    if bottom_grime:
        g = np.clip((v - 0.8) / 0.2, 0, 1) ** 1.5 * (0.7 + 0.3 * n1)
        col *= (1 - 0.16 * g)[..., None]
        col += (np.array([-4.0, -6.0, 6.0]) * g[..., None])
    edge = np.clip(1 - np.minimum(u, 1 - u) / 0.06, 0, 1)
    col *= (1 - 0.06 * edge)[..., None]
    col *= 1 + sun
    # a few faint smudges
    r = np.random.default_rng(seed + 5)
    for _ in range(7):
        cx, cy = r.random() * w, r.random() * h
        rad = (0.6 + r.random() * 1.6) * px
        d = np.sqrt((np.arange(w)[None, :] - cx) ** 2 + (np.arange(h)[:, None] - cy) ** 2)
        m = np.clip(1 - d / rad, 0, 1) ** 2 * (0.05 + r.random() * 0.06)
        col = col * (1 - m[..., None]) + np.array([120, 95, 40]) * m[..., None]
    return np.clip(col, 0, 255)


def place(col, px, name, x_cm, y_cm, width_cm, rotate=0.0):
    d = Image.open(f'{DECALS}/{name}.png').convert('RGBA')
    if rotate:
        d = d.rotate(rotate, resample=Image.BICUBIC, expand=True)
    tw = int(width_cm * px)
    th = int(d.height * tw / d.width)
    d = d.resize((tw, th), Image.LANCZOS)
    arr = np.asarray(d).astype(np.float32)
    x0, y0 = int(x_cm * px), int(y_cm * px)
    h, w = col.shape[:2]
    x1, y1 = min(w, x0 + tw), min(h, y0 + th)
    sub = arr[: y1 - y0, : x1 - x0]
    a = sub[..., 3:4] / 255.0
    col[y0:y1, x0:x1] = col[y0:y1, x0:x1] * (1 - a) + sub[..., :3] * a


def save(col, name, q=84):
    Image.fromarray(col.astype(np.uint8)).save(f'{OUT}/{name}.jpg', quality=q, optimize=True, progressive=True)


# Front (+z): SKYLER, flowers and squiggles across the cap, from the top of
# the dome down to the zipper (front photo).
w, h = 1280, 880
px = w / W
front = fabric(w, h, W, H, 11)
place(front, px, 'front-skyler', 0.0, 0.0, 24.0)
save(front, 'panel-front')

# Back (-z): SKY'S LUNCH BOX, on the cap, running up onto the dome
back = fabric(w, h, W, H, 12)
place(back, px, 'back-skys-lunch-box', 7.0, 0.1, 9.8)
save(back, 'panel-back')

# Top (+y)
top = fabric(1280, 853, W, D, 13, bottom_grime=False, sun=0.035)
save(top, 'panel-top')

# Ends, 16 x 16.5; the artwork is on the cap's end, above the zipper
w, h = 1024, 1056
px = w / D
right = fabric(w, h, D, H, 14)  # +x : MY MOM 97' and the curly-haired face
place(right, px, 'end-my-mom-97', 3.0, 1.2, 10.2)
save(right, 'panel-end-right')
left = fabric(w, h, D, H, 15)  # -x : THIS IS ME! with arrows and a face
place(left, px, 'end-this-is-me', 2.4, 3.3, 11.4)
save(left, 'panel-end-left')

# Bottom
bottom = fabric(640, 427, W, D, 16, bottom_grime=False)
bottom *= 0.86
save(bottom, 'panel-bottom', q=78)
print('baked')
