const { loadGame } = require('../helpers/load-game');

const el = (g, id) => g.window.document.getElementById(id);
const notations = (g) => g.game.moveHistory.map((move) => move.notation);
const movetext = (g) => g.game.buildPGN().trim().split('\n').pop();
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('reading FEN', () => {
  test.each([
    ['the start position', START_FEN],
    ['all four castling rights', KIWIPETE],
    ['some castling rights', 'r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 20'],
    ['no castling rights', 'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1'],
    ['an en passant square', 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3'],
    ['an endgame with counters', '8/5k2/8/8/8/2K5/4R3/8 b - - 47 93'],
  ])('%s reads and writes back the same', (_name, fen) => {
    const { rules } = loadGame();
    const read = rules.positionFromFEN(fen);
    expect(read.error).toBeUndefined();
    expect(rules.positionToFEN(read.position, read.player, read.halfmoveClock, read.fullmove)).toBe(
      fen
    );
  });

  test('the later fields are optional', () => {
    const { rules } = loadGame();
    const read = rules.positionFromFEN('8/8/8/4k3/8/8/4P3/4K3 b');
    expect(read).toMatchObject({ player: 'b', halfmoveClock: 0, fullmove: 1 });
    expect(read.position.enPassantTarget).toBeNull();
    expect(read.position.kingPositions).toEqual({ w: { row: 7, col: 4 }, b: { row: 3, col: 4 } });
  });

  test('a castling right without its king and rook in place is dropped', () => {
    const { rules } = loadGame();
    const read = rules.positionFromFEN('4k3/8/8/8/8/8/8/4K2R w KQkq - 0 1');
    expect(rules.positionToFEN(read.position, 'w', 0, 1).split(' ')[2]).toBe('K');
  });

  test('an en passant square with no pawn to take is dropped', () => {
    const { rules } = loadGame();
    const read = rules.positionFromFEN('4k3/8/8/8/8/8/8/4K3 w - e6 0 1');
    expect(read.position.enPassantTarget).toBeNull();
  });

  test.each([
    ['seven ranks', '8/8/8/8/8/8/4K2k w - - 0 1', 'A FEN position needs eight ranks.'],
    [
      'a short rank',
      '4k3/8/8/8/8/8/7/4K3 w - - 0 1',
      'Rank 2 of the FEN does not have eight squares.',
    ],
    [
      'an unknown letter',
      '4k3/8/8/8/8/8/3x4/4K3 w - - 0 1',
      '"x" is not a piece or a number of empty squares.',
    ],
    [
      'two white kings',
      '4k3/8/8/8/8/8/4K3/4K3 w - - 0 1',
      'A position needs exactly one king of each colour.',
    ],
    [
      'no black king',
      '8/8/8/8/8/8/8/4K3 w - - 0 1',
      'A position needs exactly one king of each colour.',
    ],
    [
      'a pawn on the last rank',
      'P3k3/8/8/8/8/8/8/4K3 w - - 0 1',
      'A pawn cannot stand on the first or last rank.',
    ],
    ['no side to move', '4k3/8/8/8/8/8/8/4K3', 'The FEN does not say whose move it is.'],
    [
      'bad castling rights',
      '4k3/8/8/8/8/8/8/4K3 w XY - 0 1',
      'The castling rights in the FEN cannot be read.',
    ],
    [
      'a bad en passant square',
      '4k3/8/8/8/8/8/8/4K3 w - e5 0 1',
      'The en passant square in the FEN cannot be read.',
    ],
    [
      'counters that are not numbers',
      '4k3/8/8/8/8/8/8/4K3 w - - x 1',
      'The move counters in the FEN are not numbers.',
    ],
    [
      'the side not to move in check',
      '4k3/8/8/8/8/8/4r3/4K3 b - - 0 1',
      'The side that is not to move is in check, which cannot happen in a game.',
    ],
  ])('%s is refused', (_name, fen, error) => {
    expect(loadGame().rules.positionFromFEN(fen)).toEqual({ error });
  });
});

describe('starting a game from FEN', () => {
  test('the position is on the board and the game goes on from it', () => {
    const g = loadGame();
    g.play('e2e4');
    expect(g.game.importFEN('r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 20')).toEqual({ ok: true });

    expect(notations(g)).toEqual([]);
    expect(g.game.buildFEN()).toBe('r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 20');
    expect(el(g, 'game-status').textContent).toBe("Black's turn");
    expect(g.movesFrom('e8')).toContain('c8'); // Black may castle queenside
    expect(g.movesFrom('e8')).not.toContain('g8'); // but not kingside

    g.play('e8c8', 'e1g1');
    expect(notations(g)).toEqual(['O-O-O', 'O-O']);
    expect(movetext(g)).toBe('20... O-O-O 21. O-O *');
    expect(g.game.buildFEN()).toBe('2kr3r/8/8/8/8/8/8/R4RK1 b - - 5 21');
    expect(g.game.buildPGN()).toContain('[FEN "r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 20"]');
  });

  test('en passant is possible straight away', () => {
    const g = loadGame();
    g.game.importFEN('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3');
    expect(g.movesFrom('d4')).toContain('e3');
    g.play('d4e3');
    expect(g.at('e4')).toBeNull();
  });

  test('text that is not a position changes nothing', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    const before = g.snapshot();
    expect(g.game.importFEN('8/8/8/8/8/8/8/4K3 w - - 0 1')).toEqual({
      ok: false,
      error: 'A position needs exactly one king of each colour.',
    });
    expect(g.game.importFEN(START_FEN, true)).toEqual({ ok: true }); // Only checked
    expect(g.snapshot()).toEqual(before);
  });

  test('a position that is already decided loads as a finished game', () => {
    const mate = loadGame();
    mate.game.importFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(mate.game.isGameOver).toBe(true);
    expect(mate.game.gameResult).toBe('0-1');
    expect(el(mate, 'game-status').textContent).toBe('Checkmate! Black wins.');

    const stale = loadGame();
    stale.game.importFEN('k7/8/1Q6/8/8/8/8/4K3 b - - 0 1');
    expect(stale.game.gameResult).toBe('1/2-1/2');
    expect(el(stale, 'game-status').textContent).toBe('Stalemate! Game is a draw.');

    const bare = loadGame();
    bare.game.importFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(el(bare, 'game-status').textContent).toBe('Draw by insufficient material.');
  });

  test('undo goes back to the loaded position and no further', () => {
    const g = loadGame();
    const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
    g.game.importFEN(fen);
    g.play('e2e4', 'e8d7');
    g.game.undoLastMove();
    g.game.undoLastMove();
    g.game.undoLastMove();
    expect(g.game.buildFEN()).toBe(fen);
    expect(notations(g)).toEqual([]);
  });

  test('the computer moves first when the position gives it the move', () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.game.importFEN('4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 b - - 0 1');
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(1);
    expect(g.game.currentPlayer).toBe('w');
  });

  test('a loaded position survives a reload before its first move, and after', () => {
    const key = 'chessGameState';
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 20';
    const first = loadGame();
    first.game.importFEN(fen);

    const second = loadGame({ storage: { [key]: first.window.localStorage.getItem(key) } });
    expect(second.game.buildFEN()).toBe(fen);
    second.play('e8c8');

    const third = loadGame({ storage: { [key]: second.window.localStorage.getItem(key) } });
    expect(movetext(third)).toBe('20... O-O-O *');
    third.game.resetGame();
    expect(third.game.buildFEN()).toBe(START_FEN);
  });
});

