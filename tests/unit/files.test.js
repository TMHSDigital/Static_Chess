const { loadGame } = require('../helpers/load-game');

const el = (g, id) => g.window.document.getElementById(id);
const notations = (g) => g.game.moveHistory.map((move) => move.notation);
const GAME = '[Event "Club night"]\n\n1. e4 e5 2. Nf3 Nc6 {White resigned. Black wins.} 0-1\n';

const reads = []; // Every file read the page has started and the test not yet waited for

/** A game whose files note each read they start, so a test can wait for it. */
function loadWatched() {
  const g = loadGame();
  const text = g.window.File.prototype.text;
  g.window.File.prototype.text = function () {
    const read = text.call(this);
    reads.push(read);
    return read;
  };
  return g;
}

/** Waits until every file read started so far has been handed to the page. */
async function fileRead() {
  await Promise.allSettled(reads.splice(0));
}

/** Puts a file into the hidden file input, as the browser's file chooser does. */
function chooseFile(g, name, content) {
  const file = new g.window.File([content], name, { type: 'application/x-chess-pgn' });
  const input = el(g, 'import-file');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new g.window.Event('change'));
}

/** Fires a drag event over the Load dialog that carries files, or dragged text. */
function drag(g, type, files, kind = 'Files') {
  const event = new g.window.Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = { types: [kind], files };
  el(g, 'import-dialog').dispatchEvent(event);
  return event;
}

