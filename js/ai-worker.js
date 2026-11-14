/**
 * @fileoverview Web Worker that runs the computer opponent's search off the
 * main thread, so the page stays responsive while it thinks. game.js posts
 * { id, position, color, level, seen } and gets { id, move } back.
 */

/* global importScripts, chooseAIMove */
importScripts('config.js', 'utils.js', 'pieces.js', 'rules.js', 'ai.js');

self.onmessage = (event) => {
    const { id, position, color, level, seen } = event.data;
    // Off the page's thread there is no harm in using the level's thinking time
    self.postMessage({
        id,
        move: chooseAIMove(position, color, level, Math.random, { timed: true, seen }),
    });
};
