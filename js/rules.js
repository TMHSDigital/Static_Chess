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

/** @returns {object} The position every game of chess starts from. */
function initialPosition() {
    return {
        board: getInitialPieces(),
        kingPositions: { [WHITE]: { row: 7, col: 4 }, [BLACK]: { row: 0, col: 4 } },
        enPassantTarget: null,
    };
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

const KNIGHT_JUMPS = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
];
// The eight directions; the first four are the rook's, the last four the bishop's
const SLIDE_DIRECTIONS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
];

/**
 * Checks if a square is attacked by any piece of one colour. Looks outward
 * from the square for a piece that could take on it, which is far quicker
 * than asking every piece on the board.
 * @returns {boolean}
 */
function isSquareAttacked(targetRow, targetCol, attackerColor, board) {
    const attackerAt = (row, col, type) => {
        const piece = isWithinBounds(row, col) ? board[row][col] : null;
        return !!piece && piece.color === attackerColor && piece.type === type;
    };

    // A pawn takes one square diagonally forward, so it stands one row behind the square
    const pawnRow = targetRow + (attackerColor === WHITE ? 1 : -1);
    if (attackerAt(pawnRow, targetCol - 1, PAWN) || attackerAt(pawnRow, targetCol + 1, PAWN)) {
        return true;
    }
    for (const [rowStep, colStep] of KNIGHT_JUMPS) {
        if (attackerAt(targetRow + rowStep, targetCol + colStep, KNIGHT)) return true;
    }
    for (let index = 0; index < SLIDE_DIRECTIONS.length; index++) {
        const [rowStep, colStep] = SLIDE_DIRECTIONS[index];
        if (attackerAt(targetRow + rowStep, targetCol + colStep, KING)) return true;
        // The first piece met along the line attacks if it moves that way
        let row = targetRow + rowStep;
        let col = targetCol + colStep;
        while (isWithinBounds(row, col) && board[row][col] === null) {
            row += rowStep;
            col += colStep;
        }
        if (attackerAt(row, col, QUEEN) || attackerAt(row, col, index < 4 ? ROOK : BISHOP)) {
            return true;
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
 * @param {Array<Array<object|null>>} board
 * @param {string} color
 * @param {'kingside' | 'queenside'} side
 * @returns {boolean} True if that side still has the right to castle on that
 * wing: its king and that rook are on their first squares and neither has
 * moved. Whether castling is possible right now is for canCastleIn.
 */
function hasCastlingRight(board, color, side) {
    const row = color === WHITE ? 7 : 0;
    const unmoved = (col, type) => {
        const piece = board[row][col];
        return !!piece && piece.type === type && piece.color === color && !piece.hasMoved;
    };
    return unmoved(4, KING) && unmoved(side === 'kingside' ? 7 : 0, ROOK);
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
    if (!hasCastlingRight(board, color, side) || isInCheck(position, color)) {
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
 * Lists the legal moves for one colour that take a piece or put a pawn on the
 * last rank: the moves a search follows to the end of an exchange. They are
 * the moves allLegalMoves gives onto an occupied square or the last rank, in
 * the same order, found without working out all the others. En passant is
 * not among them.
 * @returns {Array<{from: {row: number, col: number}, to: {row: number, col: number}}>}
 */
function allLegalCaptures(position, color) {
    const board = position.board;
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece || piece.color !== color) continue;
            const slides = piece.type === ROOK || piece.type === BISHOP || piece.type === QUEEN;
            const from = { row: r, col: c };
            for (let endRow = 0; endRow < 8; endRow++) {
                // An empty square only counts for a pawn stepping onto the last rank
                const pawnArrives = piece.type === PAWN && (endRow === 0 || endRow === 7);
                for (let endCol = 0; endCol < 8; endCol++) {
                    const target = board[endRow][endCol];
                    if (target ? target.color === color : !pawnArrives) continue;
                    if (!isPseudoLegalMove(piece, r, c, endRow, endCol, target !== null)) continue;
                    if (slides && isPathObstructed(r, c, endRow, endCol, board)) continue;
                    const to = { row: endRow, col: endCol };
                    if (!isInCheck(applyMove(position, from, to).position, color)) {
                        moves.push({ from, to });
                    }
                }
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
        for (const side of ['kingside', 'queenside']) {
            key += hasCastlingRight(board, color, side) ? '1' : '0';
        }
    }
    // The en passant square only matters if a capture on it is legal: a pawn
    // beside it that is pinned, or whose capture would leave its king in check,
    // does not make the position a different one (FIDE 9.2.3)
    if (epTarget) {
        const pawnRow = epTarget.row + (player === WHITE ? 1 : -1);
        let position = null; // Built only when a pawn stands ready
        const canCapture = [epTarget.col - 1, epTarget.col + 1].some((col) => {
            const piece = isWithinBounds(pawnRow, col) ? board[pawnRow][col] : null;
            if (!piece || piece.type !== PAWN || piece.color !== player) return false;
            position = position || {
                board,
                kingPositions: kingSquares(board),
                enPassantTarget: epTarget,
            };
            return legalMovesFrom(position, pawnRow, col).some(
                (to) => to.row === epTarget.row && to.col === epTarget.col
            );
        });
        if (canCapture) key += coordsToAlgebraic(epTarget.row, epTarget.col);
    }
    return key;
}

/** @returns {Object<string, {row: number, col: number}>} The square of each king on a board. */
function kingSquares(board) {
    const kings = {};
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type === KING) kings[piece.color] = { row: r, col: c };
        }
    }
    return kings;
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

/**
 * Decides whether the game is over in a position, and how. Checkmate and
 * stalemate are always looked for; the draws only when `draws` is given, since
 * a loaded game may play on through a draw nobody claimed.
 * @param {object} position - A rules.js position.
 * @param {string} player - The side to move.
 * @param {{halfmoveClock?: number, repeated?: boolean}} [draws] - The half-move
 *   count for the fifty-move rule, and whether the position has occurred three times.
 * @returns {{result: string, reason: string}|null} The result ('1-0', '0-1' or
 *   '1/2-1/2') and its reason ('checkmate', 'stalemate', 'insufficient material',
 *   'threefold repetition' or 'the fifty-move rule'), or null if the game goes on.
 */
function gameOutcome(position, player, draws) {
    if (allLegalMoves(position, player).length === 0) {
        return isInCheck(position, player)
            ? { result: player === WHITE ? '0-1' : '1-0', reason: 'checkmate' }
            : { result: '1/2-1/2', reason: 'stalemate' };
    }
    if (!draws) return null;
    let reason = null;
    if (hasInsufficientMaterial(position.board)) reason = 'insufficient material';
    else if (draws.repeated) reason = 'threefold repetition';
    else if (draws.halfmoveClock >= 100) reason = 'the fifty-move rule';
    return reason ? { result: '1/2-1/2', reason } : null;
}

/**
 * @param {Array<Array<object|null>>} board
 * @param {string} color
 * @returns {boolean} False if that side could never give checkmate with what
 * it has: a lone king, a king with one knight, or a king with bishops that
 * all stand on one colour. Used when the other side runs out of time.
 */
function canDeliverMate(board, color) {
    const others = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === color && piece.type !== KING) {
                others.push({ type: piece.type, shade: (r + c) % 2 });
            }
        }
    }
    if (others.length === 0) return false;
    if (others.length === 1 && others[0].type === KNIGHT) return false;
    return !others.every((p) => p.type === BISHOP && p.shade === others[0].shade);
}

