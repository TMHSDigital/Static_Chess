/**
 * @fileoverview Main entry point for the Static Chess application.
 * Initializes the game and sets up event listeners.
 */

// Ensure the DOM is fully loaded before initializing the game
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // --- Initialize Toggles --- 
    const coordsToggle = document.getElementById('coords-toggle');
    const possibleMovesToggle = document.getElementById('possible-moves-toggle');
    const lastMoveToggle = document.getElementById('last-move-toggle');
    const soundToggle = document.getElementById('sound-toggle');
    const body = document.body;
    const rootStyle = document.documentElement.style;

    // Load saved settings or set defaults
    const showCoords = localStorage.getItem('showCoords') === 'true';
    const showPossibleMoves = localStorage.getItem('showPossibleMoves') !== 'false'; // Default true
    const showLastMove = localStorage.getItem('showLastMove') !== 'false'; // Default true
    const enableSounds = localStorage.getItem('enableSounds') === 'true';

    // Apply Coordinate setting
    if (coordsToggle) {
        coordsToggle.checked = showCoords;
        if (showCoords) {
            body.classList.add('coords-visible');
        }
        coordsToggle.addEventListener('change', function() {
            if (this.checked) {
                body.classList.add('coords-visible');
                localStorage.setItem('showCoords', 'true');
            } else {
                body.classList.remove('coords-visible');
                localStorage.setItem('showCoords', 'false');
            }
        });
    }

    // Apply Possible Moves setting
    if (possibleMovesToggle) {
        possibleMovesToggle.checked = showPossibleMoves;
        rootStyle.setProperty('--show-possible-moves', showPossibleMoves ? 'block' : 'none');

        possibleMovesToggle.addEventListener('change', function() {
            const displayValue = this.checked ? 'block' : 'none';
            rootStyle.setProperty('--show-possible-moves', displayValue);
            localStorage.setItem('showPossibleMoves', this.checked.toString());
        });
    }

    // Apply Last Move setting
    if (lastMoveToggle) {
        lastMoveToggle.checked = showLastMove;
        rootStyle.setProperty('--show-last-move', showLastMove ? 'block' : 'none');

        lastMoveToggle.addEventListener('change', function() {
            const displayValue = this.checked ? 'block' : 'none';
            rootStyle.setProperty('--show-last-move', displayValue);
            localStorage.setItem('showLastMove', this.checked.toString());
        });
    }

    // Apply Sound setting
    if (soundToggle) {
        soundToggle.checked = enableSounds;
        CONFIG.FEATURES.SOUND_EFFECTS = enableSounds;
        soundToggle.addEventListener('change', function() {
            CONFIG.FEATURES.SOUND_EFFECTS = this.checked;
            localStorage.setItem('enableSounds', this.checked.toString());
        });
    }

    // --- Initialize Game --- 
    initializeGame();
    
    // --- Initialize Feature Modules ---
    initializeFeatureModules();
}); 

/**
 * Initialize optional feature modules based on feature flags.
 * This function initializes the skeleton implementations when their
 * corresponding feature flags are enabled in config.js.
 */
function initializeFeatureModules() {
    // Enable debug logging for initialization
    const originalDebug = CONFIG.DEBUG;
    CONFIG.DEBUG = true;
    
    debugLog('Initializing optional feature modules...');
    
    // Initialize drag and drop if enabled
    if (CONFIG.FEATURES.DRAG_AND_DROP && typeof window.initDragAndDrop === 'function') {
        debugLog('Initializing drag and drop feature');
        window.initDragAndDrop();
    }
    
    // Initialize promotion UI if enabled
    if (CONFIG.FEATURES.PROMOTION_UI && typeof window.initPromotionUI === 'function') {
        debugLog('Initializing pawn promotion UI');
        window.initPromotionUI();
    }
    
    // Initialize AI opponent if enabled
    if (CONFIG.FEATURES.AI_OPPONENT && typeof window.ChessAI === 'function') {
        debugLog('Initializing AI opponent');
        // AI is initialized when needed in game.js
    }
    
    // Restore original debug setting
    CONFIG.DEBUG = originalDebug;
} 