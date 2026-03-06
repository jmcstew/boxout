import { useState, useEffect, useRef, useCallback } from 'react'
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

// Audio context for sound effects
let audioCtx = null

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

const playSound = (type) => {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    switch (type) {
      case 'click':
        oscillator.frequency.setValueAtTime(440, ctx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.1)
        break
        
      case 'destroy':
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(200, ctx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3)
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.3)
        
        // Add noise burst
        const noise = ctx.createOscillator()
        const noiseGain = ctx.createGain()
        noise.type = 'sawtooth'
        noise.frequency.setValueAtTime(100, ctx.currentTime)
        noiseGain.gain.setValueAtTime(0.1, ctx.currentTime)
        noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
        noise.connect(noiseGain)
        noiseGain.connect(ctx.destination)
        noise.start(ctx.currentTime)
        noise.stop(ctx.currentTime + 0.2)
        break
        
      case 'win':
        // Happy ascending arpeggio
        const notes = [523, 659, 784, 1047]
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
          gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3)
          osc.start(ctx.currentTime + i * 0.15)
          osc.stop(ctx.currentTime + i * 0.15 + 0.3)
        })
        return
        
      case 'lose':
        // Sad descending
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(300, ctx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5)
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.5)
        
        // Second descending tone
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.frequency.setValueAtTime(250, ctx.currentTime + 0.2)
        osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.7)
        gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.2)
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7)
        osc2.start(ctx.currentTime + 0.2)
        osc2.stop(ctx.currentTime + 0.7)
        return
        
      default:
        break
    }
  } catch (e) {
    console.log('Audio not available')
  }
}

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
  const [animationState, setAnimationState] = useState('idle')
  const prevBoardRef = useRef([])

  useEffect(() => {
    const saved = localStorage.getItem('boxout_progress')
    if (saved) {
      const data = JSON.parse(saved)
      setMaxUnlocked(data.maxUnlocked || 1)
      setCompletedLevels(data.completed || {})
    }
  }, [])

  // Play sound on status change
  useEffect(() => {
    if (status === 'won') playSound('win')
    if (status === 'lost') playSound('lose')
  }, [status])

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
    
    playSound('click')
    
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
      
      prevBoardRef.current = board
      setAnimationState('destroying')
      
      setTimeout(() => {
        playSound('destroy')
        setBoard(data.board)
        setScore(data.score)
        setMoves(data.moves)
        setStatus(data.status)
        setMessage('')
        
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
        <div className={`board ${animationState}`} style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
          {board.flat().map((block, idx) => (
            <div key={block?.id || `empty-${idx}`} className={`cell ${block ? 'filled' : 'empty'} ${block?.block_type || ''} ${animationState === 'destroying' ? 'destroying' : ''}`}
              style={{ backgroundColor: getBlockColor(block) }} onClick={() => handleClick(block)} />
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
