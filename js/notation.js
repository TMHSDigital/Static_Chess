/**
 * @fileoverview Chess notation as text: writing a move in standard algebraic
 * notation, writing a game as PGN, and reading PGN and FEN into moves that
 * have been checked. Builds on rules.js and, like it, touches no DOM and
 * nothing of the live game.
 */

/**
 * Writes a move in standard algebraic notation. A file or rank is added only
 * when another piece of the same type could legally have made the move.
 * @param {object} move - The move as recorded by applyMove.
 * @param {object} positionBefore - The rules.js position the move was played in.
 * @param {object} positionAfter - The position it led to, for the "+" or "#".
 * @returns {string}
 */
function writeSAN(move, positionBefore, positionAfter) {
    const piece = move.piece;
    const toAlg = coordsToAlgebraic(move.to.row, move.to.col);
    if (move.isCastling) {
        return move.to.col > move.from.col ? 'O-O' : 'O-O-O';
    }

    let disambiguation = '';
    if (piece.type !== PAWN) {
        // Other pieces of the same type that could legally have gone to the square.
        // A piece that is pinned could not, so it does not count, which is also
        // how findSANMove reads the move back.
        const rivals = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (r === move.from.row && c === move.from.col) continue;
                const other = positionBefore.board[r][c];
                if (!other || other.type !== piece.type || other.color !== piece.color) continue;
                const reaches = legalMovesFrom(positionBefore, r, c).some(
                    (to) => to.row === move.to.row && to.col === move.to.col
                );
                if (reaches) rivals.push({ row: r, col: c });
            }
        }
        // SAN rule: the file if it is enough to tell the pieces apart, else the
        // rank, else both.
        if (rivals.length > 0) {
            const from = coordsToAlgebraic(move.from.row, move.from.col);
            if (!rivals.some((o) => o.col === move.from.col)) disambiguation = from[0];
            else if (!rivals.some((o) => o.row === move.from.row)) disambiguation = from[1];
            else disambiguation = from;
        }
    }

    let notation = '';
    if (piece.type !== PAWN) {
        notation += piece.type.toUpperCase() + disambiguation;
    }
    if (move.captured) {
        if (piece.type === PAWN) {
            notation += coordsToAlgebraic(move.from.row, move.from.col)[0];
        }
        notation += 'x';
    }
    notation += toAlg;
    if (move.promotion) notation += '=' + move.promotion.toUpperCase();
    const opponent = opponentOf(piece.color);
    if (isInCheck(positionAfter, opponent)) {
        notation += allLegalMoves(positionAfter, opponent).length === 0 ? '#' : '+';
    }
    if (move.isEnPassant) notation += ' e.p.';
    return notation;
}

/**
 * @param {string} text - PGN that may hold several games.
 * @returns {string} The first game: everything up to the tags of a second one.
 */
function firstPGNGame(text) {
    const lines = String(text).split('\n');
    let inMoves = false;
    const end = lines.findIndex((line) => {
        const isTag = /^\s*\[\w+\s+"[^"\n]*"\]\s*$/.test(line);
        if (!isTag && line.trim()) inMoves = true;
        return isTag && inMoves;
    });
    return (end === -1 ? lines : lines.slice(0, end)).join('\n');
}

/**
 * Finds how a game given as PGN ended: the result after the moves, or else
 * the Result tag. The comment this app writes before the result of a game
 * ended by resignation, agreement or on time becomes the status again.
 * @param {string} text
 * @returns {{result: string, status: string}|null} Null for a game in progress.
 */
function pgnResult(text) {
    const game = firstPGNGame(text).trimEnd();
    // The result is the last word of the game; the comment, if any, stands right before it
    const closing = /(?:^|\s)(1-0|0-1|1\/2-1\/2|\*)$/.exec(game.slice(-8));
    const tagged = pgnTag(game, 'Result');
    const result = closing ? closing[1] : tagged;
    if (!['1-0', '0-1', '1/2-1/2'].includes(result)) return null;

    let comment = '';
    if (closing) {
        const before = game.slice(0, game.length - closing[1].length).trimEnd();
        const open = before.endsWith('}') ? before.lastIndexOf('{') : -1;
        if (open !== -1) comment = before.slice(open + 1, -1).trim();
    }
    const ownWording =
        /^(?:(?:White|Black) resigned\. (?:White|Black) wins\.|Draw by agreement\.|(?:White|Black) ran out of time[.,] .+)$/;
    const fallback = {
        '1-0': 'White won (result from the loaded game).',
        '0-1': 'Black won (result from the loaded game).',
        '1/2-1/2': 'Draw (result from the loaded game).',
    };
    return { result, status: ownWording.test(comment) ? comment : fallback[result] };
}

