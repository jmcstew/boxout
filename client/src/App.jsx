import { useState, useEffect } from 'react'
import './App.css'

const COLORS = {
  red: '#E53935',
  blue: '#1E88E5',
  yellow: '#FDD835',
  green: '#43A047',
  purple: '#8E24AA'
}

const DARKER_COLORS = {
  red: '#B71C1C',
  blue: '#0D47A1',
  yellow: '#F9A825',
  green: '#2E7D32',
  purple: '#6A1B9A'
}

const BOARD_SIZE = 8

// World map with 15 levels
const TOTAL_LEVELS = 15
const levelsPerRow = 5

function App() {
  const [screen, setScreen] = useState('map') // 'map' or 'game'
  const [board, setBoard] = useState([])
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(0)
  const [level, setLevel] = useState(1)
  const [maxUnlocked, setMaxUnlocked] = useState(1)
  const [completedLevels, setCompletedLevels] = useState({})
  const [status, setStatus] = useState('playing')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Load saved progress from localStorage
    const saved = localStorage.getItem('boxout_progress')
    if (saved) {
      const data = JSON.parse(saved)
      setMaxUnlocked(data.maxUnlocked || 1)
      setCompletedLevels(data.completed || {})
    }
  }, [])

  const saveProgress = (unlocked, completed) => {
    localStorage.setItem('boxout_progress', JSON.stringify({
      maxUnlocked: unlocked,
      completed: completed
    }))
  }

  const startLevel = (lvl) => {
    if (lvl > maxUnlocked) return
    setLevel(lvl)
    newGame()
    setScreen('game')
  }

  const newGame = async () => {
    try {
      const response = await fetch('/api/new-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: BOARD_SIZE,
          cols: BOARD_SIZE,
          colors: ['red', 'blue', 'green', 'yellow', 'purple'],
          destructor_chance: 0.2
        })
      })
      const data = await response.json()
      setBoard(data.board)
      setScore(data.score)
      setMoves(data.moves)
      setStatus(data.status)
      setMessage('')
    } catch (err) {
      setMessage('Backend not running')
    }
  }

  const handleLevelComplete = () => {
    const newCompleted = { ...completedLevels, [level]: true }
    setCompletedLevels(newCompleted)
    
    const nextUnlocked = Math.max(maxUnlocked, level + 1)
    setMaxUnlocked(nextUnlocked)
    saveProgress(nextUnlocked, newCompleted)
  }

  const backToMap = () => {
    setScreen('map')
  }

  const nextLevel = () => {
    const nextLvl = level + 1
    if (nextLvl <= TOTAL_LEVELS) {
      setLevel(nextLvl)
      newGame()
    }
  }

  const handleClick = async (block) => {
    if (!block || block.block_type !== 'destructor') {
      return
    }
    
    if (status !== 'playing') return
    
    try {
      const response = await fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_id: block.id,
          current_state: { board, score, moves }
        })
      })
      const data = await response.json()
      
      if (data.error) {
        setMessage(data.error)
        return
      }
      
      setBoard(data.board)
      setScore(data.score)
      setMoves(data.moves)
      setStatus(data.status)
      setMessage('')
    } catch (err) {
      setMessage('Error communicating with server')
    }
  }

  const getBlockColor = (block) => {
    if (!block) return 'transparent'
    const colorMap = block.block_type === 'destructor' ? DARKER_COLORS : COLORS
    return colorMap[block.color]
  }

  // Render world map
  const renderMap = () => (
    <div className="world-map">
      <h1>Boxout</h1>
      <p className="map-subtitle">Select a Level</p>
      
      <div className="level-nodes">
        {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map(lvl => {
          const isCompleted = completedLevels[lvl]
          const isCurrent = level === lvl && screen === 'game'
          const isUnlocked = lvl <= maxUnlocked
          const isLocked = !isUnlocked
          
          return (
            <button
              key={lvl}
              className={`level-node ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isLocked ? 'locked' : ''}`}
              onClick={() => startLevel(lvl)}
              disabled={isLocked}
            >
              {isCompleted ? '✓' : lvl}
            </button>
          )
        })}
      </div>
      
      <div className="map-path" />
    </div>
  )

  // Render game screen
  const renderGame = () => (
    <div className="game-container">
      <button className="back-btn" onClick={backToMap}>← Map</button>
      
      <h1>Boxout</h1>
      <div className="level-display">Level {level}</div>
      
      <div className="score-display">
        <span className="score-label">Score</span>
        <span className="score-value">{score}</span>
      </div>
      
      {message && <div className="message">{message}</div>}
      
      {status === 'playing' && (
        <>
          <div className="board" style={{ 
            gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`
          }}>
            {board.flat().map((block, idx) => (
              <div
                key={block?.id || `empty-${idx}`}
                className={`cell ${block ? 'filled' : 'empty'} ${block?.block_type || ''}`}
                style={{ backgroundColor: getBlockColor(block) }}
                onClick={() => handleClick(block)}
                title={block?.block_type === 'destructor' ? 'Destructor!' : 'Game Piece'}
              />
            ))}
          </div>
        </>
      )}
      
      {status === 'won' && (
        <div className="overlay victory">
          <div className="confetti">🎊</div>
          <h2>Level Complete!</h2>
          <p className="final-score">Score: {score}</p>
          <p>Moves: {moves}</p>
          
          {level < TOTAL_LEVELS ? (
            <button onClick={nextLevel} className="new-game-btn next-level-btn">
              Next Level →
            </button>
          ) : (
            <button onClick={backToMap} className="new-game-btn">
              Back to Map
            </button>
          )}
        </div>
      )}
      
      {status === 'lost' && (
        <div className="overlay gameover">
          <h2>💀 Game Over</h2>
          <p>No destructors left!</p>
          <p className="final-score">Score: {score}</p>
          <button onClick={newGame} className="new-game-btn">
            Try Again
          </button>
        </div>
      )}
    </div>
  )

  return screen === 'map' ? renderMap() : renderGame()
}

export default App
