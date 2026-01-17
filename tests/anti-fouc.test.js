
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initFoucProtection } from '../js/anti-fouc.js';


describe('anti-fouc.js', () => {
    beforeEach(() => {
        // Reset DOM
        document.documentElement.className = 'loading';
        jest.useFakeTimers();

        // Mock readyState to 'loading' to prevent immediate execution
        Object.defineProperty(document, 'readyState', {
            get: () => 'loading',
            configurable: true
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('removes loading class on DOMContentLoaded', () => {
        initFoucProtection();

        // Simulate DOMContentLoaded
        window.dispatchEvent(new Event('DOMContentLoaded'));

        expect(document.documentElement.classList.contains('loading')).toBe(false);
    });

    test('removes loading class after timeout (fallback)', () => {
        initFoucProtection();

        expect(document.documentElement.classList.contains('loading')).toBe(true);

        // Fast-forward time
        jest.advanceTimersByTime(3000);

        expect(document.documentElement.classList.contains('loading')).toBe(false);
    });
});
