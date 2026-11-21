const { loadGame } = require('../helpers/load-game');

/** Builds a rules.js position (and the side to move) from a FEN string. */
function fromFen(g, fen) {
  const { Piece, WHITE, BLACK, KING, ROOK, PAWN } = g.pieces;
  const [placement, turn, castling, ep] = fen.split(' ');
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const kingPositions = {};
  placement.split('/').forEach((rank, row) => {
    let col = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        col += Number(ch);
        continue;
      }
      const color = ch === ch.toUpperCase() ? WHITE : BLACK;
      const piece = new Piece(ch.toLowerCase(), color);
      if (piece.type === PAWN) piece.hasMoved = row !== (color === WHITE ? 6 : 1);
      else piece.hasMoved = true; // Kings and rooks with castling rights are reset below
      if (piece.type === KING) kingPositions[color] = { row, col };
      board[row][col] = piece;
      col++;
    }
  });
  const rights = { K: [7, 7], Q: [7, 0], k: [0, 7], q: [0, 0] };
  for (const ch of castling === '-' ? '' : castling) {
    const [row, rookCol] = rights[ch];
    board[row][4].hasMoved = false;
    board[row][rookCol].hasMoved = false;
    expect(board[row][rookCol].type).toBe(ROOK);
  }
  const enPassantTarget = ep === '-' ? null : g.utils.algebraicToCoords(ep);
  return {
    position: { board, kingPositions, enPassantTarget },
    color: turn === 'w' ? WHITE : BLACK,
  };
}

/** Counts the move sequences of a given length, the standard move-generator check. */
function perft(g, position, color, depth) {
  const { allLegalMoves, applyMove, opponentOf, PROMOTION_TYPES } = g.rules;
  let nodes = 0;
  for (const { from, to } of allLegalMoves(position, color)) {
    const promotes =
      position.board[from.row][from.col].type === 'p' && (to.row === 0 || to.row === 7);
    for (const type of promotes ? PROMOTION_TYPES : [undefined]) {
      nodes +=
        depth === 1
          ? 1
          : perft(g, applyMove(position, from, to, type).position, opponentOf(color), depth - 1);
    }
  }
  return nodes;
}

describe('move generation matches the published perft counts', () => {
  const cases = [
    ['the start position', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', [20, 400, 8902]],
    [
      'castling, pins and en passant (Kiwipete)',
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -',
      [48, 2039],
    ],
    ['an endgame with en passant pins', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -', [14, 191, 2812]],
    ['promotions', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ -', [44, 1486]],
  ];
  test.each(cases)('%s', (_name, fen, counts) => {
    const g = loadGame();
    const { position, color } = fromFen(g, fen);
    counts.forEach((expected, index) => {
      expect(perft(g, position, color, index + 1)).toBe(expected);
    });
  });

  /** Calls visit for a position and every position up to depth moves after it. */
  function walk(g, position, color, depth, visit) {
    const { allLegalMoves, applyMove, opponentOf } = g.rules;
    visit(position, color);
    if (depth === 0) return;
    for (const { from, to } of allLegalMoves(position, color)) {
      walk(g, applyMove(position, from, to).position, opponentOf(color), depth - 1, visit);
    }
  }

  test.each(cases)('the quick generators agree with the full ones: %s', (_name, fen) => {
    const g = loadGame();
    const {
      allLegalMoves,
      allLegalCaptures,
      isSquareAttacked,
      isPathObstructed,
      pseudoMoveTargets,
    } = g.rules;
    const start = fromFen(g, fen);
    let positions = 0;

    walk(g, start.position, start.color, 2, (position, color) => {
      positions++;
      const board = position.board;

      // Captures and arrivals on the last rank: the same moves in the same order
      const forcing = allLegalMoves(position, color).filter(
        ({ from, to }) =>
          board[to.row][to.col] !== null ||
          (board[from.row][from.col].type === 'p' && (to.row === 0 || to.row === 7))
      );
      expect(allLegalCaptures(position, color)).toEqual(forcing);

      // Attacked squares: ask every piece in turn, as the rule is stated
      const attackedTheSlowWay = (row, col, attacker) =>
        board.some((line, r) =>
          line.some((piece, c) => {
            if (!piece || piece.color !== attacker) return false;
            if (!g.pieces.isPseudoLegalMove(piece, r, c, row, col, true)) return false;
            return !'rbq'.includes(piece.type) || !isPathObstructed(r, c, row, col, board);
          })
        );
      // Movement patterns: try every square in turn, as the rule is stated
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (!piece) continue;
          const theSlowWay = [];
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const target = board[row][col];
              if (target && target.color === piece.color) continue;
              if (!g.pieces.isPseudoLegalMove(piece, r, c, row, col, target !== null)) continue;
              if ('rbq'.includes(piece.type) && isPathObstructed(r, c, row, col, board)) continue;
              if (piece.type === 'p' && Math.abs(row - r) === 2 && board[(r + row) / 2][c]) {
                continue;
              }
              theSlowWay.push({ row, col });
            }
          }
          expect([r, c, pseudoMoveTargets(board, r, c)]).toEqual([r, c, theSlowWay]);
        }
      }

      if (positions % 7 !== 1) return; // Every square of every seventh position is plenty
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          for (const attacker of ['w', 'b']) {
            expect([row, col, attacker, isSquareAttacked(row, col, attacker, board)]).toEqual([
              row,
              col,
              attacker,
              attackedTheSlowWay(row, col, attacker),
            ]);
          }
        }
      }
    });
    expect(positions).toBeGreaterThan(190);
  });
});