describe('opening a file', () => {
  test('Open file opens the file chooser', () => {
    const g = loadWatched();
    el(g, 'import-button').click();
    const opened = jest.fn();
    el(g, 'import-file').addEventListener('click', opened);
    el(g, 'import-file-button').click();
    expect(opened).toHaveBeenCalledTimes(1);
  });

  test('a chosen file fills the box, and Load then works as for pasted text', async () => {
    const g = loadWatched();
    g.play('d2d4');
    el(g, 'import-button').click();
    chooseFile(g, 'club-night.pgn', GAME);
    await fileRead();

    expect(el(g, 'import-text').value).toBe(GAME);
    expect(notations(g)).toEqual(['d4']); // Nothing is loaded until Load is pressed
    expect(g.window.document.activeElement).toBe(el(g, 'import-load'));

    el(g, 'import-load').click();
    expect(el(g, 'import-load').textContent).toBe('Discard current game?');
    el(g, 'import-load').click();
    expect(notations(g)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(g.game.gameResult).toBe('0-1');
    expect(el(g, 'import-dialog').hidden).toBe(true);
    expect(el(g, 'import-file').value).toBe(''); // The same file can be chosen again
  });

  test('a file with a move that cannot be played is reported when Load is pressed', async () => {
    const g = loadWatched();
    el(g, 'import-button').click();
    chooseFile(g, 'broken.pgn', '1. e4 e5 2. Qh7');
    await fileRead();
    el(g, 'import-load').click();
    expect(el(g, 'import-error').textContent).toBe(
      'Move 2. Qh7 cannot be played. The current game was not changed.'
    );
  });

  test('a position file is read like a pasted FEN', async () => {
    const g = loadWatched();
    el(g, 'import-button').click();
    chooseFile(g, 'ending.fen', '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1\n');
    await fileRead();
    el(g, 'import-load').click();
    expect(g.game.buildFEN()).toBe('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
  });

  test('a file that is far too large is refused without being read', async () => {
    const g = loadWatched();
    el(g, 'import-button').click();
    el(g, 'import-text').value = '1. e4';
    chooseFile(g, 'everything.pgn', 'x'.repeat(global.CONFIG.IMPORT_MAX_LENGTH + 1));
    await fileRead();
    expect(el(g, 'import-error').textContent).toBe(
      'That text is too long to be a game (over 200,000 characters).'
    );
    expect(el(g, 'import-text').value).toBe('1. e4');
  });

  test('a file dropped on the dialog fills the box', async () => {
    const g = loadWatched();
    el(g, 'import-button').click();
    const file = new g.window.File([GAME], 'club-night.pgn');

    const over = drag(g, 'dragover', [file]);
    expect(over.defaultPrevented).toBe(true); // Tells the browser a drop is welcome
    const dropped = drag(g, 'drop', [file]);
    expect(dropped.defaultPrevented).toBe(true); // Or the browser would open the file itself
    await fileRead();
    expect(el(g, 'import-text').value).toBe(GAME);
  });

  test('a file that cannot be read says so', async () => {
    const g = loadWatched();
    el(g, 'import-button').click();
    const file = new g.window.File(['1. e4'], 'gone.pgn');
    file.text = () => {
      const read = Promise.reject(new Error('The file was moved'));
      reads.push(read);
      return read;
    };
    drag(g, 'drop', [file]);
    await fileRead();
    expect(el(g, 'import-error').textContent).toBe('That file could not be read.');
    expect(el(g, 'import-text').value).toBe('');
  });

  test('dragged text is left to the text box', () => {
    const g = loadWatched();
    el(g, 'import-button').click();
    expect(drag(g, 'dragover', [], 'text/plain').defaultPrevented).toBe(false);
    expect(drag(g, 'drop', [], 'text/plain').defaultPrevented).toBe(false);
  });
});

describe('saving the game as a file', () => {
  /** Stands in for the browser's download: records what was offered and under which name. */
  function watchDownloads(g) {
    const saved = [];
    const blobs = new Map();
    global.URL.createObjectURL = (blob) => {
      const url = `blob:test/${blobs.size}`;
      blobs.set(url, blob);
      return url;
    };
    global.URL.revokeObjectURL = jest.fn();
    g.window.HTMLAnchorElement.prototype.click = function click() {
      saved.push({ name: this.download, blob: blobs.get(this.href) });
    };
    return saved;
  }

  afterEach(() => {
    delete global.URL.createObjectURL;
    delete global.URL.revokeObjectURL;
    delete global.navigator;
    jest.useRealTimers();
  });

  test('Save PGN is off until there is a move', () => {
    const g = loadWatched();
    expect(el(g, 'download-button').disabled).toBe(true);
    g.play('e2e4');
    expect(el(g, 'download-button').disabled).toBe(false);
    g.game.undoLastMove();
    expect(el(g, 'download-button').disabled).toBe(true);
  });

  test('saves static-chess-game.pgn although the clipboard is available', async () => {
    jest.useFakeTimers();
    const g = loadWatched();
    const saved = watchDownloads(g);
    const writeText = jest.fn(() => Promise.resolve());
    global.navigator = { clipboard: { writeText } };
    g.play('e2e4', 'e7e5');

    el(g, 'download-button').click();
    expect(writeText).not.toHaveBeenCalled();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('static-chess-game.pgn');
    expect(saved[0].blob.size).toBe(g.game.buildPGN().length);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/0');
    expect(g.window.document.querySelector('a[download]')).toBeNull(); // The link is not left behind

    expect(el(g, 'download-button').textContent).toBe('Saved');
    jest.advanceTimersByTime(1500);
    expect(el(g, 'download-button').textContent).toBe('Save PGN');
  });

  test('the Copied notice gives way to the label again', async () => {
    jest.useFakeTimers();
    const g = loadWatched();
    global.navigator = { clipboard: { writeText: jest.fn(() => Promise.resolve()) } };
    g.play('e2e4');
    el(g, 'pgn-button').click();
    await Promise.resolve();
    expect(el(g, 'pgn-button').textContent).toBe('Copied!');
    jest.advanceTimersByTime(1499);
    expect(el(g, 'pgn-button').textContent).toBe('Copied!');
    jest.advanceTimersByTime(1);
    expect(el(g, 'pgn-button').textContent).toBe('Copy PGN');
  });

  test('Copy FEN copies the position on screen, also while looking back', async () => {
    jest.useFakeTimers();
    const g = loadWatched();
    const writeText = jest.fn(() => Promise.resolve());
    global.navigator = { clipboard: { writeText } };
    g.play('e2e4', 'e7e5');

    el(g, 'fen-button').click();
    await Promise.resolve();
    expect(writeText).toHaveBeenLastCalledWith(g.game.buildFEN());
    expect(writeText.mock.calls[0][0]).toContain(' w KQkq e6 0 2');
    expect(el(g, 'fen-button').textContent).toBe('Copied!');
    jest.advanceTimersByTime(1500);
    expect(el(g, 'fen-button').textContent).toBe('Copy FEN');

    g.game.viewMove(1); // After 1. e4
    el(g, 'fen-button').click();
    await Promise.resolve();
    expect(writeText).toHaveBeenLastCalledWith(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    );
  });

  test('Copy PGN uses the clipboard when it can, and a file when it cannot', async () => {
    const g = loadWatched();
    const saved = watchDownloads(g);
    g.play('e2e4', 'e7e5');

    const writeText = jest.fn(() => Promise.resolve());
    global.navigator = { clipboard: { writeText } };
    el(g, 'pgn-button').click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(g.game.buildPGN());
    expect(el(g, 'pgn-button').textContent).toBe('Copied!');
    expect(saved).toHaveLength(0);

    global.navigator = { clipboard: { writeText: () => Promise.reject(new Error('denied')) } };
    el(g, 'pgn-button').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(saved.map((file) => file.name)).toEqual(['static-chess-game.pgn']);
    expect(el(g, 'pgn-button').textContent).toBe('Downloaded');
    expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(g.window.document.querySelector('a[download]')).toBeNull(); // The link is removed again

    delete global.navigator; // A page opened from a file has no clipboard at all
    el(g, 'fen-button').click();
    expect(saved.map((file) => file.name)).toEqual([
      'static-chess-game.pgn',
      'static-chess-position.fen',
    ]);
    // Each file is offered as what it is
    expect(saved.map((file) => file.blob.type)).toEqual(['application/x-chess-pgn', 'text/plain']);
  });
});
