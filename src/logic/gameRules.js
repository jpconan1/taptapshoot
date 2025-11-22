export const MOVES = {
    RELOAD: 'RELOAD',
    SHOOT: 'SHOOT',
    STAB: 'STAB',
    BLOCK: 'BLOCK',
    COUNTER_STAB: 'COUNTER_STAB',
    FUMBLE: 'FUMBLE', // Default if no move selected
};

export const GAME_STATE = {
    MENU: 'MENU',
    READY: 'READY',
    PLAYING: 'PLAYING',
    ROUND_OVER: 'ROUND_OVER',
    GAMEOVER: 'GAMEOVER',
};

export const BEAT_PHASE = {
    DUM1: 0,
    DUM2: 1,
    CLAP: 2,
    REST: 3,
};

export const resolveRound = (p1Move, p2Move) => {
    // Helper to determine result from one player's perspective
    const getResult = (myMove, oppMove) => {
        if (myMove === MOVES.FUMBLE) {
            if (oppMove === MOVES.SHOOT || oppMove === MOVES.STAB) return 'LOSE';
            return 'NEUTRAL';
        }

        switch (myMove) {
            case MOVES.SHOOT:
                if (oppMove === MOVES.RELOAD) return 'WIN';
                if (oppMove === MOVES.STAB) return 'WIN';
                if (oppMove === MOVES.COUNTER_STAB) return 'WIN'; // "Don't bring a knife to a gunfight"
                if (oppMove === MOVES.BLOCK) return 'BLOCKED';
                if (oppMove === MOVES.SHOOT) return 'NEUTRAL';
                return 'NEUTRAL'; // vs Fumble (handled by Fumble logic usually, but if they Fumble, Shoot wins? No, Fumble logic handles death)
            // Actually, if opponent Fumbles, Shoot should WIN.
            // Let's refine: Fumble logic says "Fumble loses to attacks".
            // So if I Shoot and they Fumble, I WIN.

            case MOVES.STAB:
                if (oppMove === MOVES.RELOAD) return 'WIN';
                if (oppMove === MOVES.BLOCK) return 'WIN';
                if (oppMove === MOVES.SHOOT) return 'LOSE';
                if (oppMove === MOVES.COUNTER_STAB) return 'BLOCKED'; // Counter Stab blocks Stab
                if (oppMove === MOVES.STAB) return 'NEUTRAL';
                return 'NEUTRAL';

            case MOVES.BLOCK:
                if (oppMove === MOVES.SHOOT) return 'BLOCK_SUCCESS';
                if (oppMove === MOVES.STAB) return 'LOSE';
                return 'NEUTRAL';

            case MOVES.COUNTER_STAB:
                if (oppMove === MOVES.STAB) return 'BLOCK_SUCCESS';
                if (oppMove === MOVES.SHOOT) return 'LOSE';
                return 'NEUTRAL';

            case MOVES.RELOAD:
                if (oppMove === MOVES.SHOOT) return 'LOSE';
                if (oppMove === MOVES.STAB) return 'LOSE';
                return 'NEUTRAL';

            default:
                return 'NEUTRAL';
        }
    };

    // Handle Fumble explicitly for Win/Lose conditions
    if (p2Move === MOVES.FUMBLE && (p1Move === MOVES.SHOOT || p1Move === MOVES.STAB)) {
        return { p1: 'WIN', p2: 'LOSE', message: 'Player 2 Fumbled and Died!' };
    }
    if (p1Move === MOVES.FUMBLE && (p2Move === MOVES.SHOOT || p2Move === MOVES.STAB)) {
        return { p1: 'LOSE', p2: 'WIN', message: 'Player 1 Fumbled and Died!' };
    }

    const p1Res = getResult(p1Move, p2Move);
    const p2Res = getResult(p2Move, p1Move);

    return { p1: p1Res, p2: p2Res };
};
