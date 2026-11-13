/**
 * @fileoverview The rules of chess as functions of a position. Nothing here
 * touches the DOM, storage, sound or the live game in game.js, so the same
 * code serves the game, the tests and a search on board copies.
 *
 * A position is { board, kingPositions, enPassantTarget }:
 *   board           - 8x8 array of pieces or null, row 0 is the eighth rank
 *   kingPositions   - { w: {row, col}, b: {row, col} }
 *   enPassantTarget - {row, col} of the square a pawn just passed over, or null
 * Positions are never changed in place; applyMove returns a new one.
 */

const PROMOTION_TYPES = [QUEEN, ROOK, BISHOP, KNIGHT];

/** @returns {string} The other colour. */
function opponentOf(color) {
    return color === WHITE ? BLACK : WHITE;
}

/**
 * Checks if a path between two squares is obstructed for sliding pieces.
 * Assumes the move is purely horizontal, vertical, or diagonal.
 * @returns {boolean} True if a piece stands between the two squares.
 */
function isPathObstructed(startRow, startCol, endRow, endCol, board) {
    const rowStep = Math.sign(endRow - startRow);
    const colStep = Math.sign(endCol - startCol);
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;

    while (currentRow !== endRow || currentCol !== endCol) {
        if (!isWithinBounds(currentRow, currentCol)) break; // Should not happen for valid moves
        if (board[currentRow][currentCol] !== null) {
            return true;
        }
        currentRow += rowStep;
        currentCol += colStep;
    }
    return false;
}

/**
 * Checks if a square is attacked by any piece of one colour.
 * @returns {boolean}
 */
function isSquareAttacked(targetRow, targetCol, attackerColor, board) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece || piece.color !== attackerColor) continue;
            // Asked as a capture, so pawns answer with their diagonal moves
            if (!isPseudoLegalMove(piece, r, c, targetRow, targetCol, true)) continue;
            const slides = piece.type === ROOK || piece.type === BISHOP || piece.type === QUEEN;
            if (!slides || !isPathObstructed(r, c, targetRow, targetCol, board)) {
                return true;
            }
        }
    }
    return false;
}

/** @returns {boolean} True if that colour's king is attacked in the position. */
function isInCheck(position, color) {
    const king = position.kingPositions[color];
    return isSquareAttacked(king.row, king.col, opponentOf(color), position.board);
}

/**
 * Plays a move on a position and returns the result. The move is not checked
 * for legality. Castling is a king move of two files; en passant is a pawn
 * capture onto the position's en passant target.
 * @param {object} position
 * @param {{row: number, col: number}} from
 * @param {{row: number, col: number}} to
 * @param {string} [promotionType] - Piece a pawn reaching the last rank becomes; queen by default.
 * @returns {{position: object, move: object}} The new position and a record of the move.
 */
function applyMove(position, from, to, promotionType = QUEEN) {
    const board = position.board.map((row) => row.slice());
    const piece = board[from.row][from.col];
    const move = {
        from: { row: from.row, col: from.col },
        to: { row: to.row, col: to.col },
        piece,
        captured: board[to.row][to.col],
        isCastling: false,
        isEnPassant: false,
        promotion: null,
    };
    const kingPositions = { ...position.kingPositions };
    const moved = (original) => {
        const copy = new Piece(original.type, original.color);
        copy.hasMoved = true;
        return copy;
    };

    // A double pawn move leaves a square behind that can be captured on
    let enPassantTarget = null;
    if (piece.type === PAWN && Math.abs(to.row - from.row) === 2) {
        enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
    }

    // En passant: the captured pawn is beside the capturing pawn, not on the target square
    const target = position.enPassantTarget;
    if (
        piece.type === PAWN &&
        target &&
        to.row === target.row &&
        to.col === target.col &&
        from.col !== to.col &&
        !move.captured
    ) {
        move.captured = board[from.row][to.col];
        board[from.row][to.col] = null;
        move.isEnPassant = true;
    }

    // Castling: the rook jumps to the other side of the king
    if (piece.type === KING && Math.abs(to.col - from.col) === 2) {
        move.isCastling = true;
        const rookFromCol = to.col > from.col ? 7 : 0;
        const rookToCol = to.col > from.col ? to.col - 1 : to.col + 1;
        const rook = board[from.row][rookFromCol];
        if (rook && rook.type === ROOK) {
            board[from.row][rookToCol] = moved(rook);
            board[from.row][rookFromCol] = null;
        }
    }

    let placed = moved(piece);
    if (piece.type === PAWN && (to.row === 0 || to.row === 7)) {
        move.promotion = PROMOTION_TYPES.includes(promotionType) ? promotionType : QUEEN;
        placed = moved({ type: move.promotion, color: piece.color });
    }
    board[to.row][to.col] = placed;
    board[from.row][from.col] = null;

    if (piece.type === KING) {
        kingPositions[piece.color] = { row: to.row, col: to.col };
    }

    return { position: { board, kingPositions, enPassantTarget }, move };
}

/**
 * Checks if castling is legal: king and rook unmoved, the squares between them
 * empty, and the king not in check on, or passing over, an attacked square.
 * @param {object} position
 * @param {string} color
 * @param {'kingside' | 'queenside'} side
 * @returns {boolean}
 */
