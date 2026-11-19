/**
 * game-ui.js draws what it is told and holds no game: these tests load it
 * without game.js and hand it plain values.
 */

const { JSDOM } = globalThis; // Provided by tests/helpers/jsdom-environment.js

const HTML = `<!DOCTYPE html><body>
  <ul id="move-history"></ul>
  <div id="step-buttons">
    <button data-step="first"></button><button data-step="previous"></button>
    <button data-step="next"></button><button data-step="last"></button>
  </div>
  <div id="side-black"><span class="side-name">Black</span><span class="thinking" hidden></span></div>
  <div id="side-white"><span class="side-name">White</span><span class="thinking" hidden></span></div>
  <div id="captured-by-black"></div><div id="captured-by-white"></div>
  <span id="clock-black" hidden></span><span id="clock-white" hidden></span>
  <div id="status-bar"><div id="game-status"></div>
    <div id="result-actions" hidden><button id="review-button"></button><button id="again-button"></button></div>
  </div>
  <p id="review-score" hidden></p>
  <div id="review-actions" hidden><button id="live-button" hidden></button></div>
  <button id="hint-button">Hint</button><button id="draw-button">Offer draw</button>
  <button id="resign-button">Resign</button><button id="undo-button">Undo</button>
  <button id="pgn-button">Copy PGN</button><button id="download-button">Save PGN</button>
  <button id="reset-button">New Game</button>
  <button id="import-button">Load</button>
  <div id="import-dialog" hidden>
    <textarea id="import-text"></textarea><p id="import-error"></p>
    <button id="import-cancel">Cancel</button><button id="import-load">Load game</button>
  </div>
  <details id="more-settings"><summary>Settings</summary></details>
</body>`;

let ui;
let page;
const el = (id) => page.document.getElementById(id);

beforeEach(() => {
  jest.resetModules();
  page = new JSDOM(HTML, { url: 'http://localhost' }).window;
  global.document = page.document;
  for (const name of ['config', 'utils', 'pieces', 'rules', 'clock']) {
    Object.assign(global, require(`../../js/${name}`));
  }
  ui = require('../../js/game-ui');
});

afterEach(() => {
  page.close();
  delete global.document;
});

const view = (changes = {}) => ({
  reviewing: false,
  gameOver: false,
  canReview: true,
  canView: true,
  shownPly: 3,
  moveCount: 3,
  canUndo: true,
  inProgress: true,
  canHint: true,
  hintPending: false,
  drawOffered: false,
  ...changes,
});

