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

const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐨', '🐙', '🦄', '🐲', '🦅', '🐙']

let audioCtx = null

const getAudioContext = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
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
        break
      case 'win':
        [523, 659, 784, 1047].forEach((freq, i) => {
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
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(300, ctx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5)
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.5)
        return
      default:
        break
    }
  } catch (e) {}
}

function findValidMoves(board) {
  if (!board || board.length === 0) return new Set()
  const validMoves = new Set()
  const rows = board.length
  const cols = board[0].length
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const block = board[r]?.[c]
      if (block && block.block_type === 'destructor') {
        const directions = [[-1,0],[1,0],[0,-1],[0,1]]
        for (const [dr, dc] of directions) {
          const adj = board[r+dr]?.[c+dc]
          if (adj && adj.color === block.color) {
            validMoves.add(block.id)
            break
          }
        }
      }
    }
  }
  return validMoves
}

function App() {
  const [screen, setScreen] = useState('profiles') // profiles, map, game
  const [profiles, setProfiles] = useState([])
  const [currentProfile, setCurrentProfile] = useState(null)
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
  const [validMoves, setValidMoves] = useState(new Set())
  const [hoveredBlock, setHoveredBlock] = useState(null)
  const [lastPoints, setLastPoints] = useState(0)
  const [newUsername, setNewUsername] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = () => {
    const saved = localStorage.getItem('boxout_profiles')
    if (saved) {
      const data = JSON.parse(saved)
      setProfiles(data)
    }
  }

  const saveProfiles = (newProfiles) => {
    localStorage.setItem('boxout_profiles', JSON.stringify(newProfiles))
    setProfiles(newProfiles)
  }

  const createProfile = () => {
    if (!newUsername.trim()) return
    const newProfile = {
      id: Date.now(),
      username: newUsername.trim(),
      avatar: selectedAvatar,
      stats: { played: 0, won: 0, lost: 0, highScore: 0 },
      progress: { maxUnlocked: 1, completed: {} }
    }
    saveProfiles([...profiles, newProfile])
    setNewUsername('')
  }

  const selectProfile = (profile) => {
    setCurrentProfile(profile)
    setMaxUnlocked(profile.progress.maxUnlocked)
    setCompletedLevels(profile.progress.completed)
    setScreen('map')
  }

  const deleteProfile = (id) => {
    saveProfiles(profiles.filter(p => p.id !== id))
    if (currentProfile?.id === id) {
      setCurrentProfile(null)
      setScreen('profiles')
    }
  }

  const updateStats = (newStats) => {
    if (!currentProfile) return
    const updated = { ...currentProfile, stats: newStats, progress: { maxUnlocked, completed: completedLevels } }
    saveProfiles(profiles.map(p => p.id === updated.id ? updated : p))
    setCurrentProfile(updated)
  }

  useEffect(() => {
    if (status === 'won' && currentProfile) {
      const newStats = { ...currentProfile.stats, played: currentProfile.stats.played + 1, won: currentProfile.stats.won + 1, highScore: Math.max(currentProfile.stats.highScore, score) }
      updateStats(newStats)
    }
    if (status === 'lost' && currentProfile) {
      const newStats = { ...currentProfile.stats, played: currentProfile.stats.played + 1, lost: currentProfile.stats.lost + 1 }
      updateStats(newStats)
    }
  }, [status])

  useEffect(() => {
    if (status === 'won') playSound('win')
    if (status === 'lost') playSound('lose')
  }, [status])

  useEffect(() => {
    setValidMoves(findValidMoves(board))
  }, [board])

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
      setScore(data.score)
      setMoves(data.moves)
      setStatus(data.status)
      setMessage('')
      setAnimationState('idle')
      setLastPoints(0)
    } catch (err) {
      setMessage('Backend not running')
    }
  }

  const backToMap = () => {
    if (currentProfile) {
      const updated = { ...currentProfile, progress: { maxUnlocked, completed: completedLevels } }
      saveProfiles(profiles.map(p => p.id === updated.id ? updated : p))
    }
    setScreen('map')
  }

  const nextLevel = () => {
    if (level + 1 <= TOTAL_LEVELS) {
      const nextLvl = level + 1
      setLevel(nextLvl)
      setGridSize(getGridSize(nextLvl))
      newGame(nextLvl)
    }
  }

  const handleLevelComplete = () => {
    const newCompleted = { ...completedLevels, [level]: true }
    setCompletedLevels(newCompleted)
    const nextUnlocked = Math.max(maxUnlocked, level + 1)
    setMaxUnlocked(nextUnlocked)
  }

  const handleClick = async (block) => {
    if (!block || block.block_type !== 'destructor' || status !== 'playing' || animationState !== 'idle') return
    if (!validMoves.has(block.id)) return
    
    playSound('click')
    
    try {
      const response = await fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block_id: block.id, current_state: { board, score, moves } })
      })
      const data = await response.json()
      
      if (data.error) { setMessage(data.error); return }
      
      setLastPoints(data.score - score)
      setAnimationState('destroying')
      
      setTimeout(() => {
        playSound('destroy')
        setBoard(data.board)
        setScore(data.score)
        setMoves(data.moves)
        
        if (data.status === 'won') handleLevelComplete()
        
        setStatus(data.status)
        setMessage('')
        setAnimationState('falling')
        
        setTimeout(() => {
          setAnimationState('idle')
          setLastPoints(0)
        }, 350)
      }, 300)
    } catch (err) { setMessage('Error') }
  }

  const getBlockColor = (block) => {
    if (!block) return 'transparent'
    return (block.block_type === 'destructor' ? DARKER_COLORS : COLORS)[block.color]
  }

  // Profile Selection Screen
  const renderProfiles = () => (
    <div className="profile-screen">
      <h1>Boxout</h1>
      <p className="subtitle">Who's Playing?</p>
      
      <div className="profile-list">
        {profiles.map(p => (
          <div key={p.id} className="profile-card" onClick={() => selectProfile(p)}>
            <span className="profile-avatar">{p.avatar}</span>
            <div className="profile-info">
              <span className="profile-name">{p.username}</span>
              <span className="profile-stats">High Score: {p.stats.highScore}</span>
            </div>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteProfile(p.id) }}>×</button>
          </div>
        ))}
      </div>
      
      <div className="create-profile">
        <h3>New Profile</h3>
        <div className="avatar-select">
          {AVATARS.map(a => (
            <button key={a} className={`avatar-btn ${selectedAvatar === a ? 'selected' : ''}`} onClick={() => setSelectedAvatar(a)}>{a}</button>
          ))}
        </div>
        <input type="text" placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} maxLength={12} />
        <button className="new-game-btn" onClick={createProfile}>Create</button>
      </div>
    </div>
  )

  const renderMap = () => (
    <div className="world-map">
      <div className="profile-header">
        <span className="profile-avatar small">{currentProfile?.avatar}</span>
        <span>{currentProfile?.username}</span>
        <span className="high-score">Best: {currentProfile?.stats.highScore}</span>
      </div>
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
      <button className="back-btn" onClick={() => { setScreen('profiles') }}>Switch Profile</button>
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
        {lastPoints > 0 && <span className="points-popup">+{lastPoints}</span>}
      </div>
      
      {message && <div className="message">{message}</div>}
      
      {status === 'playing' && (
        <div className={`board ${animationState}`} style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
          {board.flat().map((block, idx) => {
            const isValid = block && validMoves.has(block.id)
            const isHovered = hoveredBlock === block?.id
            return (
              <div key={block?.id || `empty-${idx}`} 
                className={`cell ${block ? 'filled' : 'empty'} ${block?.block_type || ''} ${isValid ? 'valid-move' : ''} ${isHovered && isValid ? 'hovered' : ''}`}
                style={{ backgroundColor: getBlockColor(block) }} 
                onClick={() => handleClick(block)}
                onMouseEnter={() => setHoveredBlock(block?.id)}
                onMouseLeave={() => setHoveredBlock(null)}
              />
            )
          })}
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

  if (screen === 'profiles') return renderProfiles()
  if (screen === 'map') return renderMap()
  return renderGame()
}

export default App