/**
 * @param {string} game - One game as PGN.
 * @param {string} name - A tag name, such as "Result" or "FEN".
 * @returns {string|null} The value of that tag, or null if the game has none.
 */
function pgnTag(game, name) {
    for (const line of game.split('\n')) {
        const tag = /^\s*\[(\w+)\s+"([^"]*)"\]/.exec(line);
        if (tag && tag[1] === name) return tag[2];
    }
    return null;
}

/**
 * Removes comments in braces. A brace that is never closed is left as it is,
 * so the text after it is not silently dropped.
 */
function stripBraceComments(text) {
    const kept = [];
    let position = 0;
    for (;;) {
        const open = text.indexOf('{', position);
        const close = open === -1 ? -1 : text.indexOf('}', open);
        if (close === -1) break;
        kept.push(text.slice(position, open));
        position = close + 1;
    }
    kept.push(text.slice(position));
    return kept.join(' ');
}

/**
 * Removes variations: everything between a parenthesis and the one that
 * closes it, however deeply nested. A parenthesis without a partner is left
 * as it is.
 */
function stripVariations(text) {
    // First find the partner of every opening parenthesis that has one
    const closes = new Map();
    const unclosed = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '(') unclosed.push(i);
        else if (text[i] === ')' && unclosed.length > 0) closes.set(unclosed.pop(), i);
    }
    if (closes.size === 0) return text;

    const kept = [];
    let position = 0;
    for (let i = 0; i < text.length; i++) {
        if (!closes.has(i)) continue;
        kept.push(text.slice(position, i));
        i = closes.get(i); // Skips whatever is nested inside as well
        position = i + 1;
    }
    kept.push(text.slice(position));
    return kept.join(' ');
}

/**
 * Takes the moves out of PGN text: tags, comments, variations, annotation
 * codes, move numbers and the result are dropped. Every step reads the text
 * once from start to end, so damaged text (braces or parentheses that are
 * never closed, thousands of blank lines) takes no longer than a real game.
 * @param {string} text
 * @returns {string[]} The moves in standard algebraic notation.
 */
function pgnMoveTokens(text) {
    const withoutTags = firstPGNGame(text)
        .split('\n')
        .filter((line) => !/^\s*\[[^\]]*\]\s*$/.test(line)) // Tag pairs
        .join('\n');
    const body = stripVariations(
        stripBraceComments(withoutTags).replace(/;[^\n]*/g, ' ') // Comments to the end of the line
    );
    return body
        .replace(/\$\d+/g, ' ') // Annotation codes
        .replace(/\d+\.+/g, ' ') // Move numbers, also when attached: "1.e4"
        .split(/\s+/)
        .filter((token) => token && !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
}

/** @returns {boolean} True for text that begins like a FEN position: eight ranks of pieces and numbers. */
function looksLikeFEN(text) {
    return /^\s*[pnbrqk1-8]+(\/[pnbrqk1-8]+){7}(\s|$)/i.test(String(text));
}

/** @returns {string} What makes a PGN the game it is: where it began, its moves and its result. */
function pgnMovetext(pgn) {
    const start = /^\[FEN "([^"]*)"\]/m.exec(pgn);
    return `${start ? start[1] : ''} ${pgn.trim().split('\n').pop()}`;
}

/**
 * The number a move carries in the move list, in PGN and in FEN. Everything
 * that numbers moves asks here, so a game need not begin with White's move 1.
 * @param {number} index - How many moves were played before it.
 * @param {{player: string, fullmove: number}} start - How the game began.
 * @returns {{number: number, white: boolean}} The move number and whose move it is.
 */
function moveNumber(index, start) {
    const halfMoves = index + (start.player === BLACK ? 1 : 0);
    return { number: start.fullmove + Math.floor(halfMoves / 2), white: halfMoves % 2 === 0 };
}

/** @returns {string} A move number as written before the move: "12." for White, "12..." for Black. */
function moveNumberPrefix(index, start) {
    const { number, white } = moveNumber(index, start);
    return `${number}${white ? '.' : '...'}`;
}

