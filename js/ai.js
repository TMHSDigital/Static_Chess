/**
 * @fileoverview The computer opponent: picks a move for a position.
 * Builds on rules.js and, like it, touches no DOM, so it runs in the page, in
 * a Web Worker (ai-worker.js) and in tests alike.
 */

// How each level plays. depth is the number of half-moves always searched;
// 0 means "pick any legal move". A level with timeMs keeps searching deeper,
// up to maxDepth, for about that long when the caller allows it (the worker
// does; a search on the page's own thread does not, so the page never hangs).
const AI_LEVELS = {
    easy: { depth: 0 },
    medium: { depth: 2 },
    hard: { depth: 3, timeMs: 1000, maxDepth: 8 },
};

const AI_PIECE_VALUES = {
    [PAWN]: 100,
    [KNIGHT]: 320,
    [BISHOP]: 330,
    [ROOK]: 500,
    [QUEEN]: 900,
    [KING]: 0,
};
const AI_MATE_SCORE = 100000;
const AI_QUIESCENCE_DEPTH = 4; // Extra half-moves of captures looked at after the main search
const AI_ENDGAME_MATERIAL = 1700; // Pieces (not pawns) left on the board, both sides, when the endgame starts
const AI_WINNING_LEAD = 400; // Material lead from which the engine goes after the enemy king
const AI_REPEAT_PENALTY = 60; // What a move back into an earlier position costs the side that is better

// Timed searches stop by throwing this once the deadline has passed
const AI_SEARCH_STOPPED = {};
let aiSearchDeadline = Infinity;
let aiSearchNodes = 0;

/** Stops a timed search that has run out of time. Looks at the clock only now and then. */
function checkSearchTime() {
    if ((++aiSearchNodes & 255) === 0 && Date.now() > aiSearchDeadline) throw AI_SEARCH_STOPPED;
}

/**
 * Scores a position from one colour's point of view, in hundredths of a pawn:
 * material, plus a little for pieces near the centre, advanced pawns, rooks on
 * the seventh rank and a well placed king. In the endgame the king belongs in
 * the centre, and a side that is clearly winning is rewarded for driving the
 * other king to the edge and bringing its own king up, which is what it takes
 * to give mate with few pieces.
 * @param {object} position
 * @param {string} color
 * @returns {number}
 */
function evaluatePosition(position, color) {
    const material = { [WHITE]: 0, [BLACK]: 0 };
    const kings = {};
    let piecesLeft = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = position.board[r][c];
            if (!piece) continue;
            material[piece.color] += AI_PIECE_VALUES[piece.type];
            if (piece.type === KING) kings[piece.color] = { row: r, col: c };
            else if (piece.type !== PAWN) piecesLeft += AI_PIECE_VALUES[piece.type];
        }
    }
    const endgame = piecesLeft <= AI_ENDGAME_MATERIAL;
    const fromCentreOf = (r, c) => Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)); // 0.5 in the centre, 3.5 on the rim

    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = position.board[r][c];
            if (!piece) continue;
            let value = AI_PIECE_VALUES[piece.type];
            const fromCentre = fromCentreOf(r, c);
            if (piece.type === KNIGHT || piece.type === BISHOP) {
                value += (3.5 - fromCentre) * 10;
            } else if (piece.type === PAWN) {
                const advanced = piece.color === WHITE ? 6 - r : r - 1;
                value += advanced * 5 + (c === 3 || c === 4 ? advanced * 4 : 0);
            } else if (piece.type === ROOK) {
                if (r === (piece.color === WHITE ? 1 : 6)) value += 20; // On the seventh rank
            } else if (piece.type === KING) {
                if (endgame) {
                    value += (3.5 - fromCentre) * 10;
                } else {
                    // Reward a king tucked away on its home rank (in practice: castled),
                    // and count wandering off, which also gives up castling, against it
                    const atHome = r === (piece.color === WHITE ? 7 : 0);
                    if (atHome && (c <= 2 || c >= 6)) value += 40;
                    else if (piece.hasMoved) value -= 30;
                }
            }
            score += piece.color === color ? value : -value;
        }
    }

    if (endgame && kings[WHITE] && kings[BLACK]) {
        for (const side of [WHITE, BLACK]) {
            const other = opponentOf(side);
            if (material[side] - material[other] < AI_WINNING_LEAD) continue;
            const apart =
                Math.abs(kings[side].row - kings[other].row) +
                Math.abs(kings[side].col - kings[other].col);
            const hunt = fromCentreOf(kings[other].row, kings[other].col) * 20 + (14 - apart) * 6;
            score += side === color ? hunt : -hunt;
        }
    }
    return score;
}