function canCastleIn(position, color, side) {
    const board = position.board;
    const kingRow = color === WHITE ? 7 : 0;
    const kingCol = 4;
    const king = board[kingRow][kingCol];
    if (
        !king ||
        king.type !== KING ||
        king.color !== color ||
        king.hasMoved ||
        isInCheck(position, color)
    ) {
        return false;
    }

    const rook = board[kingRow][side === 'kingside' ? 7 : 0];
    if (!rook || rook.type !== ROOK || rook.color !== color || rook.hasMoved) {
        return false;
    }

    const between = side === 'kingside' ? [5, 6] : [1, 2, 3];
    if (between.some((col) => board[kingRow][col] !== null)) {
        return false;
    }

    // The king's two steps must be safe. On the queenside the b-file square only
    // has to be empty; the king never crosses it, so it may be attacked.
    const crossed = side === 'kingside' ? [5, 6] : [3, 2];
    return !crossed.some((col) => isSquareAttacked(kingRow, col, opponentOf(color), board));
}

/**
 * Lists the squares the piece on a square can legally move to.
 * @param {object} position
 * @param {number} startRow
 * @param {number} startCol
 * @returns {Array<{row: number, col: number}>}
 */
function legalMovesFrom(position, startRow, startCol) {
    const { board, enPassantTarget } = position;
    const piece = board[startRow][startCol];
    if (!piece) return [];

    const color = piece.color;
    const opponent = opponentOf(color);
    const candidates = [];

    // 1. The piece's movement pattern, with blocked paths removed.
    // isPseudoLegalMove already keeps pawns from moving straight onto a piece
    // or diagonally onto an empty square.
    for (let endRow = 0; endRow < 8; endRow++) {
        for (let endCol = 0; endCol < 8; endCol++) {
            const targetPiece = board[endRow][endCol];
            if (targetPiece && targetPiece.color === color) continue; // Own piece in the way
            const isCapture = targetPiece !== null;

            if (!isPseudoLegalMove(piece, startRow, startCol, endRow, endCol, isCapture)) continue;
            if (piece.type === ROOK || piece.type === BISHOP || piece.type === QUEEN) {
                if (isPathObstructed(startRow, startCol, endRow, endCol, board)) continue;
            }
            // A pawn's double move needs the square it passes over to be empty
            if (
                piece.type === PAWN &&
                Math.abs(endRow - startRow) === 2 &&
                board[(startRow + endRow) / 2][startCol] !== null
            ) {
                continue;
            }
            candidates.push({ row: endRow, col: endCol });
        }
    }

    // 2. En passant lands on an empty square, so it is not covered above
    if (piece.type === PAWN && enPassantTarget) {
        const direction = color === WHITE ? -1 : 1;
        const victim = board[startRow][enPassantTarget.col];
        if (
            startRow === enPassantTarget.row - direction &&
            Math.abs(startCol - enPassantTarget.col) === 1 &&
            victim &&
            victim.type === PAWN &&
            victim.color === opponent
        ) {
            candidates.push({ row: enPassantTarget.row, col: enPassantTarget.col });
        }
    }

    // 3. Castling
    if (piece.type === KING && !piece.hasMoved) {
        if (canCastleIn(position, color, 'kingside'))
            candidates.push({ row: startRow, col: startCol + 2 });
        if (canCastleIn(position, color, 'queenside'))
            candidates.push({ row: startRow, col: startCol - 2 });
    }

    // 4. Drop the moves that would leave the mover's own king in check
    const from = { row: startRow, col: startCol };
    return candidates.filter((to) => !isInCheck(applyMove(position, from, to).position, color));
}

/**
 * Lists every legal move for one colour.
 * @returns {Array<{from: {row: number, col: number}, to: {row: number, col: number}}>}
 */
function allLegalMoves(position, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = position.board[r][c];
            if (!piece || piece.color !== color) continue;
            for (const to of legalMovesFrom(position, r, c)) {
                moves.push({ from: { row: r, col: c }, to });
            }
        }
    }
    return moves;
}

/**
 * A key that is equal for two positions exactly when they count as the same
 * position for the repetition rule: same placement, side to move, castling
 * rights and en passant possibility.
 */
function positionKey(board, player, epTarget) {
    let key = player;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            key += piece ? piece.color + piece.type : '-';
        }
    }
    for (const color of [WHITE, BLACK]) {
        const row = color === WHITE ? 7 : 0;
        const king = board[row][4];
        const kingReady = !!king && king.type === KING && king.color === color && !king.hasMoved;
        for (const col of [7, 0]) {
            const rook = board[row][col];
            key +=
                kingReady && rook && rook.type === ROOK && rook.color === color && !rook.hasMoved
                    ? '1'
                    : '0';
        }
    }
    // The en passant square only matters if a pawn is placed to capture on it
    if (epTarget) {
        const pawnRow = epTarget.row + (player === WHITE ? 1 : -1);
        const canCapture = [epTarget.col - 1, epTarget.col + 1].some((col) => {
            const piece = isWithinBounds(pawnRow, col) ? board[pawnRow][col] : null;
            return !!piece && piece.type === PAWN && piece.color === player;
        });
        if (canCapture) key += coordsToAlgebraic(epTarget.row, epTarget.col);
    }
    return key;
}

/**
 * @returns {boolean} True if neither side can possibly give checkmate: bare
 * kings, a single bishop or knight, or only bishops that all stand on one colour.
 */
function hasInsufficientMaterial(board) {
    const others = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type !== KING) others.push({ type: piece.type, shade: (r + c) % 2 });
        }
    }
    if (others.length === 0) return true;
    if (others.length === 1) return others[0].type === BISHOP || others[0].type === KNIGHT;
    return others.every((p) => p.type === BISHOP && p.shade === others[0].shade);
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PROMOTION_TYPES,
        opponentOf,
        isPathObstructed,
        isSquareAttacked,
        isInCheck,
        applyMove,
        canCastleIn,
        legalMovesFrom,
        allLegalMoves,
        positionKey,
        hasInsufficientMaterial,
    };
}
