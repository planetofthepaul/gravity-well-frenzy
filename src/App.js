import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { LineChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import './App.css';

const WINNING_SCORE = 5;
const MIN_GRAVITY_WELLS = 2;
const MAX_GRAVITY_WELLS = 4;
const GRAVITY_WELL_RADIUS = 10;
const GRAVITY_STRENGTH = 0.1;
const WELL_GENERATION_INTERVAL = 5000; // 5 seconds
const CENTER_EXCLUSION_RADIUS = 15; // Percentage of game area where wells can't spawn in the center
const BALL_SPEED_INCREMENT = 0.0001; // Speed increase per frame
const INITIAL_BALL_SPEED = 0.75;

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState({
    playerPaddle: 50,
    aiPaddle: 50,
    ballPos: { x: 50, y: 50 },
    ballSpeed: { x: 0, y: -INITIAL_BALL_SPEED },
    score: { player: 0, ai: 0 },
    gravityWells: [],
    ballSpeedMultiplier: 1
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [dailyChallenge] = useState("Score 5 points with at least 3 gravity well activations");
  const gameLoopRef = useRef();
  const wellGenerationRef = useRef();
  const gameAreaRef = useRef();
  const audioRefs = useRef({
    hit: null,
    score: null,
    gravity: null
  });

  useEffect(() => {
    const loadAudio = (key, path) => {
      const audio = new Audio(path);
      audio.load();
      audioRefs.current[key] = audio;
    };

    loadAudio('hit', '/hit.mp3');
    loadAudio('score', '/score.mp3');
    loadAudio('gravity', '/gravity.mp3');

    const storedHighScore = localStorage.getItem('highScore');
    if (storedHighScore) {
      setHighScore(parseInt(storedHighScore));
    }

    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  const playSound = useCallback((key) => {
    if (isSoundOn && audioRefs.current[key]) {
      audioRefs.current[key].currentTime = 0;
      audioRefs.current[key].play().catch(error => console.error('Error playing sound:', error));
    }
  }, [isSoundOn]);

  const handleStartGame = useCallback(() => {
    setGameStarted(true);
    setGameOver(false);
    setGameState(prevState => ({
      ...prevState,
      score: { player: 0, ai: 0 },
      gravityWells: generateGravityWells(),
      ballPos: { x: 50, y: 50 },
      ballSpeed: { x: Math.random() * 0.9 - 0.45, y: Math.random() < 0.5 ? -INITIAL_BALL_SPEED : INITIAL_BALL_SPEED },
      ballSpeedMultiplier: 1
    }));
    startWellGeneration();
  }, []);

  const handlePlayerMove = useCallback((e) => {
    if (!gameAreaRef.current) return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const newPosition = ((clientX - rect.left) / rect.width) * 100;
    setGameState(prevState => ({
      ...prevState,
      playerPaddle: Math.max(15, Math.min(85, newPosition))
    }));
  }, []);

  const updateHighScore = useCallback((newScore) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      try {
        localStorage.setItem('highScore', newScore.toString());
      } catch (error) {
        console.error('Error saving high score:', error);
      }
    }
  }, [highScore]);

  const generateGravityWells = useCallback(() => {
    const wells = [];
    const numWells = Math.max(MIN_GRAVITY_WELLS, Math.floor(Math.random() * (MAX_GRAVITY_WELLS - MIN_GRAVITY_WELLS + 1)) + MIN_GRAVITY_WELLS);
    for (let i = 0; i < numWells; i++) {
      let x, y;
      do {
        x = Math.random() * 100;
        y = Math.random() * 100;
      } while (Math.abs(x - 50) < CENTER_EXCLUSION_RADIUS && Math.abs(y - 50) < CENTER_EXCLUSION_RADIUS);
      
      wells.push({
        x,
        y,
        strength: Math.random() * GRAVITY_STRENGTH + GRAVITY_STRENGTH / 2,
        isActive: false
      });
    }
    return wells;
  }, []);

  const randomizeWellPositions = useCallback(() => {
    setGameState(prevState => ({
      ...prevState,
      gravityWells: generateGravityWells()
    }));
  }, [generateGravityWells]);

  const startWellGeneration = useCallback(() => {
    wellGenerationRef.current = window.setInterval(() => {
      setGameState(prevState => {
        if (prevState.gravityWells.length >= MAX_GRAVITY_WELLS) {
          return prevState;
        }
        let x, y;
        do {
          x = Math.random() * 100;
          y = Math.random() * 100;
        } while (Math.abs(x - 50) < CENTER_EXCLUSION_RADIUS && Math.abs(y - 50) < CENTER_EXCLUSION_RADIUS);
        
        return {
          ...prevState,
          gravityWells: [
            ...prevState.gravityWells,
            {
              x,
              y,
              strength: Math.random() * GRAVITY_STRENGTH + GRAVITY_STRENGTH / 2,
              isActive: false
            }
          ]
        };
      });
    }, WELL_GENERATION_INTERVAL);
  }, []);

  const applyGravity = useCallback((pos, speed) => {
    let newSpeed = { ...speed };
    let wellsActivated = false;
    setGameState(prevState => {
      const newWells = prevState.gravityWells.map(well => {
        const dx = well.x - pos.x;
        const dy = well.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < GRAVITY_WELL_RADIUS) {
          const gravityEffect = (dx / distance) * well.strength;
          newSpeed.x += gravityEffect;
          newSpeed.y += (dy / distance) * well.strength;
          if (!well.isActive) {
            wellsActivated = true;
          }
          return { ...well, isActive: true };
        }
        return { ...well, isActive: false };
      });
      return { ...prevState, gravityWells: newWells };
    });
    if (wellsActivated) {
      playSound('gravity');
    }
    // Ensure the ball doesn't slow down
    const currentSpeed = Math.sqrt(newSpeed.x * newSpeed.x + newSpeed.y * newSpeed.y);
    const minSpeed = Math.sqrt(speed.x * speed.x + speed.y * speed.y);
    if (currentSpeed < minSpeed) {
      const factor = minSpeed / currentSpeed;
      newSpeed.x *= factor;
      newSpeed.y *= factor;
    }
    return newSpeed;
  }, [playSound]);

  const resetBallPosition = useCallback(() => {
    setGameState(prevState => ({
      ...prevState,
      ballPos: { x: 50, y: 50 },
      ballSpeed: { 
        x: Math.random() * 0.9 - 0.45, 
        y: Math.random() < 0.5 ? -INITIAL_BALL_SPEED : INITIAL_BALL_SPEED 
      },
      ballSpeedMultiplier: 1
    }));
    randomizeWellPositions();
  }, [randomizeWellPositions]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const gameLoop = () => {
      setGameState(prevState => {
        let newX = prevState.ballPos.x + prevState.ballSpeed.x * prevState.ballSpeedMultiplier;
        let newY = prevState.ballPos.y + prevState.ballSpeed.y * prevState.ballSpeedMultiplier;

        // Apply gravity
        const newSpeed = applyGravity({ x: newX, y: newY }, prevState.ballSpeed);

        // Bounce off side walls
        if (newX <= 2 || newX >= 98) {
          newX = Math.max(2, Math.min(98, newX));
          newSpeed.x = -newSpeed.x;
        }

        // Ball collision with paddles
        if (newY <= 5 && Math.abs(newX - prevState.aiPaddle) < 15) {
          newY = 5;
          newSpeed.x += Math.random() * 0.6 - 0.3;
          newSpeed.y = Math.abs(newSpeed.y);
          playSound('hit');
        } else if (newY >= 95 && Math.abs(newX - prevState.playerPaddle) < 15) {
          newY = 95;
          newSpeed.x += Math.random() * 0.6 - 0.3;
          newSpeed.y = -Math.abs(newSpeed.y);
          playSound('hit');
        }

        // Ensure the ball doesn't slow down after paddle collision
        const currentSpeed = Math.sqrt(newSpeed.x * newSpeed.x + newSpeed.y * newSpeed.y);
        const minSpeed = INITIAL_BALL_SPEED * prevState.ballSpeedMultiplier;
        if (currentSpeed < minSpeed) {
          const factor = minSpeed / currentSpeed;
          newSpeed.x *= factor;
          newSpeed.y *= factor;
        }

        // Scoring
        let newScore = { ...prevState.score };
        if (newY <= 2) {
          newScore.player += 1;
          updateHighScore(newScore.player);
          if (newScore.player >= WINNING_SCORE) {
            setGameOver(true);
          }
          resetBallPosition();
          playSound('score');
          return { 
            ...prevState, 
            score: newScore, 
            ballPos: { x: 50, y: 50 },
            ballSpeed: { x: Math.random() * 0.9 - 0.45, y: INITIAL_BALL_SPEED },
            ballSpeedMultiplier: 1
          };
        } else if (newY >= 98) {
          newScore.ai += 1;
          if (newScore.ai >= WINNING_SCORE) {
            setGameOver(true);
          }
          resetBallPosition();
          playSound('score');
          return { 
            ...prevState, 
            score: newScore, 
            ballPos: { x: 50, y: 50 },
            ballSpeed: { x: Math.random() * 0.9 - 0.45, y: -INITIAL_BALL_SPEED },
            ballSpeedMultiplier: 1
          };
        }

        // Update AI paddle
        const aiTargetPos = prevState.ballPos.x;
        const aiDiff = aiTargetPos - prevState.aiPaddle;
        const newAiPos = prevState.aiPaddle + (aiDiff > 0 ? Math.min(aiDiff, 0.5) : Math.max(aiDiff, -0.5));

        return {
          ...prevState,
          ballPos: { x: newX, y: newY },
          ballSpeed: newSpeed,
          aiPaddle: Math.max(15, Math.min(85, newAiPos)),
          ballSpeedMultiplier: prevState.ballSpeedMultiplier + BALL_SPEED_INCREMENT
        };
      });

      if (!gameOver) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      if (wellGenerationRef.current) {
        clearInterval(wellGenerationRef.current);
      }
    };
  }, [gameStarted, gameOver, applyGravity, playSound, resetBallPosition, updateHighScore]);

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen p-4 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} transition-colors duration-300`}>
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Gravity Well Frenzy</h1>
          <div className="flex gap-2">
            <button
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={() => setIsSoundOn(!isSoundOn)}
              aria-label={isSoundOn ? 'Mute sound' : 'Unmute sound'}
            >
              {isSoundOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
            </button>
            <button
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>
          </div>
        </div>
        
        {!gameStarted || gameOver ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">
              {gameOver ? (gameState.score.player > gameState.score.ai ? 'You Win!' : 'AI Wins!') : 'Ready for Gravity?'}
            </h2>
            {gameOver && (
              <>
                <p className="mb-2">Final Score: {gameState.score.player} - {gameState.score.ai}</p>
                <p className="mb-4">High Score: {highScore}</p>
              </>
            )}
            <button 
              onClick={handleStartGame} 
              className="w-full mb-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-2 px-4 rounded transition-all duration-300"
            >
              {gameOver ? 'Play Again' : 'Start Game'}
            </button>
            {gameOver && (
              <div className="mt-8 p-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-center text-white">
                <h3 className="text-2xl font-semibold mb-4">Gravity Well Frenzy: A Cosmic Thrill Ride!</h3>
                <p className="mb-4">
                🌀 Dive into a mesmerizing universe where gravity is your playground! Gravity Well Frenzy challenges you to navigate through a dynamic arena filled with trajectory-altering gravity wells and a cunning AI opponent.
                </p>
                <p className="text-lg font-bold text-yellow-300">
                  Ready to bend the laws of physics and claim your place among the stars?
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-4 text-white">
              <h3 className="text-lg font-semibold mb-2">Daily Challenge</h3>
              <p className="text-yellow-300">{dailyChallenge}</p>
            </div>
            <div 
              ref={gameAreaRef}
              className="relative w-full aspect-[4/3] rounded-lg overflow-hidden cursor-pointer bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 shadow-lg"
              onMouseMove={handlePlayerMove}
              onTouchMove={handlePlayerMove}
            >
              <div 
                className="absolute top-0 h-2 w-[30%] bg-purple-500 rounded-full shadow-neon-purple"
                style={{ left: `${gameState.aiPaddle - 15}%` }}
              />
              <div 
                className="absolute bottom-0 h-2 w-[30%] bg-pink-500 rounded-full shadow-neon-pink"
                style={{ left: `${gameState.playerPaddle - 15}%` }}
              />
              <div 
                className="absolute w-3 h-3 bg-yellow-400 rounded-full shadow-neon-yellow"
                style={{ left: `${gameState.ballPos.x}%`, top: `${gameState.ballPos.y}%`, transform: 'translate(-50%, -50%)' }}
              />
              {gameState.gravityWells.map((well, index) => (
                <div
                  key={index}
                  className={`absolute w-10 h-10 rounded-full bg-blue-500 opacity-30 ${
                    well.isActive ? 'animate-ping' : 'animate-pulse'
                  }`}
                  style={{
                    left: `${well.x}%`,
                    top: `${well.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}
              <div className="absolute top-2 left-2 text-xl font-bold text-purple-400">
                {gameState.score.ai}
              </div>
              <div className="absolute bottom-2 left-2 text-xl font-bold text-pink-400">
                {gameState.score.player}
              </div>
            </div>
          </div>
        )}
        
        <p className="mt-4 text-center text-sm opacity-75">
          Move your mouse/finger to control your paddle (bottom). Watch out for gravity wells! First to {WINNING_SCORE} points wins!
        </p>
      </div>
    </div>
  );
}

export default App;