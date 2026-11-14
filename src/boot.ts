/**
 * The loading screen lives in index.html so it shows before the bundle
 * arrives. Fade it out once there is something to look at.
 */
export function dismissBoot(): void {
  const el = document.getElementById('boot')
  if (!el || el.classList.contains('is-gone')) return
  el.classList.add('is-gone')
  setTimeout(() => el.remove(), 600)
}
