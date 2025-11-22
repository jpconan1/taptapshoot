import React from 'react';

const Splash = ({ onStart }) => {
    return (
        <div
            onClick={onStart}
            className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white cursor-pointer"
        >
            <div className="animate-bounce mb-8">
                <img
                    src="/logo.png"
                    alt="Tap Tap Shoot Logo"
                    className="w-64 h-64 object-contain drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]"
                />
            </div>

            <h1 className="text-4xl font-bold text-red-600 mb-4 tracking-widest">TAP TAP SHOOT</h1>

            <p className="text-xl text-gray-400 animate-pulse mt-12">
                CLICK TO START
            </p>
        </div>
    );
};

export default Splash;
