import React, { useState } from 'react';

const Menu = ({ onStartSinglePlayer, onHostGame, onJoinGame }) => {
    const [joinId, setJoinId] = useState('');

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
            <h1 className="text-6xl font-bold mb-12 text-red-600">TAP TAP SHOOT!</h1>

            <div className="flex flex-col gap-6 w-full max-w-md">
                {/* Single Player */}
                <button
                    onClick={onStartSinglePlayer}
                    className="p-6 bg-gray-800 hover:bg-gray-700 rounded-lg border-2 border-gray-600 hover:border-white transition-all text-xl font-bold"
                >
                    SINGLE PLAYER (vs CPU)
                </button>

                <div className="h-px bg-gray-700 my-2"></div>

                {/* Host Game */}
                <button
                    onClick={onHostGame}
                    className="p-6 bg-blue-900 hover:bg-blue-800 rounded-lg border-2 border-blue-700 hover:border-blue-400 transition-all text-xl font-bold"
                >
                    HOST ONLINE GAME
                </button>

                {/* Join Game */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Enter Friend's ID"
                        value={joinId}
                        onChange={(e) => setJoinId(e.target.value)}
                        className="flex-1 p-4 bg-gray-800 rounded-lg border-2 border-gray-600 text-white focus:border-green-500 outline-none"
                    />
                    <button
                        onClick={() => onJoinGame(joinId)}
                        disabled={!joinId}
                        className="px-8 bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold"
                    >
                        JOIN
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Menu;
