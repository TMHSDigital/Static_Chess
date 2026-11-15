/**
 * @fileoverview Putting the engine's scores into words for the review of a
 * game: who is ahead in a position, and what a move cost the side that played
 * it. It takes scores as assessPosition in ai.js gives them and touches no
 * DOM and nothing of the live game.
 */

/**
 * @param {{score: number, mate: boolean, over: boolean}} assessment - As assessPosition gives it.
 * @returns {string} What the engine makes of the position, as a sentence.
 */
function scoreText(assessment) {
    const { score, mate, over } = assessment;
    const ahead = score > 0 ? 'White' : 'Black';
    const pawns = Math.abs(score) / 100;
    if (over) return mate ? 'Checkmate.' : 'Stalemate.';
    if (mate) return `Engine thinks ${ahead} can force mate.`;
    if (pawns < 0.3) return 'Engine thinks the position is about equal.';
    return `Engine thinks ${ahead} is ahead by ${pawns.toFixed(1)}.`;
}

/**
 * What a move cost the side that played it, by the engine's count: the score
 * before it less the score after it, seen from that side.
 * @param {object} before - The assessment of the position the move was played in.
 * @param {object} after - The assessment of the position it led to.
 * @param {string} color - The side that played the move.
 * @returns {{lost: number, allowedMate: boolean, missedMate: boolean}|null}
 *   lost is in hundredths of a pawn. null when the move lost less than
 *   CONFIG.REVIEW_MISTAKE_DROP and is not to be marked.
 */
function scoreDrop(before, after, color) {
    const side = color === WHITE ? 1 : -1;
    const lost = (before.score - after.score) * side;
    if (lost < CONFIG.REVIEW_MISTAKE_DROP) return null;
    return {
        lost,
        allowedMate: after.mate && after.score * side < 0,
        missedMate: before.mate && before.score * side > 0,
    };
}

/**
 * @param {string} label - The move with its number, such as "12. Nf3".
 * @param {{lost: number, allowedMate: boolean, missedMate: boolean}} drop - As scoreDrop gives it.
 * @returns {string} What the move cost, as a sentence.
 */
function scoreDropText(label, drop) {
    if (drop.allowedMate) return `Engine thinks ${label} allowed a forced mate.`;
    if (drop.missedMate) return `Engine thinks ${label} missed a forced mate.`;
    return `Engine thinks ${label} lost about ${(drop.lost / 100).toFixed(1)}.`;
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        scoreText,
        scoreDrop,
        scoreDropText,
    };
}
