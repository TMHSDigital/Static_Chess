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

/**
 * @param {number} left - Milliseconds left on a clock.
 * @returns {number|null} The smallest threshold of CONFIG.LOW_TIME_WARNINGS the
 *   clock is at or under, or null while it is above them all.
 */
function lowTimeLevel(left) {
    const reached = CONFIG.LOW_TIME_WARNINGS.filter((threshold) => left <= threshold);
    return reached.length > 0 ? Math.min(...reached) : null;
}

/**
 * How a game ends when a side's time is up: the other side wins, unless it
 * has nothing to checkmate with, which makes it a draw.
 * @param {string} loser - The colour whose time ran out.
 * @param {boolean} winnerCanMate - Whether the other side could still checkmate.
 * @returns {{result: string, status: string}} The result and what the status line says.
 */
function timeoutResult(loser, winnerCanMate) {
    const winner = loser === WHITE ? BLACK : WHITE;
    if (!winnerCanMate) {
        return {
            result: '1/2-1/2',
            status: `${sideName(loser)} ran out of time, but ${sideName(winner)} cannot checkmate. Draw.`,
        };
    }
    return {
        result: winner === WHITE ? '1-0' : '0-1',
        status: `${sideName(loser)} ran out of time. ${sideName(winner)} wins.`,
    };
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        lowTimeLevel,
        timeoutResult,
        makeClock,
        timeLeft,
        formatClock,
    };
}