/**
 * Writes a game as PGN text: the seven standard tags, a few more where they
 * apply, and the moves.
 * @param {object} game - moves: the moves in SAN, in order. start: how the
 *   game began ({player, fullmove, fen}). result: '1-0', '0-1', '1/2-1/2' or
 *   '*' for a game in progress. white, black: the players' names.
 *   timeControl: such as '300+2', or null without a clock. comment: how the
 *   game ended when the moves do not show it, or null. date: the day it is
 *   written, a Date.
 * @returns {string}
 */
function writePGN(game) {
    const pad = (n) => String(n).padStart(2, '0');
    const day = game.date;
    const date = `${day.getFullYear()}.${pad(day.getMonth() + 1)}.${pad(day.getDate())}`;
    const tags = [
        ['Event', 'Static Chess game'],
        ['Site', '?'],
        ['Date', date],
        ['Round', '-'],
        ['White', game.white],
        ['Black', game.black],
        ['Result', game.result],
        ...(game.timeControl ? [['TimeControl', game.timeControl]] : []),
        // A game that did not begin from the usual position says where it began
        ...(game.start.fen
            ? [
                  ['SetUp', '1'],
                  ['FEN', game.start.fen],
              ]
            : []),
    ].map(([name, value]) => `[${name} "${value}"]`);

    const moves = game.moves.map((notation, index) => {
        const san = notation.replace(' e.p.', ''); // Not valid in PGN
        // White's moves carry their number, and so does a first move by Black
        const numbered = moveNumber(index, game.start).white || index === 0;
        return numbered ? `${moveNumberPrefix(index, game.start)} ${san}` : san;
    });
    const ending = game.comment ? [`{${game.comment.replace(/[{}]/g, '')}}`] : [];

    return `${tags.join('\n')}\n\n${[...moves, ...ending, game.result].join(' ')}\n`;
}

/** @returns {string|null} Why a text of this length cannot be loaded, or null if it can. */
function importSizeError(length) {
    if (length <= CONFIG.IMPORT_MAX_LENGTH) return null;
    const most = CONFIG.IMPORT_MAX_LENGTH.toLocaleString('en-US');
    return `That text is too long to be a game (over ${most} characters).`;
}

/**
 * Reads a game given as PGN and checks every move of it. A game with a FEN
 * tag begins from that position instead of the usual one. Of several games in
 * the text, the first is read.
 * @param {string} text
 * @returns {{ok: false, error: string, empty?: boolean}|{ok: true, start: object, moves: object[]}}
 *   empty: the text holds no move at all. start: how the game begins, as
 *   positionFromFEN gives it. moves: each move as findSANMove gives it.
 */
function readPGN(text) {
    const tooLong = importSizeError(String(text).length);
    if (tooLong) return { ok: false, error: tooLong };
    const tokens = pgnMoveTokens(text);
    if (tokens.length === 0)
        return { ok: false, error: 'No moves found in the text.', empty: true };

    // The game begins from the usual position unless a FEN tag says otherwise
    let start = { ...STANDARD_START, position: initialPosition() };
    const fenTag = pgnTag(firstPGNGame(text), 'FEN');
    if (fenTag !== null) {
        start = positionFromFEN(fenTag);
        if (start.error) return { ok: false, error: `The FEN tag cannot be used. ${start.error}` };
    }

    let position = start.position;
    let color = start.player;
    const moves = [];
    for (const [index, token] of tokens.entries()) {
        const move = findSANMove(position, color, token);
        if (!move) {
            const number = moveNumberPrefix(index, start);
            return { ok: false, error: `Move ${number} ${token} cannot be played.` };
        }
        moves.push(move);
        position = applyMove(position, move.from, move.to, move.promotion).position;
        color = opponentOf(color);
    }
    return { ok: true, start, moves };
}

/**
 * Reads a position given in FEN.
 * @param {string} text
 * @returns {{ok: false, error: string}|{ok: true, start: object}} start: as
 *   positionFromFEN gives it.
 */
function readFEN(text) {
    const tooLong = importSizeError(String(text).length);
    if (tooLong) return { ok: false, error: tooLong };
    const start = positionFromFEN(text);
    if (start.error) return { ok: false, error: start.error };
    return { ok: true, start };
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        moveNumber,
        moveNumberPrefix,
        writePGN,
        importSizeError,
        readPGN,
        readFEN,
        writeSAN,
        firstPGNGame,
        pgnResult,
        pgnTag,
        stripBraceComments,
        stripVariations,
        pgnMoveTokens,
        looksLikeFEN,
        pgnMovetext,
    };
}
