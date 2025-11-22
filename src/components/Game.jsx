import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { MOVES, GAME_STATE, BEAT_PHASE, resolveRound } from '../logic/gameRules';

const BPM = 75; // Beats per minute
const BEAT_INTERVAL = (60 / BPM) * 1000;

const Game = ({ config = { mode: 'single' }, onExit, onMusicChange }) => {
    const [gameState, setGameState] = useState(GAME_STATE.MENU);
    const [beat, setBeat] = useState(BEAT_PHASE.DUM1);
    const [player, setPlayer] = useState({ bullets: 0, isAlive: true, lastMove: null, selectedMove: null });
    const [cpu, setCpu] = useState({ bullets: 0, isAlive: true, lastMove: null }); // In Online: cpu = opponent
    const [playerWins, setPlayerWins] = useState(0);
    const [cpuWins, setCpuWins] = useState(0);
    const [message, setMessage] = useState('');
    const [clientMessage, setClientMessage] = useState(''); // Message for the connected client

    // Network State
    const [myPeerId, setMyPeerId] = useState('');
    const [isConnected, setIsConnected] = useState(false);

    const audioCtxRef = useRef(null);
    const timerRef = useRef(null);

    // Network Refs
    const peerRef = useRef(null);
    const connRef = useRef(null);
    const opponentMoveRef = useRef(null); // For Host: Client's move. For Client: N/A

    useEffect(() => {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        return () => {
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
    }, []);

    // Network Setup
    useEffect(() => {
        if (config.mode === 'single') return;

        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
            setMyPeerId(id);
            if (config.mode === 'client') {
                const conn = peer.connect(config.roomId);
                setupConnection(conn);
            }
        });

        peer.on('connection', (conn) => {
            if (config.mode === 'host') {
                setupConnection(conn);
            }
        });

        return () => peer.destroy();
    }, [config]);

    const setupConnection = (conn) => {
        connRef.current = conn;

        conn.on('open', () => {
            setIsConnected(true);
            if (config.mode === 'host') {
                // Start game automatically when client connects? Or wait for user?
                // Let's wait for user to click Start
            }
        });

        conn.on('data', (data) => {
            if (config.mode === 'host') {
                // Host receiving data from Client
                if (data.type === 'MOVE') {
                    opponentMoveRef.current = data.move;
                }
            } else {
                // Client receiving state from Host
                if (data.type === 'SYNC') {
                    setBeat(data.state.beat);
                    setGameState(data.state.gameState);
                    setMessage(data.state.message);
                    // Swap perspectives for Client
                    setPlayer(data.state.cpu); // Host's CPU is Client's Player
                    setCpu(data.state.player); // Host's Player is Client's CPU (Opponent)
                    setPlayerWins(data.state.cpuWins); // Host's CPU Wins -> Client's Player Wins
                    setCpuWins(data.state.playerWins); // Host's Player Wins -> Client's CPU Wins
                }
            }
        });

        conn.on('close', () => {
            setIsConnected(false);
            console.warn('Connection closed');
            setMessage('Connection Lost!');
            // onExit && onExit(); // Don't force exit, let user decide
        });

        conn.on('error', (err) => {
            console.error('Connection Error:', err);
        });
    };

    const playSound = (freq, type = 'sine') => {
        if (!audioCtxRef.current) return;
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.1);
    };

    const playerRef = useRef(player);
    const cpuRef = useRef(cpu);
    const playerWinsRef = useRef(playerWins);
    const cpuWinsRef = useRef(cpuWins);
    const messageRef = useRef(message);
    const clientMessageRef = useRef(clientMessage);

    useEffect(() => {
        playerRef.current = player;
        cpuRef.current = cpu;
        playerWinsRef.current = playerWins;
        cpuWinsRef.current = cpuWins;
        messageRef.current = message;
        clientMessageRef.current = clientMessage;
    }, [player, cpu, playerWins, cpuWins, message, clientMessage]);

    // BGM Logic (Delegated to App)
    useEffect(() => {
        if (gameState === GAME_STATE.MENU) {
            onMusicChange && onMusicChange('/titlescreen.mp3');
        } else if (gameState === GAME_STATE.READY) {
            // Start random song only at the beginning of a round (READY)
            const songs = ['/song1.mp3', '/song2.mp3', '/song3.mp3'];
            const randomSong = songs[Math.floor(Math.random() * songs.length)];
            onMusicChange && onMusicChange(randomSong);
        } else if (gameState === GAME_STATE.ROUND_OVER) {
            // Silence between rounds
            onMusicChange && onMusicChange(null);
        } else if (gameState === GAME_STATE.GAMEOVER) {
            onMusicChange && onMusicChange('/winner.mp3');
        }
        // GAME_STATE.PLAYING does nothing, so the music from READY continues.
    }, [gameState, onMusicChange]);

    // Game Loop (Clock) - Host Only
    useEffect(() => {
        if (gameState === GAME_STATE.MENU || gameState === GAME_STATE.GAMEOVER) return;
        if (config.mode === 'client') return;

        const loop = setInterval(() => {
            setBeat(b => (b + 1) % 4);
        }, BEAT_INTERVAL);

        timerRef.current = loop;
        return () => clearInterval(loop);
    }, [gameState, config.mode]);

    const startRound = useCallback(() => {
        setPlayer({ bullets: 0, isAlive: true, lastMove: null, selectedMove: MOVES.RELOAD });
        setCpu({ bullets: 0, isAlive: true, lastMove: null });
        setMessage('Get Ready...');
        setClientMessage('Get Ready...');
        setGameState(GAME_STATE.READY);
        setBeat(BEAT_PHASE.DUM1);
    }, []);

    const endMatch = useCallback(() => {
        clearInterval(timerRef.current);
        // Determine final message based on wins
        const pWins = playerWinsRef.current;
        const cWins = cpuWinsRef.current;
        let finalMsg = '';
        let clientFinalMsg = '';

        if (pWins > cWins) {
            finalMsg = 'VICTORY!';
            clientFinalMsg = 'DEFEAT!';
        } else if (cWins > pWins) {
            finalMsg = 'DEFEAT!';
            clientFinalMsg = 'VICTORY!';
        } else {
            finalMsg = 'DRAW!';
            clientFinalMsg = 'DRAW!';
        }

        setMessage(finalMsg);
        setClientMessage(clientFinalMsg);
        setGameState(GAME_STATE.GAMEOVER);
    }, []);

    const startMatch = () => {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        setPlayerWins(0);
        setCpuWins(0);
        startRound();
    };

    const resolveTurn = useCallback(() => {
        // Use Refs to get latest state
        const currentPlayer = playerRef.current;
        const currentCpu = cpuRef.current;

        // 1. Determine Moves
        let pMove = currentPlayer.selectedMove || MOVES.FUMBLE;
        let cMove = MOVES.RELOAD;

        if (config.mode === 'host') {
            // Online Opponent
            cMove = opponentMoveRef.current || MOVES.RELOAD; // Default if they lag/disconnect
            opponentMoveRef.current = null; // Reset for next turn
        } else {
            // Single Player AI
            // CPU Logic
            if (currentCpu.bullets > 0) {
                if (currentPlayer.bullets === 0) {
                    // Aggressive Mixup: Player is defenseless (mostly), force the 50/50
                    // 40% Shoot, 40% Stab, 20% Reload (Greedy)
                    const roll = Math.random();
                    if (roll < 0.4) cMove = MOVES.SHOOT;
                    else if (roll < 0.8) cMove = MOVES.STAB;
                    else cMove = MOVES.RELOAD;
                } else {
                    // Both armed: High tension.
                    // REPLACED Counter Stab with Shoot for aggression/optimality
                    // Options: Shoot, Stab, Block, Shoot (was Counter Stab), Reload
                    const options = [MOVES.SHOOT, MOVES.STAB, MOVES.BLOCK, MOVES.SHOOT, MOVES.RELOAD];
                    cMove = options[Math.floor(Math.random() * options.length)];
                }
            } else {
                // CPU has 0 bullets
                if (currentPlayer.bullets > 0) {
                    // Defensive Mode: Player might shoot/stab
                    // 40% Block, 40% Counter Stab, 20% Reload (Risky)
                    const roll = Math.random();
                    if (roll < 0.4) cMove = MOVES.BLOCK;
                    else if (roll < 0.8) cMove = MOVES.COUNTER_STAB;
                    else cMove = MOVES.RELOAD;
                } else {
                    // Both empty: Race to reload
                    cMove = MOVES.RELOAD;
                }
            }

            // Fallback validation
            if ((cMove === MOVES.SHOOT || cMove === MOVES.STAB) && currentCpu.bullets <= 0) {
                cMove = MOVES.RELOAD;
            }
        }

        // 2. Resolve
        const result = resolveRound(pMove, cMove);

        // 3. Update State
        let pAlive = true;
        let cAlive = true;
        let pBullets = currentPlayer.bullets;
        let cBullets = currentCpu.bullets;

        // Cost
        if ([MOVES.SHOOT, MOVES.STAB].includes(pMove)) pBullets--;
        if ([MOVES.SHOOT, MOVES.STAB].includes(cMove)) cBullets--;

        // Reload
        if (pMove === MOVES.RELOAD) pBullets++;
        if (cMove === MOVES.RELOAD) cBullets++;

        // Damage
        if (result.p1 === 'LOSE') pAlive = false;
        if (result.p2 === 'LOSE') cAlive = false;

        const newPlayerState = { ...currentPlayer, bullets: pBullets, isAlive: pAlive, lastMove: pMove };
        const newCpuState = { ...currentCpu, bullets: cBullets, isAlive: cAlive, lastMove: cMove };

        setPlayer(newPlayerState);
        setCpu(newCpuState);

        // Message Generation (Symmetric)
        let hostMsg = '';
        let clientMsg = '';

        if (!pAlive && !cAlive) {
            hostMsg = 'DRAW! DOUBLE KILL!';
            clientMsg = 'DRAW! DOUBLE KILL!';
        } else if (!pAlive) {
            // Host Died
            if (cMove === MOVES.SHOOT) { hostMsg = 'YOU WERE SHOT!'; clientMsg = 'YOU SHOT THE OPPONENT!'; }
            else if (cMove === MOVES.STAB) { hostMsg = 'YOU WERE STABBED!'; clientMsg = 'YOU STABBED THE OPPONENT!'; }
            else { hostMsg = 'YOU DIED!'; clientMsg = 'YOU WON!'; }
        } else if (!cAlive) {
            // Client Died
            if (pMove === MOVES.SHOOT) { hostMsg = 'YOU SHOT THE OPPONENT!'; clientMsg = 'YOU WERE SHOT!'; }
            else if (pMove === MOVES.STAB) { hostMsg = 'YOU STABBED THE OPPONENT!'; clientMsg = 'YOU WERE STABBED!'; }
            else { hostMsg = 'YOU WON!'; clientMsg = 'YOU DIED!'; }
        } else {
            // Non-Fatal
            if (pMove === cMove) {
                if (pMove === MOVES.RELOAD) hostMsg = clientMsg = 'Both Reloaded';
                else if (pMove === MOVES.BLOCK) hostMsg = clientMsg = 'Both Blocked';
                else if (pMove === MOVES.SHOOT) hostMsg = clientMsg = 'Bullets Collided!';
                else if (pMove === MOVES.STAB) hostMsg = clientMsg = 'Cling! Swords Clashed.';
                else hostMsg = clientMsg = `${pMove} vs ${cMove}`;
            } else {
                // Asymmetric
                if (pMove === MOVES.SHOOT) {
                    if (cMove === MOVES.BLOCK) { hostMsg = 'Blocked!'; clientMsg = 'You Blocked!'; }
                    else { hostMsg = 'You Shot!'; clientMsg = 'Opponent Shot!'; }
                } else if (pMove === MOVES.STAB) {
                    if (cMove === MOVES.COUNTER_STAB) { hostMsg = 'Countered!'; clientMsg = 'You Countered!'; }
                    else { hostMsg = 'You Stabbed!'; clientMsg = 'Opponent Stabbed!'; }
                } else if (cMove === MOVES.SHOOT) {
                    if (pMove === MOVES.BLOCK) { hostMsg = 'You Blocked!'; clientMsg = 'Blocked!'; }
                    else { hostMsg = 'Opponent Shot!'; clientMsg = 'You Shot!'; }
                } else if (cMove === MOVES.STAB) {
                    if (pMove === MOVES.COUNTER_STAB) { hostMsg = 'You Countered!'; clientMsg = 'Countered!'; }
                    else { hostMsg = 'Opponent Stabbed!'; clientMsg = 'You Stabbed!'; }
                } else {
                    // Passive/Safe
                    if (pMove === MOVES.BLOCK || pMove === MOVES.COUNTER_STAB) { hostMsg = 'Safe.'; clientMsg = 'Opponent Defended.'; }
                    else if (cMove === MOVES.BLOCK || cMove === MOVES.COUNTER_STAB) { hostMsg = 'Opponent Defended.'; clientMsg = 'Safe.'; }
                    else { hostMsg = `${pMove} vs ${cMove}`; clientMsg = `${cMove} vs ${pMove}`; }
                }
            }
        }

        setMessage(hostMsg);
        setClientMessage(clientMsg);

        // Round/Match Logic
        let currentPWins = playerWinsRef.current;
        let currentCWins = cpuWinsRef.current;

        if (!pAlive || !cAlive) {
            if (!pAlive && !cAlive) {
                // Draw - no points, replay round.
            } else if (!pAlive) {
                currentCWins++;
                setCpuWins(currentCWins);
            } else if (!cAlive) {
                currentPWins++;
                setPlayerWins(currentPWins);
            }

            if (currentPWins >= 3 || currentCWins >= 3) {
                // Match Over
                setTimeout(endMatch, 2000);
            } else {
                // Round Over
                setGameState(GAME_STATE.ROUND_OVER);
                // Removed auto-start timeout: setTimeout(startRound, 3000);
            }
        }

        // Sync with Client (Host Only)
        if (config.mode === 'host' && connRef.current) {
            try {
                connRef.current.send({
                    type: 'SYNC',
                    state: {
                        beat: BEAT_PHASE.CLAP, // Force sync to CLAP phase
                        gameState: (!pAlive || !cAlive) ? ((currentPWins >= 3 || currentCWins >= 3) ? GAME_STATE.GAMEOVER : GAME_STATE.ROUND_OVER) : GAME_STATE.PLAYING,
                        message: clientMsg, // Send Client Message
                        player: newPlayerState, // Host's Player
                        cpu: newCpuState, // Host's Opponent (Client)
                        playerWins: currentPWins, // Host Wins
                        cpuWins: currentCWins     // Client Wins
                    }
                });
            } catch (e) {
                console.error("Sync Error (Turn):", e);
            }
        }

    }, [config.mode, endMatch, startRound]);

    // Game Logic (Triggers on Beat Change)
    useEffect(() => {
        if (gameState !== GAME_STATE.PLAYING && gameState !== GAME_STATE.READY) return;

        // Play Sounds (Everyone)
        if (beat === BEAT_PHASE.DUM1) {
            playSound(200, 'triangle');

            // Persist selection, but validate it
            setPlayer(p => {
                let nextMove = p.selectedMove;
                // If no move selected yet (start of game), default to RELOAD
                if (!nextMove) nextMove = MOVES.RELOAD;

                // Validate: Can't Shoot/Stab with 0 bullets
                if ((nextMove === MOVES.SHOOT || nextMove === MOVES.STAB) && p.bullets <= 0) {
                    nextMove = MOVES.RELOAD;
                }

                return { ...p, selectedMove: nextMove, lastMove: null };
            });

            setCpu(c => ({ ...c, lastMove: null }));
            if (gameState === GAME_STATE.PLAYING) {
                setMessage('');
                setClientMessage(''); // Clear client message too
            }
        } else if (beat === BEAT_PHASE.DUM2) {
            playSound(200, 'triangle');
        } else if (beat === BEAT_PHASE.CLAP) {
            playSound(400, 'square');

            if (gameState === GAME_STATE.READY) {
                // Transition to PLAYING after one cycle?
                // Actually, let's just switch to PLAYING on the CLAP of the READY phase.
                setGameState(GAME_STATE.PLAYING);
                setMessage('FIGHT!');
                setClientMessage('FIGHT!');
            } else if (config.mode !== 'client') {
                resolveTurn();
            }
        } else if (beat === BEAT_PHASE.REST) {
            // Optional: Quiet tick or silence
            // playSound(100, 'sine');
        }

        // Host Syncs Beat to Client
        if (config.mode === 'host' && connRef.current) {
            // Don't sync on CLAP here, resolveTurn handles it with full state
            if (beat !== BEAT_PHASE.CLAP) {
                try {
                    connRef.current.send({
                        type: 'SYNC',
                        state: {
                            beat,
                            gameState,
                            message: clientMessageRef.current, // Use Client Message Ref
                            player: playerRef.current,   // Use Ref
                            cpu: cpuRef.current,          // Use Ref
                            playerWins: playerWinsRef.current,
                            cpuWins: cpuWinsRef.current
                        }
                    });
                } catch (e) {
                    console.error("Sync Error (Beat):", e);
                }
            }
        }

    }, [beat, gameState, resolveTurn, config.mode]);

    const handleMoveSelect = (move) => {
        if (beat === BEAT_PHASE.CLAP) return; // Too late!
        // Check costs
        if ((move === MOVES.SHOOT || move === MOVES.STAB) && player.bullets <= 0) return;

        setPlayer(p => ({ ...p, selectedMove: move }));

        // Send Move to Host if Client
        if (config.mode === 'client' && connRef.current) {
            connRef.current.send({ type: 'MOVE', move });
        }
    };

    console.log('Current Game State:', gameState);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-mono">
            {gameState === GAME_STATE.MENU && (
                <div className="text-center">
                    <h1 className="text-6xl font-bold mb-8 text-red-600">TAP TAP SHOOT!</h1>

                    {/* Multiplayer Status */}
                    {config.mode === 'host' && (
                        <div className="mb-8 p-6 bg-blue-900 rounded-lg border border-blue-500">
                            <h3 className="text-xl font-bold mb-2">HOSTING GAME</h3>
                            {!isConnected ? (
                                <>
                                    <p className="mb-4 animate-pulse">Waiting for opponent...</p>
                                    <div className="text-sm text-gray-300 mb-2">Share this ID with your friend:</div>
                                    <div className="text-2xl font-mono bg-black p-4 rounded select-all cursor-pointer" onClick={() => navigator.clipboard.writeText(myPeerId)}>
                                        {myPeerId || 'Generating ID...'}
                                    </div>
                                </>
                            ) : (
                                <p className="text-green-400 font-bold text-xl">OPPONENT CONNECTED!</p>
                            )}
                        </div>
                    )}

                    {config.mode === 'client' && (
                        <div className="mb-8 p-6 bg-green-900 rounded-lg border border-green-500">
                            <h3 className="text-xl font-bold mb-2">JOINING GAME</h3>
                            {!isConnected ? (
                                <p className="animate-pulse">Connecting to Host...</p>
                            ) : (
                                <p className="text-green-400 font-bold">Connected! Waiting for Host to start...</p>
                            )}
                        </div>
                    )}

                    {/* Instructions */}
                    {(config.mode === 'single' || (config.mode === 'host' && isConnected)) && (
                        <>
                            <div className="mb-8 text-left max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
                                <h3 className="text-xl font-bold mb-4 text-yellow-400">HOW TO PLAY</h3>
                                <p className="mb-2">Duel to the death on the beat!</p>
                                <p className="mb-2">Rhythm: <span className="font-bold">DUM DUM CLAP (Wait)</span></p>
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">
                                    <li>Select your move during <span className="text-white font-bold">DUM DUM</span>.</li>
                                    <li>Move executes on <span className="text-red-500 font-bold">CLAP</span>.</li>
                                    <li><span className="text-blue-400">Reload</span>: Get 1 Bullet.</li>
                                    <li><span className="text-red-400">Shoot</span>: Beats Stab & Counter Stab. Costs 1 Bullet.</li>
                                    <li><span className="text-orange-400">Stab</span>: Beats Block. Costs 1 Bullet.</li>
                                    <li><span className="text-gray-400">Block</span>: Blocks Shoot.</li>
                                    <li><span className="text-purple-400">Counter Stab</span>: Blocks Stab.</li>
                                </ul>
                            </div>
                            <button onClick={startMatch} className="px-8 py-4 bg-red-600 text-2xl font-bold rounded hover:bg-red-500 animate-pulse">
                                START DUEL
                            </button>
                        </>
                    )}

                    <button onClick={() => {
                        if (peerRef.current) peerRef.current.destroy();
                        onExit && onExit();
                    }} className="px-4 py-2 text-gray-500 hover:text-white underline mt-8 block mx-auto">
                        EXIT
                    </button>
                </div>
            )}

            {(gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.READY || gameState === GAME_STATE.ROUND_OVER) && (
                <div className="w-full max-w-2xl flex flex-col items-center gap-8 relative">
                    {/* Rhythm Indicator */}
                    <div className="flex gap-8 mb-12">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-100 ${beat === 0 ? 'bg-white scale-125 shadow-[0_0_20px_rgba(255,255,255,0.8)]' : 'bg-gray-700 opacity-50'}`}>
                            {beat === 0 && <span className="text-black font-bold">DUM</span>}
                        </div>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-100 ${beat === 1 ? 'bg-white scale-125 shadow-[0_0_20px_rgba(255,255,255,0.8)]' : 'bg-gray-700 opacity-50'}`}>
                            {beat === 1 && <span className="text-black font-bold">DUM</span>}
                        </div>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-100 ${beat === 2 ? 'bg-red-500 scale-150 shadow-[0_0_30px_rgba(239,68,68,0.8)]' : 'bg-gray-700 opacity-50'}`}>
                            {beat === 2 && <span className="text-white font-bold">CLAP!</span>}
                        </div>
                        {/* Rest Indicator (Subtle) */}
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-100 border-2 border-gray-600 ${beat === 3 ? 'border-white scale-110' : 'opacity-20'}`}>
                            <span className="text-xs text-gray-400">...</span>
                        </div>
                    </div>

                    {/* Game Area */}
                    <div className="flex justify-between w-full px-8">
                        {/* Player */}
                        <div className="flex flex-col items-center">
                            <h2 className="text-xl font-bold">YOU</h2>
                            {/* Round Counters */}
                            <div className="flex gap-1 mt-1 mb-2">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full border border-white ${i < playerWins ? 'bg-white' : 'bg-transparent'}`} />
                                ))}
                            </div>
                            <div className="text-4xl my-4">Bullets: {player.bullets}</div>
                            <div className="text-green-400 h-8">{player.selectedMove || '...'}</div>
                            <div className="text-yellow-400 h-8">{player.lastMove && `Used: ${player.lastMove}`}</div>
                        </div>

                        {/* VS */}
                        <div className="text-2xl font-bold self-center text-red-500">VS</div>

                        {/* CPU / Opponent */}
                        <div className="flex flex-col items-center">
                            <h2 className="text-xl font-bold">{config.mode === 'single' ? 'CPU' : 'OPPONENT'}</h2>
                            {/* Round Counters */}
                            <div className="flex gap-1 mt-1 mb-2">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full border border-white ${i < cpuWins ? 'bg-white' : 'bg-transparent'}`} />
                                ))}
                            </div>
                            <div className="text-4xl my-4">Bullets: {cpu.bullets}</div>
                            <div className="text-gray-500 h-8">...</div>
                            <div className="text-yellow-400 h-8">{cpu.lastMove && `Used: ${cpu.lastMove}`}</div>
                        </div>
                    </div>

                    {/* Message */}
                    <div className="text-3xl font-bold text-center h-16 text-blue-400">{message}</div>

                    {/* Controls */}
                    <div className={`flex gap-8 justify-center items-stretch mt-8 transition-opacity duration-300 ${gameState === GAME_STATE.ROUND_OVER ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                        {/* Reload Section */}
                        <button
                            onClick={() => handleMoveSelect(MOVES.RELOAD)}
                            className={`w-40 bg-black rounded-2xl flex flex-col items-center justify-center border-2 border-gray-600 hover:border-white transition-all ${player.selectedMove === MOVES.RELOAD ? 'ring-4 ring-white border-white' : ''}`}
                        >
                            <span className="text-2xl font-bold">RELOAD</span>
                            <span className="text-xs text-gray-400 mt-2">+1 Bullet</span>
                        </button>

                        {/* Attack Section */}
                        <div className="flex flex-col gap-4 p-4 border-2 border-red-500 rounded-xl bg-gray-900/50">
                            <h3 className="text-center text-red-500 font-bold text-lg uppercase tracking-wider">Attack</h3>
                            <button
                                onClick={() => handleMoveSelect(MOVES.SHOOT)}
                                disabled={player.bullets <= 0}
                                className={`w-40 py-4 bg-black rounded-full border-2 border-gray-600 hover:border-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex flex-col items-center ${player.selectedMove === MOVES.SHOOT ? 'ring-4 ring-white border-white' : ''}`}
                            >
                                <span className="font-bold">SHOOT</span>
                                <span className="text-xs text-gray-500">1 Bullet</span>
                            </button>
                            <button
                                onClick={() => handleMoveSelect(MOVES.STAB)}
                                disabled={player.bullets <= 0}
                                className={`w-40 py-4 bg-black rounded-full border-2 border-gray-600 hover:border-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex flex-col items-center ${player.selectedMove === MOVES.STAB ? 'ring-4 ring-white border-white' : ''}`}
                            >
                                <span className="font-bold">STAB</span>
                                <span className="text-xs text-gray-500">1 Bullet</span>
                            </button>
                        </div>

                        {/* Defend Section */}
                        <div className="relative flex flex-col gap-4 p-4 border-2 border-blue-500 rounded-xl bg-gray-900/50">
                            {player.bullets <= 0 && cpu.bullets > 0 && (
                                <div className="absolute -top-16 left-0 right-0 text-center animate-bounce z-20">
                                    <span className="text-red-600 font-black text-4xl tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,1)] stroke-white" style={{ WebkitTextStroke: '1px white' }}>DEFEND!!</span>
                                </div>
                            )}
                            <h3 className="text-center text-blue-400 font-bold text-lg uppercase tracking-wider">Defend</h3>
                            <button
                                onClick={() => handleMoveSelect(MOVES.BLOCK)}
                                className={`w-40 py-4 bg-black rounded-full border-2 border-gray-600 hover:border-blue-500 transition-all flex flex-col items-center ${player.selectedMove === MOVES.BLOCK ? 'ring-4 ring-white border-white' : ''}`}
                            >
                                <span className="font-bold">BLOCK</span>
                                <span className="text-xs text-gray-500">Safe vs Shoot</span>
                            </button>
                            <button
                                onClick={() => handleMoveSelect(MOVES.COUNTER_STAB)}
                                className={`w-40 py-4 bg-black rounded-full border-2 border-gray-600 hover:border-purple-500 transition-all flex flex-col items-center ${player.selectedMove === MOVES.COUNTER_STAB ? 'ring-4 ring-white border-white' : ''}`}
                            >
                                <span className="font-bold">COUNTER</span>
                                <span className="text-xs text-gray-500">Safe vs Stab</span>
                            </button>
                        </div>
                    </div>

                    {/* Round Over Overlay */}
                    {gameState === GAME_STATE.ROUND_OVER && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl z-10 backdrop-blur-sm">
                            <h2 className="text-4xl font-bold mb-8 text-yellow-400">{message}</h2>
                            {(config.mode === 'single' || config.mode === 'host') ? (
                                <button
                                    onClick={startRound}
                                    className="px-8 py-4 bg-red-600 text-2xl font-bold rounded-full hover:bg-red-500 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                                >
                                    NEXT ROUND
                                </button>
                            ) : (
                                <p className="text-xl animate-pulse text-gray-400">Waiting for Host...</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {gameState === GAME_STATE.GAMEOVER && (
                <div className="text-center">
                    <h1 className="text-6xl font-bold mb-8">{message}</h1>
                    {(config.mode === 'single' || config.mode === 'host') && (
                        <button onClick={startMatch} className="px-8 py-4 bg-white text-black text-2xl font-bold rounded hover:bg-gray-200">
                            PLAY AGAIN
                        </button>
                    )}
                    {config.mode === 'client' && (
                        <p className="text-xl animate-pulse">Waiting for Host to restart...</p>
                    )}
                    <button onClick={() => {
                        if (peerRef.current) peerRef.current.destroy();
                        onExit && onExit();
                    }} className="px-4 py-2 text-gray-500 hover:text-white underline mt-8 block mx-auto">
                        EXIT TO MENU
                    </button>
                </div>
            )}
        </div>
    );
};

export default Game;