/**
 * Every legal move for one colour as the search sees them: a pawn reaching the
 * last rank is one move per piece it can become.
 * @returns {Array<{from: {row, col}, to: {row, col}, promotion?: string}>}
 */
function searchMoves(position, color) {
    const moves = [];
    for (const move of allLegalMoves(position, color)) {
        const piece = position.board[move.from.row][move.from.col];
        if (piece.type === PAWN && (move.to.row === 0 || move.to.row === 7)) {
            for (const promotion of PROMOTION_TYPES) moves.push({ ...move, promotion });
        } else {
            moves.push(move);
        }
    }
    return moves;
}

/** Captures and promotions first, most valuable first, so alpha-beta cuts off early. */
function orderMoves(position, moves) {
    const gain = (move) => {
        let value = move.promotion ? AI_PIECE_VALUES[move.promotion] : 0;
        const victim = position.board[move.to.row][move.to.col];
        if (victim) {
            const attacker = position.board[move.from.row][move.from.col];
            value += AI_PIECE_VALUES[victim.type] * 10 - AI_PIECE_VALUES[attacker.type];
        }
        return value;
    };
    return moves
        .map((move) => ({ move, gain: gain(move) }))
        .sort((a, b) => b.gain - a.gain)
        .map((entry) => entry.move);
}

/** Plays a search move on a position and returns the position after it. */
function afterMove(position, move) {
    return applyMove(position, move.from, move.to, move.promotion).position;
}

/**
 * Follows captures and queen promotions only, so the search does not stop in
 * the middle of an exchange and count a piece that is about to be taken back.
 */
