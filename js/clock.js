/**
 * @fileoverview The arithmetic of a chess clock. The clock of the game being
 * played lives in game.js; these functions take it as an argument and touch
 * no DOM.
 *
 * A clock is { control, base, increment, remaining: {w, b}, turnStartedAt },
 * times in milliseconds. turnStartedAt is when the side to move was put on
 * the clock, or null while no clock is running.
 */

/**
 * @param {string|null} controlKey - A key of CONFIG.TIME_CONTROLS.
 * @returns {object|null} A full clock for that time control, or null for none
 *   or for a control without minutes ("No clock").
 */
function makeClock(controlKey) {
    const control = controlKey ? CONFIG.TIME_CONTROLS[controlKey] : null;
    if (!control || !control.minutes) return null;
    const base = control.minutes * 60000;
    return {
        control: controlKey,
        base,
        increment: (control.increment || 0) * 1000,
        remaining: { [WHITE]: base, [BLACK]: base },
        turnStartedAt: null,
    };
}

/**
 * @param {object|null} clock
 * @param {string} color - The side asked about.
 * @param {string} playerToMove - The side whose clock is the one that may be running.
 * @param {number} [now] - The time to measure to; the present by default.
 * @returns {number} Milliseconds that side has left; never below zero, and 0 without a clock.
 */
function timeLeft(clock, color, playerToMove, now = Date.now()) {
    if (!clock) return 0;
    const running = clock.turnStartedAt !== null && color === playerToMove;
    const used = running ? now - clock.turnStartedAt : 0;
    return Math.max(0, clock.remaining[color] - used);
}

/** @returns {string} A time as "m:ss", with tenths of a second in the last ten seconds. */
function formatClock(ms) {
    if (ms < 10000) return `0:0${Math.floor(ms / 1000)}.${Math.floor((ms % 1000) / 100)}`;
    const seconds = Math.ceil(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        makeClock,
        timeLeft,
        formatClock,
    };
}
