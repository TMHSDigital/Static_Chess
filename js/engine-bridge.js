/**
 * @fileoverview The way from the page to the engine in ai.js. A request is
 * answered by a Web Worker (ai-worker.js), so the page stays responsive, or
 * on the page itself where a worker is not available. Only the latest request
 * counts: asking again, or dropEngineRequests(), makes an earlier answer
 * void. Nothing here knows about the game being played.
 */

let engineRequestId = 0; // Goes up with every request and whenever pending ones are dropped
let engineWorker = null; // The Web Worker, or false once it has proved unavailable
let engineWorkerBusy = false; // True from a request to the worker until its answer

/**
 * Stops a search the worker is still running. A worker cannot be interrupted,
 * so it is shut down and a new one is started with the next request; that
 * request then does not have to wait for a search nobody wants any more.
 */
function stopWorkerSearch() {
    if (engineWorker && engineWorkerBusy) {
        engineWorker.terminate();
        engineWorker = null;
    }
    engineWorkerBusy = false;
}

/** @returns {Worker|null} The search worker, or null where workers are not available. */
function getAIWorker() {
    if (engineWorker === null) {
        try {
            engineWorker = typeof Worker === 'function' ? new Worker('js/ai-worker.js') : false;
        } catch {
            engineWorker = false; // For example a page opened straight from a file
        }
    }
    return engineWorker || null;
}

/** Makes every answer still on its way void, and stops a search that is running for one. */
function dropEngineRequests() {
    engineRequestId++;
    stopWorkerSearch();
}

/** @returns {boolean} True if no newer request was made, and none dropped, since this one. */
function isLatestEngineRequest(id) {
    return id === engineRequestId;
}

/**
 * Asks the engine for a move. The search runs in a Web Worker; without one it
 * runs here after the page has had a chance to draw.
 * @param {{position: object, color: string, level: string, seen: string[], budgetMs: number|null}} request
 *   position: a rules.js position. color: the side to find a move for. level: a
 *   key of AI_LEVELS. seen: positionKey of every earlier position of the game.
 *   budgetMs: time for this move in a game on the clock, else null.
 * @param {(move: object|null) => void} onMove - Called with the engine's move,
 *   unless the request has been replaced or dropped by then.
 * @returns {number} The id of the request, for isLatestEngineRequest.
 */
function askEngine(request, onMove) {
    const { position, color, level, seen, budgetMs } = request;
    const id = ++engineRequestId;
    stopWorkerSearch(); // A request still being worked on is replaced by this one
    const thinkHere = () =>
        setTimeout(() => {
            if (id !== engineRequestId) return;
            onMove(chooseAIMove(position, color, level, Math.random, { seen, budgetMs }));
        }, 0);

    const worker = getAIWorker();
    if (!worker) {
        thinkHere();
        return id;
    }
    worker.onmessage = (event) => {
        if (event.data.id !== id) return;
        engineWorkerBusy = false;
        onMove(event.data.move);
    };
    worker.onerror = (event) => {
        if (event && event.preventDefault) event.preventDefault();
        engineWorker = false; // Do not try the worker again
        engineWorkerBusy = false;
        thinkHere();
    };
    engineWorkerBusy = true;
    worker.postMessage({ id, position, color, level, seen, budgetMs });
    return id;
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        askEngine,
        dropEngineRequests,
        isLatestEngineRequest,
    };
}
