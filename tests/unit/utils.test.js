const { JSDOM } = globalThis; // Provided by tests/helpers/jsdom-environment.js

describe('utils', () => {
  let algebraicToCoords, coordsToAlgebraic, isWithinBounds;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`, { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    // Set up CONFIG global before requiring utils
    const config = require('../../js/config');
    global.CONFIG = config.CONFIG;

    ({ algebraicToCoords, coordsToAlgebraic, isWithinBounds } = require('../../js/utils'));

    // Invalid input is reported with console.error; keep the test output clean
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('coordsToAlgebraic and algebraicToCoords round-trip', () => {
    const positions = ['a1', 'h8', 'e4', 'b7'];
    positions.forEach((alg) => {
      const c = algebraicToCoords(alg);
      const back = coordsToAlgebraic(c.row, c.col);
      expect(back).toBe(alg);
    });
  });

  test('algebraicToCoords rejects squares that are not on the board', () => {
    for (const bad of ['i1', 'a9', 'a0', '', null, undefined, 'e44', 42]) {
      expect(algebraicToCoords(bad)).toBeNull();
    }
  });

  test('algebraicToCoords accepts an upper-case file', () => {
    expect(algebraicToCoords('E4')).toEqual({ row: 4, col: 4 });
  });

  test('coordsToAlgebraic rejects coordinates off the board', () => {
    expect(coordsToAlgebraic(8, 0)).toBeNull();
    expect(coordsToAlgebraic(-1, 0)).toBeNull();
    expect(coordsToAlgebraic(0, 8)).toBeNull();
  });

  test('isWithinBounds at the edges', () => {
    expect(isWithinBounds(0, 0)).toBe(true);
    expect(isWithinBounds(7, 7)).toBe(true);
    expect(isWithinBounds(-1, 0)).toBe(false);
    expect(isWithinBounds(0, 8)).toBe(false);
    expect(isWithinBounds(8, 0)).toBe(false);
  });

  describe('storage', () => {
    let readStored, writeStored, removeStored;
    beforeEach(() => {
      ({ readStored, writeStored, removeStored } = require('../../js/utils'));
    });

    test('reads back what was written, and null once it is removed', () => {
      expect(readStored('colour')).toBeNull();
      expect(writeStored('colour', 'green')).toBe(true);
      expect(readStored('colour')).toBe('green');
      expect(removeStored('colour')).toBe(true);
      expect(readStored('colour')).toBeNull();
    });

    test('blocked storage reads as empty and never throws', () => {
      const blocked = () => {
        throw new Error('storage is blocked');
      };
      global.localStorage = { getItem: blocked, setItem: blocked, removeItem: blocked };
      expect(readStored('colour')).toBeNull();
      expect(writeStored('colour', 'green')).toBe(false);
      expect(removeStored('colour')).toBe(false);
    });
  });
});

describe('playSound', () => {
  /** A stand-in for the Web Audio API that records what it is asked to play. */
  function fakeAudio({ state = 'running', broken = false } = {}) {
    const made = { contexts: 0, oscillators: [], resumed: 0 };
    class FakeAudioContext {
      constructor() {
        if (broken) throw new Error('Audio is not allowed here');
        made.contexts++;
        this.state = state;
        this.currentTime = 10;
        this.destination = {};
      }

      resume() {
        made.resumed++;
      }

      createOscillator() {
        const oscillator = {
          frequency: {},
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        };
        made.oscillators.push(oscillator);
        return oscillator;
      }

      createGain() {
        return {
          gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
          connect: jest.fn(),
        };
      }
    }
    return { made, FakeAudioContext };
  }

  /** Loads a fresh utils.js with sound switched on and the given audio stand-in. */
  function soundOn(audio) {
    jest.resetModules();
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`, { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    if (audio) dom.window.AudioContext = audio.FakeAudioContext;
    const { CONFIG } = require('../../js/config');
    CONFIG.FEATURES.SOUND_EFFECTS = true;
    global.CONFIG = CONFIG;
    return { CONFIG, playSound: require('../../js/utils').playSound };
  }

  afterEach(() => jest.restoreAllMocks());

  test('plays one tone after another, as the settings describe the sound', () => {
    const audio = fakeAudio();
    const { CONFIG, playSound } = soundOn(audio);
    playSound('check');

    const tones = CONFIG.SOUNDS.CHECK;
    expect(tones.length).toBeGreaterThan(1);
    expect(audio.made.oscillators).toHaveLength(tones.length);
    expect(audio.made.oscillators.map((o) => o.frequency.value)).toEqual(
      tones.map((tone) => tone.frequency)
    );
    // Each tone starts where the one before it ends
    expect(audio.made.oscillators[0].start).toHaveBeenCalledWith(10);
    expect(audio.made.oscillators[0].stop).toHaveBeenCalledWith(10 + tones[0].duration);
    expect(audio.made.oscillators[1].start).toHaveBeenCalledWith(10 + tones[0].duration);
    expect(audio.made.oscillators[0].type).toBe(tones[0].wave || 'sine');

    playSound('move');
    expect(audio.made.oscillators).toHaveLength(tones.length + CONFIG.SOUNDS.MOVE.length);
    expect(audio.made.contexts).toBe(1); // One audio context serves every sound
  });

  test('is silent when sound effects are off, and for a name it does not know', () => {
    const audio = fakeAudio();
    const { CONFIG, playSound } = soundOn(audio);
    playSound('no_such_sound');
    CONFIG.FEATURES.SOUND_EFFECTS = false;
    playSound('move');
    expect(audio.made.contexts).toBe(0);
    expect(audio.made.oscillators).toHaveLength(0);
  });

  test('wakes a suspended audio context', () => {
    const audio = fakeAudio({ state: 'suspended' });
    const { playSound } = soundOn(audio);
    playSound('move');
    expect(audio.made.resumed).toBe(1);
    expect(audio.made.oscillators).toHaveLength(1);
  });

  test('audio that cannot be started does not stop the game', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { playSound } = soundOn(fakeAudio({ broken: true }));
    expect(() => playSound('move')).not.toThrow();
    expect(errors).toHaveBeenCalledTimes(1);
  });

  test('does nothing where there is no audio support', () => {
    const { playSound } = soundOn(null);
    expect(() => playSound('move')).not.toThrow();
  });

  test('every sound the game asks for is defined in the settings', () => {
    const fs = require('fs');
    const path = require('path');
    const { CONFIG } = soundOn(null);
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'game.js'), 'utf8');
    const names = [...source.matchAll(/playSound\('([^']+)'\)/g)].map((match) => match[1]);
    expect(new Set(names).size).toBeGreaterThanOrEqual(7);
    for (const name of names) {
      expect([name, Array.isArray(CONFIG.SOUNDS[name.toUpperCase()])]).toEqual([name, true]);
    }
    // And nothing is defined that the game never plays
    expect(Object.keys(CONFIG.SOUNDS).sort()).toEqual(
      [...new Set(names)].map((name) => name.toUpperCase()).sort()
    );
  });
});
