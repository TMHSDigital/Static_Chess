/**
 * @fileoverview Main entry point for the Static Chess application.
 * Initializes the game and sets up event listeners.
 */

// Ensure the DOM is fully loaded before initializing the game
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    initializeGame();
    
    // Set up coordinate toggle
    const coordsToggle = document.getElementById('coords-toggle');
    if (coordsToggle) {
        coordsToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('coords-visible');
            } else {
                document.body.classList.remove('coords-visible');
            }
        });
    }
}); 