/**
 * Deferred loading for Three.js and constellation
 * Loads heavy 3D scripts after page is interactive
 */
(function() {
    'use strict';

    function loadScripts() {
        var s1 = document.createElement('script');
        s1.src = 'js/three.min.js';
        s1.onload = function() {
            var s2 = document.createElement('script');
            s2.src = 'js/constellation.js';
            document.body.appendChild(s2);
        };
        document.body.appendChild(s1);
    }

    // Load after page is interactive
    if ('requestIdleCallback' in window) {
        requestIdleCallback(loadScripts, {timeout: 2000});
    } else {
        window.addEventListener('load', loadScripts);
    }
})();
