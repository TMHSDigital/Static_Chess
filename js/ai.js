/**
 * @fileoverview The computer opponent: picks a move for a position.
 * Builds on rules.js and, like it, touches no DOM, so it runs in the page, in
 * a Web Worker (ai-worker.js) and in tests alike.
 */

// How each level plays. depth is the number of half-moves searched;
// 0 means "pick any legal move".
const AI_LEVELS = {
    easy: { depth: 0 },
    medium: { depth: 2 },
    hard: { depth: 3 }
};

const AI_PIECE_VALUES = { [PAWN]: 100, [KNIGHT]: 320, [BISHOP]: 330, [ROOK]: 500, [QUEEN]: 900, [KING]: 0 };
const AI_MATE_SCORE = 100000;
const AI_QUIESCENCE_DEPTH = 4; // Extra half-moves of captures looked at after the main search

/**
 * Scores a position from one colour's point of view, in hundredths of a pawn:
 * material, plus a little for pieces near the centre, advanced pawns and a
 * safely placed king.
 * @param {object} position
 * @param {string} color
 * @returns {number}
 */
function evaluatePosition(position, color) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = position.board[r][c];
            if (!piece) continue;
            let value = AI_PIECE_VALUES[piece.type];
            const fromCentre = Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)); // 0.5 in the centre, 3.5 on the rim
            if (piece.type === KNIGHT || piece.type === BISHOP) {
                value += (3.5 - fromCentre) * 10;
            } else if (piece.type === PAWN) {
                const advanced = piece.color === WHITE ? 6 - r : r - 1;
                value += advanced * 5 + (c === 3 || c === 4 ? advanced * 4 : 0);
            } else if (piece.type === KING) {
                // Reward a king tucked away on its home rank (in practice: castled),
                // and count wandering off, which also gives up castling, against it
                const atHome = r === (piece.color === WHITE ? 7 : 0);
                if (atHome && (c <= 2 || c >= 6)) value += 40;
                else if (piece.hasMoved) value -= 30;
            }
            score += piece.color === color ? value : -value;
        }
    }
    return score;
}

/** Captures first, most valuable victim first, so alpha-beta cuts off early. */
function orderMoves(position, moves) {
    const gain = (move) => {
        const victim = position.board[move.to.row][move.to.col];
        if (!victim) return 0;
        const attacker = position.board[move.from.row][move.from.col];
        return AI_PIECE_VALUES[victim.type] * 10 - AI_PIECE_VALUES[attacker.type];
    };
    return moves
        .map(move => ({ move, gain: gain(move) }))
        .sort((a, b) => b.gain - a.gain)
        .map(entry => entry.move);
}

/**
 * Follows captures only, so the search does not stop in the middle of an
 * exchange and count a piece that is about to be taken back.
 */
function quiescence(position, color, alpha, beta, depth) {
    const standPat = evaluatePosition(position, color);
    if (depth === 0 || standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;

    const captures = allLegalMoves(position, color)
        .filter(move => position.board[move.to.row][move.to.col] !== null);
    for (const move of orderMoves(position, captures)) {
        const next = applyMove(position, move.from, move.to).position;
        const score = -quiescence(next, opponentOf(color), -beta, -alpha, depth - 1);
        if (score >= beta) return score;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

/**
 * Negamax search with alpha-beta pruning.
 * @returns {number} The best score the side to move can reach.
 */
function searchPosition(position, color, depth, alpha, beta, ply) {
    if (depth === 0 && !isInCheck(position, color)) {
        return quiescence(position, color, alpha, beta, AI_QUIESCENCE_DEPTH);
    }
    const moves = allLegalMoves(position, color);
    if (moves.length === 0) {
        // Checkmate (sooner is worse) or stalemate
        return isInCheck(position, color) ? -AI_MATE_SCORE + ply : 0;
    }
    if (depth === 0) {
        return evaluatePosition(position, color); // In check with moves left: no captures-only shortcut
    }
    for (const move of orderMoves(position, moves)) {
        const next = applyMove(position, move.from, move.to).position;
        const score = -searchPosition(next, opponentOf(color), depth - 1, -beta, -alpha, ply + 1);
        if (score >= beta) return score;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

/**
 * Picks a move for the side to move.
 * @param {object} position - A rules.js position.
 * @param {string} color - The side to move.
 * @param {string} [level] - A key of AI_LEVELS; unknown levels play as 'easy'.
 * @param {() => number} [random] - Source of randomness in [0, 1); pass a fixed one in tests.
 * @returns {{from: {row, col}, to: {row, col}, promotion: string}|null} null if there is no legal move.
 */
function chooseAIMove(position, color, level = 'easy', random = Math.random) {
    const moves = allLegalMoves(position, color);
    if (moves.length === 0) return null;
    const settings = AI_LEVELS[String(level).toLowerCase()] || AI_LEVELS.easy;
    const withPromotion = (move) => ({ from: move.from, to: move.to, promotion: QUEEN });

    if (settings.depth === 0) {
        return withPromotion(moves[Math.floor(random() * moves.length)]);
    }

    // Score every move, then choose among the best. Scores within a few
    // hundredths of a pawn count as equal, so games are not all the same.
    const scored = orderMoves(position, moves).map(move => {
        const next = applyMove(position, move.from, move.to).position;
        const score = -searchPosition(next, opponentOf(color), settings.depth - 1, -AI_MATE_SCORE, AI_MATE_SCORE, 1);
        return { move, score };
    });
    const best = Math.max(...scored.map(entry => entry.score));
    // A forced mate is the exception: there the quickest one is simply best
    const tolerance = Math.abs(best) > AI_MATE_SCORE - 1000 ? 0 : 5;
    const candidates = scored.filter(entry => entry.score >= best - tolerance);
    return withPromotion(candidates[Math.floor(random() * candidates.length)].move);
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AI_LEVELS, evaluatePosition, chooseAIMove };
}
