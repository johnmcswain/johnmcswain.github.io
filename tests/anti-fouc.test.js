
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initFoucProtection } from '../js/anti-fouc.js';


describe('anti-fouc.js', () => {
    beforeEach(() => {
        // Reset DOM
        document.documentElement.className = 'loading';
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('removes loading class on window load', () => {
        initFoucProtection();

        // Simulate window load
        window.dispatchEvent(new Event('load'));

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
