import { useState, useEffect, useRef } from 'react'
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

const TOTAL_LEVELS = 50

function App() {
  const [screen, setScreen] = useState('map')
  const [board, setBoard] = useState([])
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(0)
  const [level, setLevel] = useState(1)
  const [maxUnlocked, setMaxUnlocked] = useState(1)
  const [completedLevels, setCompletedLevels] = useState({})
  const [status, setStatus] = useState('playing')
  const [message, setMessage] = useState('')
  const [gridSize, setGridSize] = useState(8)
  const [animationState, setAnimationState] = useState('idle') // idle, destroying, falling
  const prevBoardRef = useRef([])
  const boardRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('boxout_progress')
    if (saved) {
      const data = JSON.parse(saved)
      setMaxUnlocked(data.maxUnlocked || 1)
      setCompletedLevels(data.completed || {})
    }
  }, [])

  const saveProgress = (unlocked, completed) => {
    localStorage.setItem('boxout_progress', JSON.stringify({ maxUnlocked: unlocked, completed }))
  }

  const getGridSize = (lvl) => {
    if (lvl <= 10) return 8
    if (lvl <= 25) return 9
    return 10
  }

  const startLevel = (lvl) => {
    if (lvl > maxUnlocked) return
    setLevel(lvl)
    setGridSize(getGridSize(lvl))
    newGame(lvl)
    setScreen('game')
  }

  const newGame = async (lvl = level) => {
    try {
      const response = await fetch('/api/new-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: lvl })
      })
      const data = await response.json()
      setBoard(data.board)
      prevBoardRef.current = data.board
      setScore(data.score)
      setMoves(data.moves)
      setStatus(data.status)
      setMessage('')
      setAnimationState('idle')
    } catch (err) {
      setMessage('Backend not running')
    }
  }

  const backToMap = () => setScreen('map')

  const nextLevel = () => {
    if (level + 1 <= TOTAL_LEVELS) {
      const nextLvl = level + 1
      setLevel(nextLvl)
      setGridSize(getGridSize(nextLvl))
      newGame(nextLvl)
    }
  }

  const handleClick = async (block) => {
    if (!block || block.block_type !== 'destructor' || status !== 'playing' || animationState !== 'idle') return
    
    try {
      const response = await fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block_id: block.id, current_state: { board, score, moves } })
      })
      const data = await response.json()
      
      if (data.error) {
        setMessage(data.error)
        return
      }
      
      // Store previous board for animation tracking
      prevBoardRef.current = board
      
      // Trigger destruction animation
      setAnimationState('destroying')
      
      setTimeout(() => {
        setBoard(data.board)
        setScore(data.score)
        setMoves(data.moves)
        setStatus(data.status)
        setMessage('')
        
        // Then trigger falling animation
        setAnimationState('falling')
        
        setTimeout(() => {
          setAnimationState('idle')
        }, 350)
      }, 300)
      
    } catch (err) {
      setMessage('Error')
    }
  }

  const getBlockColor = (block) => {
    if (!block) return 'transparent'
    return (block.block_type === 'destructor' ? DARKER_COLORS : COLORS)[block.color]
  }

  const renderMap = () => (
    <div className="world-map">
      <h1>Boxout</h1>
      <p className="map-subtitle">Select a Level</p>
      <div className="level-nodes">
        {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map(lvl => {
          const isCompleted = completedLevels[lvl]
          const isCurrent = level === lvl && screen === 'game'
          const isUnlocked = lvl <= maxUnlocked
          return (
            <button key={lvl} className={`level-node ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${!isUnlocked ? 'locked' : ''}`}
              onClick={() => startLevel(lvl)} disabled={!isUnlocked}>
              {isCompleted ? '✓' : lvl}
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderGame = () => (
    <div className="game-container">
      <button className="back-btn" onClick={backToMap}>← Map</button>
      <h1>Boxout</h1>
      <div className="level-display">Level {level}</div>
      <div className="level-info">{gridSize}×{gridSize} grid</div>
      
      <div className="score-display">
        <span className="score-label">Score</span>
        <span className="score-value">{score}</span>
      </div>
      
      {message && <div className="message">{message}</div>}
      
      {status === 'playing' && (
        <div 
          ref={boardRef}
          className={`board ${animationState}`}
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {board.flat().map((block, idx) => (
            <div 
              key={block?.id || `empty-${idx}`} 
              className={`cell ${block ? 'filled' : 'empty'} ${block?.block_type || ''} ${animationState === 'destroying' ? 'destroying' : ''}`}
              style={{ backgroundColor: getBlockColor(block) }}
              onClick={() => handleClick(block)}
            />
          ))}
        </div>
      )}
      
      {status === 'won' && (
        <div className="overlay victory">
          <div className="confetti">🎊</div>
          <h2>Level Complete!</h2>
          <p className="final-score">Score: {score}</p>
          <p>Moves: {moves}</p>
          {level < TOTAL_LEVELS ? (
            <button onClick={nextLevel} className="new-game-btn next-level-btn">Next Level →</button>
          ) : (
            <button onClick={backToMap} className="new-game-btn">All Levels Complete!</button>
          )}
        </div>
      )}
      
      {status === 'lost' && (
        <div className="overlay gameover">
          <h2>💀 Game Over</h2>
          <p>No destructors left!</p>
          <p className="final-score">Score: {score}</p>
          <button onClick={() => newGame()} className="new-game-btn">Try Again</button>
        </div>
      )}
    </div>
  )

  return screen === 'map' ? renderMap() : renderGame()
}

export default App
