import { initFoucProtection } from './anti-fouc.js'

const THEMES = ['dark', 'light', 'skiatron', 'telequipment', 'amdek', 'vectrex']

const THEME_LABELS = {
  dark: 'Dark',
  light: 'Light',
  skiatron: 'Skiatron',
  telequipment: 'Telequipment',
  amdek: 'Amdek',
  vectrex: 'Vectrex'
}

export function serviceWorkerUnregister () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name))
    })
  }
}

function getEffectiveTheme () {
  const stored = localStorage.getItem('theme')
  if (stored && THEMES.includes(stored)) return stored
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function applyTheme (theme) {
  // dark uses no data-theme attribute (it's the :root default)
  if (theme === 'dark') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
  localStorage.setItem('theme', theme)

  const label = document.getElementById('theme-label')
  if (label) label.textContent = THEME_LABELS[theme]
}

function createNoisePattern () {
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(200, 200)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.random() * 255
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL()
}

function initCrtNoise () {
  const noiseEl = document.querySelector('.crt-noise')
  if (!noiseEl) return

  function updateNoise () {
    noiseEl.style.backgroundImage = `url(${createNoisePattern()})`
  }

  updateNoise()
  setInterval(updateNoise, 80)
}

export function initTheme () {
  const themeToggle = document.getElementById('theme-toggle')
  const theme = getEffectiveTheme()
  applyTheme(theme)

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = localStorage.getItem('theme') || getEffectiveTheme()
      const idx = THEMES.indexOf(current)
      const next = THEMES[(idx + 1) % THEMES.length]
      applyTheme(next)
    })
  }

  initCrtNoise()
}

export function initApp () {
  initFoucProtection()
  initTheme()
  serviceWorkerUnregister()
}

try {
  initApp()
} catch (e) {
  console.log(e)
}
