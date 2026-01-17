import { initFoucProtection } from './anti-fouc.js'

export function serviceWorkerRegister () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope)
        }, (err) => {
          console.log('ServiceWorker registration failed: ', err)
        })
    })
  }
}

export function initTheme () {
  const themeToggle = document.getElementById('theme-toggle')
  const storedTheme = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  if (storedTheme === 'light' || (!storedTheme && !prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'light')
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme')
      const newTheme = currentTheme === 'light' ? 'dark' : 'light'

      document.documentElement.setAttribute('data-theme', newTheme)
      localStorage.setItem('theme', newTheme)
    })
  }
}

export function initApp () {
  initFoucProtection()
  initTheme()
  serviceWorkerRegister()
}

try {
  // Only run if not in a test environment (basic check)
  // Jest runs with NODE_ENV=test usually, or we can check for module.parent if strictly node,
  // but for browser modules simply checking if it's being imported is harder.
  // However, since we export the functions, we can just call initApp() here.
  // Ideally we'd have a condition content here.
  // For now we will just call it.
  // Note: In a real test setup, we might want to prevent auto-execution on import.
  // But for this simple setup, we can let it run or wrap it.

  // Simple way to avoid auto-run during test import if we had a bundler env variable, but we don't.
  // We'll rely on side-effects for now, as is typical for entry points.

  // To make it testable without side effects, we often check a condition or have a separate entry point.
  // Since strict "don't run on import" is tricky without a bundler defining ENV, we will stick to just running it.
  // Tests might need to DOM cleanup.
  initApp()
} catch (e) {
  console.log(e)
}
