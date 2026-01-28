import { jest, describe, test, expect, beforeEach } from '@jest/globals'
import { initTheme, initApp } from '../js/main.js'

// Mock anti-fouc to avoid side effects during initApp test
jest.mock('../js/anti-fouc.js', () => ({
  initFoucProtection: jest.fn()
}))

describe('main.js theme logic', () => {
  let themeToggle

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
            <button id="theme-toggle"></button>
        `
    themeToggle = document.getElementById('theme-toggle')
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()

    // Mock matchMedia
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: true, // Default to true (prefers dark) to align with default CSS
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }))
  })

  test('initializes with default theme (dark preferred implies no data-theme="light")', () => {
    initTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  test('initializes with light theme if stored in localStorage', () => {
    localStorage.setItem('theme', 'light')
    initTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  test('toggles theme on button click', () => {
    initTheme()

    // Initial state (assuming dark default)
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()

    // Click to toggle to light
    themeToggle.click()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')

    // Click again: in the new implementation, themes cycle: dark -> light -> skiatron -> ...
    themeToggle.click()
    expect(document.documentElement.getAttribute('data-theme')).toBe('skiatron')
    expect(localStorage.getItem('theme')).toBe('skiatron')
  })
})