describe('game-ui.js without a game', () => {
  test('draws the move list from plain values', () => {
    const moves = [
      { notation: 'f3', number: 1, white: true, cost: null },
      { notation: 'e5', number: 1, white: false, cost: null },
      {
        notation: 'g4',
        number: 2,
        white: true,
        cost: 'Engine thinks 2. g4 allowed a forced mate.',
      },
    ];
    ui.renderMoveList(moves, { shownPly: 2, canView: true, live: false });

    const rows = [...el('move-history').children];
    expect(rows.map((row) => row.textContent)).toEqual(['1.f3e5', '2.g4']);
    expect(rows[1].classList.contains('last-move-entry')).toBe(true);
    const buttons = [...el('move-history').querySelectorAll('button')];
    expect(buttons.map((button) => button.dataset.ply)).toEqual(['1', '2', '3']);
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, 0, -1]); // One tab stop
    expect(buttons[1].getAttribute('aria-current')).toBe('true');
    expect(buttons[2].classList.contains('lost-ground')).toBe(true);
    expect(buttons[2].title).toBe('Engine thinks 2. g4 allowed a forced mate.');
    expect(buttons[0].hasAttribute('title')).toBe(false);
  });

  test('a game that began with Black to move leaves a gap in the first row', () => {
    ui.renderMoveList([{ notation: 'Kd7', number: 5, white: false, cost: null }], {
      shownPly: 1,
      canView: false,
      live: true,
    });
    expect(el('move-history').textContent).toBe('5....Kd7');
    expect(el('move-history').querySelector('button').disabled).toBe(true);
  });

  test('switches the buttons by what it is told', () => {
    ui.renderControls(view());
    expect(el('undo-button').disabled).toBe(false);
    expect(el('hint-button').disabled).toBe(false);
    expect(el('review-score').hidden).toBe(true);
    const step = (name) => el('step-buttons').querySelector(`[data-step="${name}"]`).disabled;
    expect([step('first'), step('previous'), step('next'), step('last')]).toEqual([
      false,
      false,
      true,
      true,
    ]);

    ui.renderControls(
      view({
        reviewing: true,
        shownPly: 0,
        canUndo: false,
        inProgress: false,
        canHint: false,
        hintPending: true,
        drawOffered: true,
      })
    );
    expect(el('undo-button').disabled).toBe(true);
    expect(el('resign-button').disabled).toBe(true);
    expect(el('hint-button').textContent).toBe('Thinking');
    expect(el('draw-button').textContent).toBe('Accept draw?');
    expect(el('draw-button').classList.contains('confirming')).toBe(true);
    expect(el('review-score').hidden).toBe(false);
    expect(el('live-button').hidden).toBe(false);
    expect([step('first'), step('previous'), step('next'), step('last')]).toEqual([
      true,
      true,
      false,
      false,
    ]);

    ui.renderControls(view({ moveCount: 0, shownPly: 0 }));
    expect(el('pgn-button').disabled).toBe(true);
    expect(el('download-button').disabled).toBe(true);
  });

  test('a finished game gets a marked status bar and what to do next', () => {
    ui.renderControls(view());
    expect(el('result-actions').hidden).toBe(true);
    expect(el('status-bar').classList.contains('is-over')).toBe(false);

    ui.renderControls(view({ gameOver: true }));
    expect(el('result-actions').hidden).toBe(false);
    expect(el('status-bar').classList.contains('is-over')).toBe(true);
    expect(el('review-button').hidden).toBe(false);

    // Looking back on it: the buttons keep their room, out of sight, so the bar keeps its height
    ui.renderControls(view({ reviewing: true, finished: true }));
    expect(el('result-actions').hidden).toBe(false);
    expect(el('result-actions').classList.contains('holds-place')).toBe(true);
    expect(el('status-bar').classList.contains('is-over')).toBe(false);
    // Looking back on a game still going on: there is no result to keep room for
    ui.renderControls(view({ reviewing: true, finished: false }));
    expect(el('result-actions').hidden).toBe(true);
    expect(el('result-actions').classList.contains('holds-place')).toBe(false);

    // A game that ended before a move, or without the positions behind its moves
    ui.renderControls(view({ gameOver: true, canReview: false }));
    expect(el('review-button').hidden).toBe(true);
    expect(el('result-actions').hidden).toBe(false);

    const calls = [];
    ui.bindControls({ review: () => calls.push('review'), reset: () => calls.push('reset') });
    el('review-button').click();
    el('again-button').click();
    expect(calls).toEqual(['review', 'reset']);
  });

  test('hands page-wide keys to the game, except on the board, in fields and in dialogs', () => {
    const keys = [];
    ui.bindControls({
      pageKey: (key) => {
        keys.push(key);
        return key !== 'x'; // The game has no use for "x"
      },
    });
    const press = (target, key, init = {}) => {
      const event = new page.KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const add = (html) => {
      page.document.body.insertAdjacentHTML('beforeend', html);
      return page.document.body.lastElementChild;
    };

    expect(press(page.document.body, 'ArrowLeft')).toBe(true); // Used, so the page does not scroll
    expect(press(el('hint-button'), 'ArrowRight')).toBe(true);
    expect(press(page.document.body, 'x')).toBe(false); // Offered, not used
    expect(keys).toEqual(['ArrowLeft', 'ArrowRight', 'x']);

    keys.length = 0;
    const board = add('<div id="chess-board"><div class="square" tabindex="0"></div></div>');
    const field = add('<select><option>a</option></select>');
    const dialog = add('<div role="dialog"><button>Queen</button></div>');
    press(board.firstElementChild, 'ArrowLeft'); // Moves between squares
    press(field, 'ArrowRight'); // Changes the setting
    press(dialog.firstElementChild, 'Escape'); // Closes the dialog
    press(page.document.body, 'ArrowLeft', { ctrlKey: true }); // A browser shortcut
    expect(keys).toEqual([]);

    // A key the move list has already used is not used twice
    el('move-history').addEventListener('keydown', (event) => event.preventDefault());
    press(el('move-history'), 'ArrowLeft');
    expect(keys).toEqual([]);
  });

  test('Settings is brought into view when it is opened, not when it is closed', () => {
    const settings = el('more-settings');
    settings.scrollIntoView = jest.fn();
    ui.bindControls({});
    const toggle = (open) => {
      settings.open = open;
      settings.dispatchEvent(new page.Event('toggle'));
    };

    toggle(true);
    expect(settings.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(settings.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    toggle(false);
    expect(settings.scrollIntoView).toHaveBeenCalledTimes(1);

    delete settings.scrollIntoView; // A browser without it: nothing happens, nothing breaks
    settings.scrollIntoView = undefined;
    expect(() => toggle(true)).not.toThrow();
  });

  test('names the players, marks the side to move and shows who is thinking', () => {
    const name = (id) => el(id).querySelector('.side-name').textContent;
    const thinking = (id) => !el(id).querySelector('.thinking').hidden;
    ui.renderPlayers({
      w: { name: 'You', toMove: false, thinking: false },
      b: { name: 'Computer (hard)', toMove: true, thinking: true },
    });
    expect([name('side-white'), name('side-black')]).toEqual(['You', 'Computer (hard)']);
    expect(el('side-black').classList.contains('to-move')).toBe(true);
    expect(el('side-white').classList.contains('to-move')).toBe(false);
    expect([thinking('side-white'), thinking('side-black')]).toEqual([false, true]);

    ui.renderPlayers({
      w: { name: 'White', toMove: true, thinking: false },
      b: { name: 'Black', toMove: false, thinking: false },
    });
    expect(el('side-white').classList.contains('to-move')).toBe(true);
    expect(el('side-black').classList.contains('to-move')).toBe(false);
    expect(thinking('side-black')).toBe(false);
  });

  test('shows the clocks it is given and hides them when there are none', () => {
    ui.renderClocks({ w: { left: 65000, running: true }, b: { left: 9400, running: false } });
    expect(el('clock-white').hidden).toBe(false);
    expect(el('clock-white').textContent).toBe('1:05');
    expect(el('clock-white').classList.contains('running')).toBe(true);
    expect(el('clock-white').classList.contains('low')).toBe(false);
    expect(el('clock-black').textContent).toBe('0:09.4');
    expect(el('clock-black').classList.contains('low')).toBe(true);
    expect(el('clock-black').getAttribute('aria-label')).toBe('Black clock: 0:09.4');

    ui.renderClocks(null);
    expect(el('clock-white').hidden).toBe(true);
    expect(el('clock-black').hidden).toBe(true);
  });

  test('lists captured pieces in order of value with the lead', () => {
    const taken = { w: ['q', 'p', 'p'], b: ['n'] };
    ui.renderCaptured(taken, 8);
    expect(el('captured-by-white').querySelectorAll('.captured-piece')).toHaveLength(3);
    expect(el('captured-by-white').querySelector('.material-lead').textContent).toBe('+8');
    expect(el('captured-by-white').getAttribute('aria-label')).toBe(
      'White has captured 2 pawns, queen. White is ahead by 8.'
    );
    expect(el('captured-by-black').querySelector('.material-lead')).toBeNull();
    expect(el('captured-by-black').getAttribute('aria-label')).toBe('Black has captured knight.');
    expect(taken.w).toEqual(['q', 'p', 'p']); // What it was given is left as it was
  });

  test('status, review line and announcements are plain text in, text on the page', () => {
    ui.renderStatus("Black's turn");
    ui.renderReviewScore('Engine thinks the position is about equal.');
    expect(el('game-status').textContent).toBe("Black's turn");
    expect(el('review-score').textContent).toBe('Engine thinks the position is about equal.');

    expect(el('announcer')).toBeNull(); // This page has no live region yet
    ui.announce('White pawn to e4.');
    expect(el('announcer').getAttribute('aria-live')).toBe('polite');
    expect(el('announcer').textContent).toBe('White pawn to e4.');
  });

  test('a button that asks twice confirms on the second click and can be withdrawn', () => {
    jest.useFakeTimers();
    const button = el('resign-button');
    expect(ui.confirmSecondClick(button, 'Resign?')).toBe(false);
    expect(button.textContent).toBe('Resign?');
    expect(ui.confirmSecondClick(button, 'Resign?')).toBe(true);
    expect(button.textContent).toBe('Resign');

    ui.confirmSecondClick(button, 'Resign?');
    ui.cancelConfirms();
    expect(button.textContent).toBe('Resign');
    expect(button.classList.contains('confirming')).toBe(false);

    ui.confirmSecondClick(button, 'Resign?');
    jest.advanceTimersByTime(global.CONFIG.CONFIRM_MS);
    expect(button.textContent).toBe('Resign'); // The question lapses
    jest.useRealTimers();
  });

  test('the Load dialog asks the game it is given, and needs no game.js', () => {
    jest.useFakeTimers();
    const asked = [];
    let inProgress = true;
    let answer = { ok: true };
    ui.bindControls({
      importGame: (text, validateOnly = false) => {
        asked.push([text, validateOnly]);
        return answer;
      },
      isGameInProgress: () => inProgress,
      openArchivedGame: () => ({ ok: true }),
    });
    el('import-dialog').hidden = false;
    el('import-text').value = '1. e4';

    el('import-load').click(); // Checked, then a question: a game is in progress
    expect(asked).toEqual([['1. e4', true]]);
    expect(el('import-load').textContent).toBe('Replace current game?');
    el('import-load').click();
    expect(asked).toEqual([
      ['1. e4', true],
      ['1. e4', true],
      ['1. e4', false],
    ]);
    expect(el('import-dialog').hidden).toBe(true);

    inProgress = false;
    answer = { ok: false, error: 'Move 1. e9 cannot be played.' };
    el('import-dialog').hidden = false;
    el('import-text').value = '1. e9';
    el('import-load').click();
    expect(el('import-error').textContent).toBe(
      'Move 1. e9 cannot be played. The current game was not changed.'
    );
    expect(el('import-dialog').hidden).toBe(false);
    jest.useRealTimers();
  });

  test('asks and notifies on buttons by what they do, with their own labels', () => {
    jest.useFakeTimers();
    expect(ui.askToConfirm('resign', 'Resign?')).toBe(false);
    expect(el('resign-button').textContent).toBe('Resign?');
    ui.withdrawQuestion('resign');
    expect(el('resign-button').textContent).toBe('Resign');
    expect(ui.askToConfirm('reset', 'Discard game?')).toBe(false);
    expect(ui.askToConfirm('reset', 'Discard game?')).toBe(true);
    expect(el('reset-button').textContent).toBe('New Game');

    ui.notifyOnButton('download', 'Saved');
    expect(el('download-button').textContent).toBe('Saved');
    jest.advanceTimersByTime(global.CONFIG.NOTICE_MS);
    expect(el('download-button').textContent).toBe('Save PGN');

    // A button the page does not have: nothing to ask, nothing to show
    expect(ui.askToConfirm('playHere', 'Drop later moves?')).toBe(true);
    expect(() => ui.withdrawQuestion('playHere')).not.toThrow();
    expect(() => ui.notifyOnButton('fen', 'Copied!')).not.toThrow();
    expect(() => ui.copyFromButton('link', 'text', 'file.txt')).not.toThrow();
    jest.useRealTimers();
  });

  test('connects each control once, however often it is asked to', () => {
    const calls = [];
    const handlers = {};
    for (const name of [
      'moveListClick',
      'moveListKeydown',
      'live',
      'playHere',
      'step',
      'resign',
      'draw',
      'hint',
      'reset',
      'review',
      'copyPGN',
      'downloadPGN',
      'copyFEN',
      'undo',
    ]) {
      handlers[name] = () => calls.push(name);
    }
    ui.bindControls({ ...handlers, undoOffered: true });
    ui.bindControls({ ...handlers, undoOffered: true });
    for (const id of [
      'resign-button',
      'hint-button',
      'undo-button',
      'reset-button',
      'move-history',
    ]) {
      el(id).click();
    }
    expect(calls).toEqual(['resign', 'hint', 'undo', 'reset', 'moveListClick']);

    ui.bindControls({ ...handlers, undoOffered: false });
    expect(el('undo-button').hidden).toBe(true);
    calls.length = 0;
    el('undo-button').click();
    expect(calls).toEqual([]);
  });
});
