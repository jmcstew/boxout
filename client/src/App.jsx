import { useState, useEffect } from 'react'
import './App.css'

const COLORS = { red: '#E53935', blue: '#1E88E5', yellow: '#FDD835', green: '#43A047', purple: '#8E24AA' }
const DARKER_COLORS = { red: '#B71C1C', blue: '#0D47A1', yellow: '#F9A825', green: '#2E7D32', purple: '#6A1B9A' }
const TOTAL_LEVELS = 50
const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐨', '🐙', '🦄', '🐲', '🦅', '🐙']

let audioCtx = null
const getAudioContext = () => { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx }

const playSound = (type, enabled) => {
  if (!enabled) return
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    switch (type) {
      case 'click': osc.frequency.setValueAtTime(440, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1); break
      case 'destroy': osc.type = 'square'; osc.frequency.setValueAtTime(200, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3); gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3); break
      case 'win': [523, 659, 784, 1047].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(f, ctx.currentTime + i * 0.15); g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15); g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3); o.start(ctx.currentTime + i * 0.15); o.stop(ctx.currentTime + i * 0.15 + 0.3) }); return
      case 'lose': osc.type = 'sine'; osc.frequency.setValueAtTime(300, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5); gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5); return
      case 'highscore': [784, 988, 1175, 1319, 1568].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1); g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.1); g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.2); o.start(ctx.currentTime + i * 0.1); o.stop(ctx.currentTime + i * 0.1 + 0.2) }); return
    }
  } catch (e) {}
}

const STORAGE_KEYS = { PROFILES: 'boxout_proFILES', PREFERENCES: 'boxout_preferences', LEVEL_SCORES: 'boxout_level_scores' }
const loadFromStorage = (key, fallback) => { try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : fallback } catch { return fallback } }
const saveToStorage = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)) } catch {} }

const findValidMoves = (board) => {
  if (!board?.length) return new Set()
  const valid = new Set()
  const [rows, cols] = [board.length, board[0].length]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = board[r]?.[c]
      if (b?.block_type === 'destructor') {
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const adj = board[r+dr]?.[c+dc]
          if (adj?.color === b.color) { valid.add(b.id); break }
        }
      }
    }
  }
  return valid
}

