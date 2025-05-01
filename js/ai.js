/**
 * @fileoverview AI opponent for Static Chess
 * Implements various difficulty levels of computer opponents.
 */

// AI configuration
const AI_CONFIG = {
    // Depth of search for different difficulty levels
    DEPTH: {
        EASY: 2,
        MEDIUM: 3,
        HARD: 4
    },
    
    // Piece values for evaluation
    PIECE_VALUES: {
        'p': 10,   // Pawn
        'n': 30,   // Knight
        'b': 30,   // Bishop
        'r': 50,   // Rook
        'q': 90,   // Queen
        'k': 900   // King
    },
    
    // Position evaluation bonuses
    POSITION_BONUS: {
        // Center control bonus
        CENTER_CONTROL: 3,
        // Developed piece bonus
        DEVELOPMENT: 2,
        // Castled king bonus
        CASTLED: 10,
        // Penalty for blocked pieces
        BLOCKED: -2
    },
    
    // How long to "think" before making a move (ms)
    THINKING_TIME: {
        EASY: 500,
        MEDIUM: 1000,
        HARD: 1500
    }
};

/**
 * Main AI class that manages the computer opponent.
 */
class ChessAI {
    /**
     * Create a new AI instance.
     * @param {string} difficulty - The AI difficulty level ('EASY', 'MEDIUM', 'HARD').
     */
    constructor(difficulty = 'MEDIUM') {
        this.difficulty = difficulty;
        this.depth = AI_CONFIG.DEPTH[difficulty];
        this.thinkingTime = AI_CONFIG.THINKING_TIME[difficulty];
    }
    
    /**
     * Find the best move for the current position.
     * @param {Array<Array<Piece|null>>} boardState - The current board state.
     * @param {string} currentTurn - The current player's turn ('w' or 'b').
     * @returns {Promise<Object>} A promise that resolves to the best move.
     */
    findBestMove(boardState, currentTurn) {
        debugLog(`AI thinking at ${this.difficulty} level (depth ${this.depth})...`);
        
        // Return a promise to allow for "thinking" delay
        return new Promise(resolve => {
            // Clone the board state to avoid modifying the original
            const boardCopy = deepClone(boardState);
            
            // Start timer to measure performance
            const startTime = performance.now();
            
            // Find best move using minimax with alpha-beta pruning
            // For now, we'll just return a random legal move
            const legalMoves = this._getAllLegalMoves(boardCopy, currentTurn);
            
            if (legalMoves.length === 0) {
                resolve(null); // No legal moves
                return;
            }
            
            // In the future, replace this with minimax search
            const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
            
            // Calculate thinking time
            const endTime = performance.now();
            const actualThinkingTime = endTime - startTime;
            
            // Simulate "thinking" with a delay
            const remainingThinkTime = Math.max(0, this.thinkingTime - actualThinkingTime);
            
            debugLog(`AI evaluated ${legalMoves.length} moves in ${actualThinkingTime.toFixed(2)}ms`);
            debugLog(`Waiting ${remainingThinkTime.toFixed(2)}ms before making a move`);
            
            // Resolve after the thinking delay
            setTimeout(() => {
                resolve(randomMove);
            }, remainingThinkTime);
        });
    }
    
    /**
     * Set the AI difficulty level.
     * @param {string} difficulty - The difficulty level ('EASY', 'MEDIUM', 'HARD').
     */
    setDifficulty(difficulty) {
        if (!AI_CONFIG.DEPTH[difficulty]) {
            console.error(`Invalid difficulty level: ${difficulty}`);
            return;
        }
        
        this.difficulty = difficulty;
        this.depth = AI_CONFIG.DEPTH[difficulty];
        this.thinkingTime = AI_CONFIG.THINKING_TIME[difficulty];
        
        debugLog(`AI difficulty set to ${difficulty} (depth ${this.depth})`);
    }
    
    /**
     * Get all legal moves for the current player.
     * This is a placeholder - the actual implementation will need to use the move generation 
     * and validation logic from game.js.
     * 
     * @param {Array<Array<Piece|null>>} boardState - The current board state.
     * @param {string} currentTurn - The current player's turn ('w' or 'b').
     * @returns {Array<Object>} An array of legal moves.
     * @private
     */
    _getAllLegalMoves(boardState, currentTurn) {
        // This is a placeholder.
        // The actual implementation will need to use the move generation and validation
        // logic from game.js.
        
        // For now, return an empty array.
        return [];
    }
    
    /**
     * Minimax algorithm with alpha-beta pruning.
     * @param {Array<Array<Piece|null>>} boardState - The current board state.
     * @param {number} depth - Current depth in the search tree.
     * @param {number} alpha - Alpha value for pruning.
     * @param {number} beta - Beta value for pruning.
     * @param {boolean} isMaximizingPlayer - Whether current player is maximizing.
     * @returns {number} The evaluated score for this position.
     * @private
     */
    _minimax(boardState, depth, alpha, beta, isMaximizingPlayer) {
        // Base case: reached maximum depth or game over
        if (depth === 0) {
            return this._evaluatePosition(boardState);
        }
        
        // This is a placeholder.
        // The actual implementation will use the move generation and evaluation logic.
        
        return 0;
    }
    
    /**
     * Evaluate the current board position.
     * @param {Array<Array<Piece|null>>} boardState - The current board state.
     * @returns {number} The evaluation score.
     * @private
     */
    _evaluatePosition(boardState) {
        // This is a placeholder for a simple material-based evaluation function
        // A more sophisticated implementation would consider piece position, development,
        // pawn structure, king safety, etc.
        
        let score = 0;
        
        // Count material for both sides
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = boardState[row][col];
                if (!piece) continue;
                
                const pieceValue = AI_CONFIG.PIECE_VALUES[piece.type];
                
                if (piece.color === 'w') {
                    score += pieceValue;
                } else {
                    score -= pieceValue;
                }
            }
        }
        
        return score;
    }
}

// Export the AI class
if (typeof window !== 'undefined') {
    window.ChessAI = ChessAI;
} 