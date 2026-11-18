/**
 * @fileoverview The way from the page to the engine in ai.js. A request is
 * answered by a Web Worker (ai-worker.js), so the page stays responsive, or
 * on the page itself where a worker is not available. Requests travel on
 * named channels, each with a worker of its own. On one channel only the
 * latest request counts: asking again, or dropEngineRequests(), makes an
 * earlier answer void. Channels do not affect each other, so a question about
 * a game being reviewed never cancels or delays the computer's move. Nothing
 * here knows about the game being played.
 */

const engineChannels = {}; // By name: { id, worker, busy }
let engineWorkersUnavailable = false; // True once a worker could not be made or loaded
let engineWorkerHasReplied = false; // True once any worker has answered: workers load here

/**
 * @param {string} name - 'play' for the computer's move and hints in the live
 *   game; the game gives review its own names.
 * @returns {{id: number, worker: Worker|null, busy: boolean}} id goes up with
 *   every request and whenever pending ones are dropped; busy is true from a
 *   request to the worker until its answer.
 */
function engineChannel(name) {
    if (!engineChannels[name]) engineChannels[name] = { id: 0, worker: null, busy: false };
    return engineChannels[name];
}

/**
 * Stops a search the worker is still running. A worker cannot be interrupted,
 * so it is shut down and a new one is started with the next request; that
 * request then does not have to wait for a search nobody wants any more.
 */
function stopWorkerSearch(channel) {
    if (channel.worker && channel.busy) {
        channel.worker.terminate();
        channel.worker = null;
    }
    channel.busy = false;
}

/** @returns {Worker|null} The channel's search worker, or null where workers are not available. */
function getAIWorker(channel) {
    if (engineWorkersUnavailable) return null;
    if (channel.worker === null) {
        try {
            if (typeof Worker !== 'function') throw new Error('No Worker here');
            channel.worker = new Worker('js/ai-worker.js');
        } catch {
            engineWorkersUnavailable = true; // For example a page opened straight from a file
        }
    }
    return channel.worker;
}

/** Shuts a channel's worker down, whatever it is doing; the next request starts a new one. */
function closeWorker(channel) {
    if (channel.worker) {
        try {
            channel.worker.terminate();
        } catch {
            // A worker that failed may already be gone
        }
    }
    channel.worker = null;
    channel.busy = false;
}

/**
 * Gives up on workers for the rest of the visit, for one that could not even
 * be loaded, and shuts down those of the other channels.
 */
function giveUpOnWorkers() {
    engineWorkersUnavailable = true;
    for (const channel of Object.values(engineChannels)) closeWorker(channel);
}

/** Makes every answer still on its way void, and stops a search that is running for one. */
function dropEngineRequests(channelName = 'play') {
    const channel = engineChannel(channelName);
    channel.id++;
    stopWorkerSearch(channel);
}

/** @returns {boolean} True if no newer request was made, and none dropped, since this one. */
function isLatestEngineRequest(id, channelName = 'play') {
    return id === engineChannel(channelName).id;
}

/**
 * Sends a question to the engine and hands the answer on, unless the request
 * has been replaced or dropped by then.
 * @param {string} channelName
 * @param {object} message - What ai-worker.js is told; the request id is added.
 * @param {(done: (answer: object) => void, wanted: () => boolean) => void} answerHere -
 *   Works the answer out on the page, after the page has had a chance to draw,
 *   and calls done with it in the shape the worker replies with. Work spread
 *   over several tasks asks wanted() before each and stops once it is false.
 * @param {(answer: object) => void} onAnswer
 * @returns {number} The id of the request.
 */
function sendToEngine(channelName, message, answerHere, onAnswer) {
    const channel = engineChannel(channelName);
    const id = ++channel.id;
    stopWorkerSearch(channel); // A request still being worked on is replaced by this one
    const wanted = () => id === channel.id;
    const thinkHere = () =>
        answerHere((answer) => {
            if (wanted()) onAnswer(answer);
        }, wanted);

    const send = (retried) => {
        const worker = getAIWorker(channel);
        if (!worker) {
            thinkHere();
            return;
        }
        worker.onmessage = (event) => {
            engineWorkerHasReplied = true;
            if (event.data.protocol !== CONFIG.ENGINE_PROTOCOL) {
                // Started after a new release was deployed, the worker runs an
                // engine this page may not speak to: the page answers from now on
                giveUpOnWorkers();
                if (id === channel.id) thinkHere();
                return;
            }
            if (event.data.id !== id) return;
            channel.busy = false;
            onAnswer(event.data);
        };
        worker.onerror = (event) => {
            if (event && event.preventDefault) event.preventDefault();
            if (worker !== channel.worker) return; // Already replaced
            closeWorker(channel);
            if (!engineWorkerHasReplied) giveUpOnWorkers(); // It could not be loaded at all
            if (id !== channel.id) return; // Nobody waits for this answer any more
            // A worker that failed in the middle of a search is replaced once;
            // if the new one fails too, this one answer is worked out here
            if (!retried && !engineWorkersUnavailable) send(true);
            else thinkHere();
        };
        channel.busy = true;
        worker.postMessage({ id, ...message });
    };
    send(false);
    return id;
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
 * @param {string} [channelName]
 * @returns {number} The id of the request, for isLatestEngineRequest.
 */
function askEngine(request, onMove, channelName = 'play') {
    const { position, color, level, seen, budgetMs } = request;
    return sendToEngine(
        channelName,
        { position, color, level, seen, budgetMs },
        (done, wanted) =>
            setTimeout(() => {
                if (!wanted()) return;
                done({
                    move: chooseAIMove(position, color, level, Math.random, { seen, budgetMs }),
                });
            }, 0),
        (answer) => onMove(answer.move)
    );
}

/**
 * Asks the engine what it makes of each of a list of positions. Worked out on
 * the page, each position gets a task of its own, so the page is never held
 * up for longer than one.
 * @param {{position: object, color: string}[]} positions - rules.js positions,
 *   each with the side to move.
 * @param {(scores: {score: number, mate: boolean, over: boolean}[]) => void} onScores -
 *   Called with one assessPosition result per position, in the same order.
 * @param {string} channelName
 * @returns {number} The id of the request, for isLatestEngineRequest.
 */
function askEngineForScores(positions, onScores, channelName) {
    return sendToEngine(
        channelName,
        { assess: positions },
        (done, wanted) => {
            const scores = [];
            const next = () => {
                if (!wanted()) return;
                const { position, color } = positions[scores.length];
                scores.push(assessPosition(position, color));
                if (scores.length < positions.length) setTimeout(next, 0);
                else done({ scores });
            };
            setTimeout(next, 0);
        },
        (answer) => onScores(answer.scores)
    );
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        askEngine,
        askEngineForScores,
        dropEngineRequests,
        isLatestEngineRequest,
    };
}
