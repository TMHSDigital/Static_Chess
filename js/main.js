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
    const body = document.body;
    const rootStyle = document.documentElement.style;

    // Load saved settings or set defaults
    const showCoords = localStorage.getItem('showCoords') === 'true';
    const showPossibleMoves = localStorage.getItem('showPossibleMoves') !== 'false'; // Default true

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

    // --- Initialize Game --- 
    initializeGame(); 
}); 