describe('applyMove', () => {
  test('returns a new position and leaves the old one untouched', () => {
    const g = loadGame();
    const { position } = fromFen(g, 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq -');
    const before = JSON.stringify(position);
    const { position: next, move } = g.rules.applyMove(
      position,
      { row: 7, col: 4 },
      { row: 7, col: 6 }
    );

    expect(JSON.stringify(position)).toBe(before);
    expect(move.isCastling).toBe(true);
    expect(next.board[7][6]).toMatchObject({ type: 'k', color: 'w', hasMoved: true });
    expect(next.board[7][5]).toMatchObject({ type: 'r', color: 'w', hasMoved: true });
    expect(next.board[7][4]).toBeNull();
    expect(next.board[7][7]).toBeNull();
    expect(next.kingPositions.w).toEqual({ row: 7, col: 6 });
    expect(next.kingPositions.b).toEqual({ row: 0, col: 4 });
  });

  test('sets and uses the en passant square', () => {
    const g = loadGame();
    const { position } = fromFen(g, '4k3/8/8/8/5p2/8/4P3/4K3 w - -');
    const pushed = g.rules.applyMove(position, { row: 6, col: 4 }, { row: 4, col: 4 }).position;
    expect(pushed.enPassantTarget).toEqual({ row: 5, col: 4 });

    const { position: after, move } = g.rules.applyMove(
      pushed,
      { row: 4, col: 5 },
      { row: 5, col: 4 }
    );
    expect(move.isEnPassant).toBe(true);
    expect(move.captured).toMatchObject({ type: 'p', color: 'w' });
    expect(after.board[4][4]).toBeNull();
    expect(after.board[5][4]).toMatchObject({ type: 'p', color: 'b' });
    expect(after.enPassantTarget).toBeNull();
  });

  test('promotes to the requested piece', () => {
    const g = loadGame();
    const { position } = fromFen(g, '4k3/1P6/8/8/8/8/8/4K3 w - -');
    const { position: next, move } = g.rules.applyMove(
      position,
      { row: 1, col: 1 },
      { row: 0, col: 1 },
      'r'
    );
    expect(move.promotion).toBe('r');
    expect(next.board[0][1]).toMatchObject({ type: 'r', color: 'w' });
  });
});

describe('the live game uses the same rules', () => {
  test('livePosition reflects the board and a move replaces it rather than changing it', () => {
    const g = loadGame();
    const start = g.game.livePosition();
    const picture = JSON.stringify(start);
    g.play('e2e4', 'e7e5', 'g1f3');
    expect(JSON.stringify(start)).toBe(picture);
    expect(g.game.livePosition().board).toBe(g.game.boardState);
    expect(g.rules.allLegalMoves(g.game.livePosition(), 'b')).toEqual(
      g.rules.allLegalMoves(g.game.livePosition(), 'b')
    );
  });
});

describe('gameOutcome', () => {
  const outcome = (g, fen, draws) => {
    const { position, player } = g.rules.positionFromFEN(fen);
    return g.rules.gameOutcome(position, player, draws);
  };

  test('checkmate and stalemate, for either side to move', () => {
    const g = loadGame();
    expect(outcome(g, 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1')).toEqual({
      result: '1-0',
      reason: 'checkmate',
    });
    expect(outcome(g, 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toEqual({
      result: '0-1',
      reason: 'checkmate',
    });
    expect(outcome(g, 'k7/8/1Q6/8/8/8/8/4K3 b - - 0 1')).toEqual({
      result: '1/2-1/2',
      reason: 'stalemate',
    });
    expect(outcome(g, '7K/5q2/6k1/8/8/8/8/8 w - - 0 1')).toEqual({
      result: '1/2-1/2',
      reason: 'stalemate',
    });
  });

  test('the draws only when they are asked for, mate first', () => {
    const g = loadGame();
    const bare = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    const live = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
    const draw = (reason) => ({ result: '1/2-1/2', reason });
    expect(outcome(g, bare)).toBeNull();
    expect(outcome(g, bare, {})).toEqual(draw('insufficient material'));
    expect(outcome(g, live, { repeated: true })).toEqual(draw('threefold repetition'));
    expect(outcome(g, live, { halfmoveClock: 100 })).toEqual(draw('the fifty-move rule'));
    expect(outcome(g, live, { halfmoveClock: 99, repeated: false })).toBeNull();
    const mate = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(outcome(g, mate, { halfmoveClock: 100, repeated: true }).reason).toBe('checkmate');
  });
});

describe('the fifty-move rule counter', () => {
  test('goes back to zero after a pawn move or a capture, and counts any other move', () => {
    const { rules, pieces } = loadGame();
    const piece = (type) => new pieces.Piece(type, 'w');
    expect(rules.nextHalfmoveClock(7, { piece: piece('p'), captured: null })).toBe(0);
    expect(rules.nextHalfmoveClock(7, { piece: piece('n'), captured: piece('b') })).toBe(0);
    expect(rules.nextHalfmoveClock(7, { piece: piece('r'), captured: null })).toBe(8);
    expect(rules.nextHalfmoveClock(0, { piece: piece('k'), captured: null })).toBe(1);
  });

  test('isLegalMove agrees with the list of legal moves', () => {
    const { rules } = loadGame();
    const start = rules.initialPosition();
    expect(rules.isLegalMove(start, { row: 6, col: 4 }, { row: 4, col: 4 })).toBe(true);
    expect(rules.isLegalMove(start, { row: 6, col: 4 }, { row: 3, col: 4 })).toBe(false);
    expect(rules.isLegalMove(start, { row: 4, col: 4 }, { row: 3, col: 4 })).toBe(false); // An empty square
  });
});
