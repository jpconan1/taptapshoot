import React, { useState, useEffect, useRef } from 'react';
import Game from './components/Game';
import Menu from './components/Menu';
import Splash from './components/Splash';

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [gameConfig, setGameConfig] = useState(null); // { mode: 'single' | 'host' | 'client', roomId: string }
  const [currentTrack, setCurrentTrack] = useState('/titlescreen.mp3');
  const bgmRef = useRef(null);

  // Global BGM Logic
  useEffect(() => {
    const stopBgm = () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.currentTime = 0;
        bgmRef.current = null;
      }
    };

    const playTrack = (src) => {
      stopBgm();
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = 0.3;
      bgmRef.current = audio;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log("BGM Auto-play blocked. Waiting for interaction.");
          const resumeAudio = () => {
            if (bgmRef.current === audio) {
              audio.play();
            }
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('keydown', resumeAudio);
          };
          document.addEventListener('click', resumeAudio);
          document.addEventListener('keydown', resumeAudio);
        });
      }
    };

    if (currentTrack) {
      playTrack(currentTrack);
    }

    return () => stopBgm();
  }, [currentTrack]);

  if (!hasStarted) {
    return <Splash onStart={() => setHasStarted(true)} />;
  }

  if (!gameConfig) {
    return (
      <Menu
        onStartSinglePlayer={() => setGameConfig({ mode: 'single' })}
        onHostGame={() => setGameConfig({ mode: 'host' })}
        onJoinGame={(id) => setGameConfig({ mode: 'client', roomId: id })}
      />
    );
  }

  return (
    <div className="App">
      <Game
        config={gameConfig}
        onExit={() => {
          setGameConfig(null);
          setCurrentTrack('/titlescreen.mp3'); // Reset music on exit
        }}
        onMusicChange={setCurrentTrack}
      />
    </div>
  );
}

export default App;