/**
 * Finds the legal move a piece of standard algebraic notation stands for, such
 * as "Nf3", "exd5", "R1a3", "O-O" or "e8=N". Check marks and annotations
 * ("+", "#", "!", "?") are ignored, and "0-0" is read as castling.
 * @param {object} position
 * @param {string} color - The side to move.
 * @param {string} san
 * @returns {{from: {row, col}, to: {row, col}, promotion: string}|null} null
 *   if no legal move, or more than one, fits.
 */
function findSANMove(position, color, san) {
    const text = String(san)
        .replace(/[+#!?]+$/, '')
        .replace(/0/g, 'O');
    const moves = allLegalMoves(position, color);
    const pieceAt = (square) => position.board[square.row][square.col];

    if (text === 'O-O' || text === 'O-O-O') {
        const toCol = text === 'O-O' ? 6 : 2;
        const castle = moves.find(
            (move) =>
                pieceAt(move.from).type === KING &&
                move.to.col === toCol &&
                Math.abs(move.to.col - move.from.col) === 2
        );
        return castle ? { from: castle.from, to: castle.to, promotion: QUEEN } : null;
    }

    const parts = /^([KQRBN])?([a-h])?([1-8])?x?([a-h])([1-8])(?:=?([QRBN]))?$/.exec(text);
    if (!parts) return null;
    const type = parts[1] ? parts[1].toLowerCase() : PAWN;
    const fileOf = (letter) => letter.charCodeAt(0) - 97;
    const rowOf = (digit) => 8 - Number(digit);
    const to = { row: rowOf(parts[5]), col: fileOf(parts[4]) };

    const fitting = moves.filter((move) => {
        const piece = pieceAt(move.from);
        if (piece.type !== type || move.to.row !== to.row || move.to.col !== to.col) return false;
        if (parts[2] && move.from.col !== fileOf(parts[2])) return false;
        if (parts[3] && move.from.row !== rowOf(parts[3])) return false;
        // Castling is never written as a king move
        return !(type === KING && Math.abs(move.to.col - move.from.col) === 2);
    });
    if (fitting.length !== 1) return null;

    const promotes = type === PAWN && (to.row === 0 || to.row === 7);
    if (parts[6] && !promotes) return null;
    return {
        from: fitting[0].from,
        to: fitting[0].to,
        promotion: parts[6] ? parts[6].toLowerCase() : QUEEN,
    };
}

/**
 * Writes a position in Forsyth-Edwards Notation.
 * @param {object} position
 * @param {string} player - The side to move.
 * @param {number} halfmoveClock - Half-moves since the last pawn move or capture.
 * @param {number} fullmove - Number of the move about to be played, from 1.
 * @returns {string}
 */
function positionToFEN(position, player, halfmoveClock, fullmove) {
    const board = position.board;
    const ranks = board.map((row) => {
        let rank = '';
        let empty = 0;
        for (const piece of row) {
            if (!piece) {
                empty++;
                continue;
            }
            if (empty) rank += empty;
            empty = 0;
            rank += piece.color === WHITE ? piece.type.toUpperCase() : piece.type;
        }
        return rank + (empty || '');
    });

    let castling = '';
    for (const color of [WHITE, BLACK]) {
        if (hasCastlingRight(board, color, 'kingside')) castling += color === WHITE ? 'K' : 'k';
        if (hasCastlingRight(board, color, 'queenside')) castling += color === WHITE ? 'Q' : 'q';
    }

    const target = position.enPassantTarget;
    const enPassant = target ? `${String.fromCharCode(97 + target.col)}${8 - target.row}` : '-';
    return `${ranks.join('/')} ${player} ${castling || '-'} ${enPassant} ${halfmoveClock} ${fullmove}`;
}

/**
 * Reads a position written in Forsyth-Edwards Notation. The first two fields
 * (placement and side to move) are required; castling rights, the en passant
 * square, the half-move clock and the move number default to none, none, 0
 * and 1. Castling rights become the hasMoved marks of the kings and rooks.
 * @param {string} fen
 * @returns {{position: object, player: string, halfmoveClock: number, fullmove: number}|{error: string}}
 *   The position and how the game goes on from it, or what is wrong with the text.
 */
function positionFromFEN(fen) {
    const [placement, side, castling = '-', target = '-', half = '0', full = '1'] = String(fen)
        .trim()
        .split(/\s+/);
    const ranks = placement.split('/');
    if (ranks.length !== 8) return { error: 'A FEN position needs eight ranks.' };

    const board = [];
    const kings = { [WHITE]: [], [BLACK]: [] };
    for (const [row, rank] of ranks.entries()) {
        const squares = [];
        for (const ch of rank) {
            if (/[1-8]/.test(ch)) {
                for (let i = 0; i < Number(ch); i++) squares.push(null);
            } else if (/[pnbrqk]/i.test(ch)) {
                const color = ch === ch.toUpperCase() ? WHITE : BLACK;
                const piece = new Piece(ch.toLowerCase(), color);
                // Only a pawn still on its own second rank may move two squares
                piece.hasMoved = piece.type !== PAWN || row !== (color === WHITE ? 6 : 1);
                if (piece.type === KING) kings[color].push({ row, col: squares.length });
                if (piece.type === PAWN && (row === 0 || row === 7)) {
                    return { error: 'A pawn cannot stand on the first or last rank.' };
                }
                squares.push(piece);
            } else {
                return { error: `"${ch}" is not a piece or a number of empty squares.` };
            }
        }
        if (squares.length !== 8) {
            return { error: `Rank ${8 - row} of the FEN does not have eight squares.` };
        }
        board.push(squares);
    }
    if (kings[WHITE].length !== 1 || kings[BLACK].length !== 1) {
        return { error: 'A position needs exactly one king of each colour.' };
    }
    if (side !== WHITE && side !== BLACK) {
        return { error: 'The FEN does not say whose move it is.' };
    }
    if (!/^(-|[KQkq]{1,4})$/.test(castling)) {
        return { error: 'The castling rights in the FEN cannot be read.' };
    }
    if (!/^(-|[a-h][36])$/.test(target)) {
        return { error: 'The en passant square in the FEN cannot be read.' };
    }
    if (!/^\d+$/.test(half) || !/^\d+$/.test(full)) {
        return { error: 'The move counters in the FEN are not numbers.' };
    }

    // A castling right holds only if the king and that rook are on their first squares
    for (const right of castling === '-' ? '' : castling) {
        const color = right === right.toUpperCase() ? WHITE : BLACK;
        const row = color === WHITE ? 7 : 0;
        const king = board[row][4];
        const rook = board[row][right.toLowerCase() === 'k' ? 7 : 0];
        const there = (piece, type) => !!piece && piece.type === type && piece.color === color;
        if (there(king, KING) && there(rook, ROOK)) {
            king.hasMoved = false;
            rook.hasMoved = false;
        }
    }

    // The en passant square counts only behind a pawn that could just have moved two squares
    let enPassantTarget = null;
    if (target !== '-') {
        const { row, col } = algebraicToCoords(target);
        const pawn = board[row + (side === WHITE ? 1 : -1)][col];
        const passed = row === (side === WHITE ? 2 : 5) && board[row][col] === null;
        if (passed && pawn && pawn.type === PAWN && pawn.color !== side) {
            enPassantTarget = { row, col };
        }
    }

    const position = {
        board,
        kingPositions: { [WHITE]: kings[WHITE][0], [BLACK]: kings[BLACK][0] },
        enPassantTarget,
    };
    if (isInCheck(position, opponentOf(side))) {
        return {
            error: 'The side that is not to move is in check, which cannot happen in a game.',
        };
    }
    return {
        position,
        player: side,
        halfmoveClock: Number(half),
        fullmove: Math.max(1, Number(full)),
    };
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        findSANMove,
        positionToFEN,
        positionFromFEN,
        PROMOTION_TYPES,
        opponentOf,
        initialPosition,
        isPathObstructed,
        isSquareAttacked,
        isInCheck,
        applyMove,
        canCastleIn,
        legalMovesFrom,
        allLegalMoves,
        allLegalCaptures,
        positionKey,
        hasInsufficientMaterial,
        gameOutcome,
        canDeliverMate,
        hasCastlingRight,
    };
}
