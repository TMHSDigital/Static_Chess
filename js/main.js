/**
 * @fileoverview Main entry point for the Static Chess application.
 * Initializes the game and sets up event listeners.
 */

// Ensure the DOM is fully loaded before initializing the game
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    initializeGame();
}); 