/**
 * @fileoverview Utility functions for the chess game.
 */

/**
 * Converts algebraic notation (e.g., "e4") to board coordinates.
 * @param {string} algebraic - The algebraic notation (e.g., "a1", "h8").
 * @returns {{row: number, col: number} | null} The 0-indexed row and column, or null if invalid.
 */
function algebraicToCoords(algebraic) {
    if (typeof algebraic !== 'string' || algebraic.length !== 2) {
        console.error("Invalid algebraic notation:", algebraic);
        return null;
    }
    const file = algebraic[0].toLowerCase();
    const rank = algebraic[1];

    const col = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(rank, 10);

    if (col < 0 || col > 7 || isNaN(row) || row < 0 || row > 7) {
        console.error("Invalid algebraic notation coordinates:", algebraic);
        return null;
    }

    return { row, col };
}

/**
 * Converts board coordinates (0-indexed) to algebraic notation.
 * @param {number} row - The 0-indexed row.
 * @param {number} col - The 0-indexed column.
 * @returns {string | null} The algebraic notation (e.g., "a1", "h8"), or null if invalid.
 */
function coordsToAlgebraic(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) {
        console.error("Invalid coordinates:", { row, col });
        return null;
    }
    const file = String.fromCharCode('a'.charCodeAt(0) + col);
    const rank = (8 - row).toString();
    return file + rank;
}

/**
 * Checks if coordinates are within the board bounds.
 * @param {number} row
 * @param {number} col
 * @returns {boolean}
 */
function isWithinBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

/**
 * Creates a deep clone of an object or array.
 * @param {object|array} source - The source object or array to clone.
 * @returns {object|array} A deep clone of the source.
 */
function deepClone(source) {
    if (source === null || typeof source !== 'object') {
        return source;
    }
    
    // Handle Date
    if (source instanceof Date) {
        return new Date(source.getTime());
    }
    
    // Handle Array
    if (Array.isArray(source)) {
        return source.map(item => deepClone(item));
    }
    
    // Handle Object
    const clone = {};
    Object.keys(source).forEach(key => {
        clone[key] = deepClone(source[key]);
    });
    
    return clone;
}

/**
 * Save data to localStorage with error handling.
 * @param {string} key - The key to store under.
 * @param {any} data - Data to store (will be JSON serialized).
 * @returns {boolean} True if successful, false if failed.
 */
function saveToLocalStorage(key, data) {
    try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
        return true;
    } catch (err) {
        console.error('Error saving to localStorage:', err);
        return false;
    }
}

/**
 * Load data from localStorage with error handling.
 * @param {string} key - The key to retrieve.
 * @param {any} defaultValue - Default value if key doesn't exist or error occurs.
 * @returns {any} The retrieved data or defaultValue.
 * @exports loadFromLocalStorage
 */
// eslint-disable-next-line no-unused-vars
function loadFromLocalStorage(key, defaultValue = null) {
    try {
        const serialized = localStorage.getItem(key);
        if (serialized === null) {
            return defaultValue;
        }
        return JSON.parse(serialized);
    } catch (err) {
        console.error('Error loading from localStorage:', err);
        return defaultValue;
    }
}

let audioContext = null; // Created on first use; browsers require a user gesture first

/**
 * Plays a short synthesized sound for a game event. The tones are generated
 * with the Web Audio API, so no audio files are needed.
 * @param {string} soundType - 'move', 'capture', 'check', 'castle', 'promote' or 'game_end'.
 * @exports playSound
 */
function playSound(soundType) {
    if (!CONFIG.FEATURES.SOUND_EFFECTS) return;

    const tones = CONFIG.SOUNDS[soundType.toUpperCase()];
    if (!tones) return;

    const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) return; // No audio support (old browser, test environment)

    try {
        audioContext = audioContext || new AudioContextClass();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        let startTime = audioContext.currentTime;
        for (const tone of tones) {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = tone.wave || 'sine';
            oscillator.frequency.value = tone.frequency;
            // Quick fade-out so each tone ends without a click
            gain.gain.setValueAtTime(CONFIG.SOUND_VOLUME, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + tone.duration);
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(startTime);
            oscillator.stop(startTime + tone.duration);
            startTime += tone.duration;
        }
    } catch (err) {
        console.error('Error playing sound:', err);
    }
}

/**
 * Debug logging function that only logs when debug mode is enabled.
 * @param {...any} args - Arguments to log.
 * @exports debugLog
 */
function debugLog(...args) {
    if (CONFIG.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        algebraicToCoords,
        coordsToAlgebraic,
        isWithinBounds,
        deepClone,
        saveToLocalStorage,
        loadFromLocalStorage,
        playSound,
        debugLog
    };
} 