function quiescence(position, color, alpha, beta, depth) {
    checkSearchTime();
    const standPat = evaluatePosition(position, color);
    if (depth === 0 || standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;

    const forcing = searchMoves(position, color).filter(
        (move) => position.board[move.to.row][move.to.col] !== null || move.promotion === QUEEN
    );
    for (const move of orderMoves(position, forcing)) {
        const score = -quiescence(
            afterMove(position, move),
            opponentOf(color),
            -beta,
            -alpha,
            depth - 1
        );
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
    checkSearchTime();
    if (depth === 0 && !isInCheck(position, color)) {
        return quiescence(position, color, alpha, beta, AI_QUIESCENCE_DEPTH);
    }
    const moves = searchMoves(position, color);
    if (moves.length === 0) {
        // Checkmate (sooner is worse) or stalemate
        return isInCheck(position, color) ? -AI_MATE_SCORE + ply : 0;
    }
    if (depth === 0) {
        return evaluatePosition(position, color); // In check with moves left: no captures-only shortcut
    }
    for (const move of orderMoves(position, moves)) {
        const score = -searchPosition(
            afterMove(position, move),
            opponentOf(color),
            depth - 1,
            -beta,
            -alpha,
            ply + 1
        );
        if (score >= beta) return score;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

/**
 * Scores the root moves to one depth. Moves that turn out clearly worse than
 * the best one found so far are cut short: their scores are then only upper
 * limits, which is enough to know they will not be chosen.
 * @returns {Array<{move: object, score: number}>} In the order the moves were given.
 */
function scoreRootMoves(position, color, moves, depth, tolerance) {
    let best = -AI_MATE_SCORE;
    return moves.map((move) => {
        const floor = Math.max(-AI_MATE_SCORE, best - tolerance - 1);
        const score = -searchPosition(
            afterMove(position, move),
            opponentOf(color),
            depth - 1,
            -AI_MATE_SCORE,
            -floor,
            1
        );
        if (score > best) best = score;
        return { move, score };
    });
}

/**
 * Picks a move for the side to move.
 * @param {object} position - A rules.js position.
 * @param {string} color - The side to move.
 * @param {string} [level] - A key of AI_LEVELS; unknown levels play as 'easy'.
 * @param {() => number} [random] - Source of randomness in [0, 1); pass a fixed one in tests.
 * @param {{timed?: boolean, depth?: number, seen?: string[]}} [options] - timed: let a
 *   level with a time allowance think deeper until it is used up (not repeatable, so
 *   tests leave it off). depth: search this deep instead of the level's own depth.
 *   seen: positionKey of every earlier position in the game; when the engine is
 *   better it avoids going back to one, so it does not shuffle into a draw.
 * @returns {{from: {row, col}, to: {row, col}, promotion: string}|null} null if there is no legal move.
 */
function chooseAIMove(position, color, level = 'easy', random = Math.random, options = {}) {
    const settings = AI_LEVELS[String(level).toLowerCase()] || AI_LEVELS.easy;
    const asResult = (move) => ({
        from: move.from,
        to: move.to,
        promotion: move.promotion || QUEEN,
    });

    if (settings.depth === 0) {
        const legal = allLegalMoves(position, color);
        if (legal.length === 0) return null;
        return asResult(legal[Math.floor(random() * legal.length)]);
    }

    const moves = searchMoves(position, color);
    if (moves.length === 0) return null;

    // Scores within a few hundredths of a pawn count as equal, so games are not all the same
    const tolerance = 5;
    const seen = new Set(options.seen || []);
    // Moves that may yet be chosen need exact scores, also after the penalty for repeating
    const exactWithin = tolerance + (seen.size > 0 ? AI_REPEAT_PENALTY : 0);
    const isMate = (score) => Math.abs(score) > AI_MATE_SCORE - 1000;
    const baseDepth = options.depth || settings.depth;
    const timed = !!options.timed && settings.timeMs > 0;
    const maxDepth = timed ? Math.max(baseDepth, settings.maxDepth) : baseDepth;
    const started = Date.now();

    let ordered = orderMoves(position, moves);
    let scored = null;
    try {
        for (let depth = timed ? 1 : baseDepth; depth <= maxDepth; depth++) {
            // The level's own depth is always finished; anything deeper stops when time is up
            aiSearchDeadline = depth > baseDepth ? started + settings.timeMs : Infinity;
            scored = scoreRootMoves(position, color, ordered, depth, exactWithin);
            const best = Math.max(...scored.map((entry) => entry.score));
            if (isMate(best)) break; // A forced mate, either way: looking deeper changes nothing
            if (depth >= baseDepth && Date.now() - started > settings.timeMs / 2) break;
            // Start the next depth with the best moves first, which lets it cut off far more
            ordered = [...scored].sort((a, b) => b.score - a.score).map((entry) => entry.move);
        }
    } catch (error) {
        if (error !== AI_SEARCH_STOPPED) throw error; // Out of time: keep the last finished depth
    } finally {
        aiSearchDeadline = Infinity;
    }

    // Better off and not mating yet: going back to an earlier position only helps the other side
    const unpenalised = Math.max(...scored.map((entry) => entry.score));
    if (seen.size > 0 && unpenalised > 0 && !isMate(unpenalised)) {
        scored = scored.map((entry) => {
            const next = afterMove(position, entry.move);
            const key = positionKey(next.board, opponentOf(color), next.enPassantTarget);
            return seen.has(key) ? { ...entry, score: entry.score - AI_REPEAT_PENALTY } : entry;
        });
    }

    const best = Math.max(...scored.map((entry) => entry.score));
    // A forced mate is the exception to "near-equal": there the quickest one is simply best
    const margin = isMate(best) ? 0 : tolerance;
    const candidates = scored.filter((entry) => entry.score >= best - margin);
    return asResult(candidates[Math.floor(random() * candidates.length)].move);
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AI_LEVELS, evaluatePosition, chooseAIMove };
}
