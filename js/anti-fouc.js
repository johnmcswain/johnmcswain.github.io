export function initFoucProtection () {
  function removeLoading () {
    document.documentElement.classList.remove('loading')
  }

  // Performance: DOMContentLoaded fires when HTML is parsed, much faster than 'load' (which waits for images/assets)
  // This reduces the artificial delay for the user seeing the content.
  window.addEventListener('DOMContentLoaded', removeLoading)

  // Fail-safe to ensure content is shown if something hangs or if event already fired
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    removeLoading()
  } else {
    setTimeout(removeLoading, 3000)
  }
}
