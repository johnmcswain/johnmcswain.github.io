
export function initFoucProtection() {
    function removeLoading() {
        document.documentElement.classList.remove('loading');
    }

    window.addEventListener('load', removeLoading);

    // Fail-safe to ensure content is shown if load event fails or takes too long
    setTimeout(removeLoading, 3000);
}
