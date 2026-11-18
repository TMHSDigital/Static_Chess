/**
 * @fileoverview Web Worker that runs the engine off the main thread, so the
 * page stays responsive while it thinks. engine-bridge.js posts
 * { id, position, color, level, seen, budgetMs } and gets { id, move } back,
 * or posts { id, assess: [{ position, color }, ...] } and gets { id, scores }
 * back, one assessPosition result per position. Every answer also carries
 * protocol: CONFIG.ENGINE_PROTOCOL, so a page from another release can tell.
 */

/* global importScripts, CONFIG, chooseAIMove, assessPosition */
importScripts('config.js', 'utils.js', 'pieces.js', 'rules.js', 'ai.js');

self.onmessage = (event) => {
    const { id, position, color, level, seen, budgetMs, assess } = event.data;
    if (assess) {
        self.postMessage({
            id,
            protocol: CONFIG.ENGINE_PROTOCOL,
            scores: assess.map((entry) => assessPosition(entry.position, entry.color)),
        });
        return;
    }
    // Off the page's thread there is no harm in using the level's thinking time,
    // or the time the clock allows for this move
    self.postMessage({
        id,
        protocol: CONFIG.ENGINE_PROTOCOL,
        move: chooseAIMove(position, color, level, Math.random, { timed: true, seen, budgetMs }),
    });
};