describe('PGN of a game that began from a position', () => {
  test('exports and loads back to the same game', () => {
    const first = loadGame();
    first.game.importFEN('r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 20');
    first.play('e8c8', 'e1g1', 'c8b8');
    const pgn = first.game.buildPGN();

    const g = loadGame();
    expect(g.game.importPGN(pgn)).toEqual({ ok: true, moves: 3 });
    expect(notations(g)).toEqual(notations(first));
    expect(g.game.buildFEN()).toBe(first.game.buildFEN());
    expect(movetext(g)).toBe('20... O-O-O 21. O-O Kb8 *');

    g.game.viewMove(0);
    expect(g.game.buildFEN()).toBe('r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 20');
  });

  test('a move that cannot be played is named with its real number', () => {
    const g = loadGame();
    const pgn = '[FEN "r3k2r/8/8/8/8/8/8/R3K2R b Kq - 3 20"]\n\n20... O-O-O 21. Ke2 O-O *';
    expect(g.game.importPGN(pgn, true)).toEqual({
      ok: false,
      error: 'Move 21... O-O cannot be played.',
    });
  });

  test('a FEN tag that cannot be read is reported', () => {
    const g = loadGame();
    expect(g.game.importPGN('[FEN "8/8/8 w"]\n\n1. e4', true)).toEqual({
      ok: false,
      error: 'The FEN tag cannot be used. A FEN position needs eight ranks.',
    });
  });

  test('past games that began from a position open again', () => {
    const g = loadGame();
    g.game.importFEN('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    g.play('e2e4', 'e8d7');
    g.game.resetGame();
    g.game.openImportDialog();
    el(g, 'archive-list').querySelector('button').click();
    expect(notations(g)).toEqual(['e4', 'Kd7']);
    expect(g.game.buildFEN()).toBe('8/3k4/8/8/4P3/8/8/4K3 w - - 1 2');
  });
});

describe('the Load dialog with a position', () => {
  test('a pasted FEN starts a game from it', () => {
    const g = loadGame();
    g.game.openImportDialog();
    el(g, 'import-text').value = '  4k3/8/8/8/8/8/4P3/4K3 w - - 0 1\n';
    el(g, 'import-load').click();
    expect(el(g, 'import-dialog').hidden).toBe(true);
    expect(g.game.buildFEN()).toBe('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
  });

  test('a FEN that cannot be used shows why and keeps the game', () => {
    const g = loadGame();
    g.play('e2e4');
    g.game.openImportDialog();
    el(g, 'import-text').value = '4k3/8/8/8/8/8/8/4K2K w - - 0 1';
    el(g, 'import-load').click();
    expect(el(g, 'import-error').textContent).toBe(
      'A position needs exactly one king of each colour. The current game was not changed.'
    );
    expect(el(g, 'import-dialog').hidden).toBe(false);
    expect(notations(g)).toEqual(['e4']);
  });

  test('a game in progress needs a second click before a position replaces it', () => {
    const g = loadGame();
    g.play('e2e4');
    g.game.openImportDialog();
    el(g, 'import-text').value = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
    el(g, 'import-load').click();
    expect(notations(g)).toEqual(['e4']);
    expect(el(g, 'import-load').textContent).toBe('Discard current game?');
    el(g, 'import-load').click();
    expect(notations(g)).toEqual([]);
    expect(g.at('e2').type).toBe('p');
    expect(g.at('d2')).toBeNull();
  });
});