function App() {
  const [screen, setScreen] = useState('profiles') // profiles, map, game, leaderboard
  const [profiles, setProfiles] = useState([])
  const [currentProfile, setCurrentProfile] = useState(null)
  const [preferences, setPreferences] = useState({ sound: true })
  const [levelScores, setLevelScores] = useState({})
  const [leaderboard, setLeaderboard] = useState([])
  const [playerRank, setPlayerRank] = useState(null)
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
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])

  useEffect(() => {
    setProfiles(loadFromStorage(STORAGE_KEYS.PROFILES, []))
    setPreferences(loadFromStorage(STORAGE_KEYS.PREFERENCES, { sound: true }))
    setLevelScores(loadFromStorage(STORAGE_KEYS.LEVEL_SCORES, {}))
    fetchLeaderboard()
  }, [])

  useEffect(() => { saveToStorage(STORAGE_KEYS.PREFERENCES, preferences) }, [preferences])
  useEffect(() => { saveToStorage(STORAGE_KEYS.LEVEL_SCORES, levelScores) }, [levelScores])

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=20')
      const data = await res.json()
      setLeaderboard(data)
    } catch {}
  }

  const submitToLeaderboard = async () => {
    if (!currentProfile || !currentProfile.stats.highScore) return
    try {
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentProfile.username, avatar: currentProfile.avatar, level: TOTAL_LEVELS, score: currentProfile.stats.highScore })
      })
      fetchLeaderboard()
    } catch {}
  }

  const saveProfiles = (newProfiles) => { saveToStorage(STORAGE_KEYS.PROFILES, newProfiles); setProfiles(newProfiles) }
  const createProfile = () => {
    if (!newUsername.trim()) return
    const newProfile = { id: Date.now(), username: newUsername.trim(), avatar: selectedAvatar, stats: { played: 0, won: 0, lost: 0, highScore: 0 }, progress: { maxUnlocked: 1, completed: {} } }
    saveProfiles([...profiles, newProfile])
    setNewUsername('')
  }
  const selectProfile = (profile) => { setCurrentProfile(profile); setMaxUnlocked(profile.progress.maxUnlocked); setCompletedLevels(profile.progress.completed); setScreen('map') }
  const deleteProfile = (id) => { saveProfiles(profiles.filter(p => p.id !== id)); if (currentProfile?.id === id) { setCurrentProfile(null); setScreen('profiles') } }
  const updateProfileStats = (newStats) => {
    if (!currentProfile) return
    const updated = { ...currentProfile, stats: newStats, progress: { maxUnlocked, completed: completedLevels } }
    saveProfiles(profiles.map(p => p.id === updated.id ? updated : p))
    setCurrentProfile(updated)
  }

  useEffect(() => {
    if (!currentProfile) return
    const prevHighScore = levelScores[level] || 0
    if (status === 'won') {
      const isNewHS = score > prevHighScore
      if (isNewHS) { playSound('highscore', preferences.sound); setIsNewHighScore(true); setLevelScores(prev => ({ ...prev, [level]: score })) }
      const newStats = { ...currentProfile.stats, played: currentProfile.stats.played + 1, won: currentProfile.stats.won + 1, highScore: Math.max(currentProfile.stats.highScore, score) }
      updateProfileStats(newStats)
    }
    if (status === 'lost') { const newStats = { ...currentProfile.stats, played: currentProfile.stats.played + 1, lost: currentProfile.stats.lost + 1 }; updateProfileStats(newStats) }
  }, [status])

  useEffect(() => { if (status === 'won') playSound('win', preferences.sound); if (status === 'lost') playSound('lose', preferences.sound) }, [status])
  useEffect(() => { setValidMoves(findValidMoves(board)) }, [board])

  const getGridSize = (lvl) => lvl <= 10 ? 8 : lvl <= 25 ? 9 : 10
  const startLevel = (lvl) => { if (lvl > maxUnlocked) return; setLevel(lvl); setGridSize(getGridSize(lvl)); newGame(lvl); setScreen('game'); setIsNewHighScore(false) }

  const newGame = async (lvl = level) => {
    try {
      const res = await fetch('/api/new-game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: lvl }) })
      const data = await res.json()
      setBoard(data.board); setScore(data.score); setMoves(data.moves); setStatus(data.status); setMessage(''); setAnimationState('idle'); setLastPoints(0); setIsNewHighScore(false)
    } catch { setMessage('Backend not running') }
  }

  const backToMap = () => {
    if (currentProfile) {
      const updated = { ...currentProfile, progress: { maxUnlocked, completed: completedLevels } }
      saveProfiles(profiles.map(p => p.id === updated.id ? updated : p))
    }
    setScreen('map')
  }

  const nextLevel = () => { if (level + 1 <= TOTAL_LEVELS) { setLevel(level + 1); setGridSize(getGridSize(level + 1)); newGame(level + 1) } }
  const handleLevelComplete = () => { setCompletedLevels(prev => ({ ...prev, [level]: true })); setMaxUnlocked(prev => Math.max(prev, level + 1)) }

  const handleClick = async (block) => {
    if (!block || block.block_type !== 'destructor' || status !== 'playing' || animationState !== 'idle') return
    if (!validMoves.has(block.id)) return
    playSound('click', preferences.sound)
    try {
      const res = await fetch('/api/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ block_id: block.id, current_state: { board, score, moves } }) })
      const data = await res.json()
      if (data.error) { setMessage(data.error); return }
      setLastPoints(data.score - score)
      setAnimationState('destroying')
      setTimeout(() => {
        playSound('destroy', preferences.sound)
        setBoard(data.board); setScore(data.score); setMoves(data.moves)
        if (data.status === 'won') handleLevelComplete()
        setStatus(data.status); setMessage('')
        setAnimationState('falling')
        setTimeout(() => { setAnimationState('idle'); setLastPoints(0) }, 350)
      }, 300)
    } catch { setMessage('Error') }
  }

  const getBlockColor = (b) => b ? (b.block_type === 'destructor' ? DARKER_COLORS : COLORS)[b.color] : 'transparent'
  const toggleSound = () => setPreferences(p => ({ ...p, sound: !p.sound }))

  const renderProfiles = () => (
    <div className="profile-screen">
      <h1>Boxout</h1><p className="subtitle">Who's Playing?</p>
      <div className="profile-list">
        {profiles.map(p => (
          <div key={p.id} className="profile-card" onClick={() => selectProfile(p)}>
            <span className="profile-avatar">{p.avatar}</span>
            <div className="profile-info"><span className="profile-name">{p.username}</span><span className="profile-stats">High Score: {p.stats.highScore}</span></div>
            <button className="delete-btn" onClick={e => { e.stopPropagation(); deleteProfile(p.id) }}>×</button>
          </div>
        ))}
      </div>
      <div className="create-profile">
        <h3>New Profile</h3>
        <div className="avatar-select">{AVATARS.map(a => <button key={a} className={`avatar-btn ${selectedAvatar === a ? 'selected' : ''}`} onClick={() => setSelectedAvatar(a)}>{a}</button>)}</div>
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
        <button className="sound-btn" onClick={toggleSound}>{preferences.sound ? '🔊' : '🔇'}</button>
      </div>
      <h1>Boxout</h1><p className="map-subtitle">Select a Level</p>
      <div className="level-nodes">
        {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map(lvl => (
          <button key={lvl} className={`level-node ${completedLevels[lvl] ? 'completed' : ''} ${level === lvl && screen === 'game' ? 'current' : ''} ${lvl > maxUnlocked ? 'locked' : ''}`}
            onClick={() => startLevel(lvl)} disabled={lvl > maxUnlocked}>
            {completedLevels[lvl] ? '✓' : lvl}
            {levelScores[lvl] > 0 && <span className="level-score">{levelScores[lvl]}</span>}
          </button>
        ))}
      </div>
      <div className="map-buttons">
        <button className="back-btn" onClick={() => setScreen('profiles')}>Switch Profile</button>
        <button className="leaderboard-btn" onClick={() => { submitToLeaderboard(); setScreen('leaderboard') }}>🏆 Leaderboard</button>
      </div>
    </div>
  )

  const renderLeaderboard = () => (
    <div className="leaderboard-screen">
      <h1>🏆 Leaderboard</h1>
      <p className="subtitle">Top Players</p>
      <div className="leaderboard-list">
        {leaderboard.map((entry, idx) => (
          <div key={idx} className={`leaderboard-entry ${currentProfile?.username === entry.username ? 'highlight' : ''}`}>
            <span className="rank">#{idx + 1}</span>
            <span className="avatar">{entry.avatar}</span>
            <span className="name">{entry.username}</span>
            <span className="score">{entry.score}</span>
          </div>
        ))}
        {leaderboard.length === 0 && <p className="no-scores">No scores yet! Be the first!</p>}
      </div>
      <button className="back-btn" onClick={() => setScreen('map')}>← Back to Map</button>
    </div>
  )

  const renderGame = () => {
    const personalBest = levelScores[level] || 0
    return (
      <div className="game-container">
        <button className="back-btn" onClick={backToMap}>← Map</button>
        <h1>Boxout</h1>
        <div className="level-display">Level {level}</div>
        <div className="level-info">{gridSize}×{gridSize} grid • Best: {personalBest}</div>
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
              return (
                <div key={block?.id || `empty-${idx}`}
                  className={`cell ${block ? 'filled' : 'empty'} ${block?.block_type || ''} ${isValid ? 'valid-move' : ''} ${hoveredBlock === block?.id && isValid ? 'hovered' : ''}`}
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
            {isNewHighScore && <div className="new-highscore">🏆 NEW HIGH SCORE! 🏆</div>}
            <div className="confetti">🎊</div>
            <h2>Level Complete!</h2>
            <p className="final-score">Score: {score}</p>
            {score >= personalBest && <p className="personal-best">Personal Best! ⭐</p>}
            <p>Moves: {moves}</p>
            {level < TOTAL_LEVELS ? <button onClick={nextLevel} className="new-game-btn next-level-btn">Next Level →</button> : <button onClick={backToMap} className="new-game-btn">All Levels Complete!</button>}
          </div>
        )}
        {status === 'lost' && (
          <div className="overlay gameover">
            <h2>💀 Game Over</h2>
            <p>No destructors left!</p>
            <p className="final-score">Score: {score}</p>
            {personalBest > 0 && <p className="personal-best">Best: {personalBest}</p>}
            <button onClick={() => newGame()} className="new-game-btn">Try Again</button>
          </div>
        )}
      </div>
    )
  }

  if (screen === 'profiles') return renderProfiles()
  if (screen === 'map') return renderMap()
  if (screen === 'leaderboard') return renderLeaderboard()
  return renderGame()
}

export default App
