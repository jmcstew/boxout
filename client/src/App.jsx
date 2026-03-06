import { useState, useEffect, useCallback } from 'react'
import './App.css'

const COLORS = { red: '#E53935', blue: '#1E88E5', yellow: '#FDD835', green: '#43A047', purple: '#8E24AA' }
const DARKER_COLORS = { red: '#B71C1C', blue: '#0D47A1', yellow: '#F9A825', green: '#2E7D32', purple: '#6A1B9A' }
const TOTAL_LEVELS = 50
const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐨', '🐙', '🦄', '🐲', '🦅', '🦖']

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
  } catch (e) { }
}

const STORAGE_KEYS = { PROFILES: 'boxout_proFILES', PREFERENCES: 'boxout_preferences', LEVEL_SCORES: 'boxout_level_scores' }
const loadFromStorage = (key, fallback) => { try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : fallback } catch { return fallback } }
const saveToStorage = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)) } catch { } }

// Helper: Check if a destructor has adjacent same-color blocks
const hasAdjacentSameColor = (board, row, col) => {
  if (!board || !board[row] || !board[row][col]) return false
  const block = board[row][col]
  if (!block) return false
  const color = block.color
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (const [dr, dc] of directions) {
    const nr = row + dr, nc = col + dc
    if (board[nr] && board[nr][nc] && board[nr][nc].color === color) return true
  }
  return false
}

// Helper: Find all valid moves
const findValidMoves = (board) => {
  const valid = new Set()
  if (!board || !board.length) return valid
  const rows = board.length
  const cols = board[0].length
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = board[r]?.[c]
      if (b?.block_type === 'destructor') {
        valid.add(b.id)
      }
    }
  }
  return valid
}

function App() {
  const [screen, setScreen] = useState('profiles')
  const [profiles, setProfiles] = useState(() => loadFromStorage(STORAGE_KEYS.PROFILES, []))
  const [currentProfile, setCurrentProfile] = useState(null)
  const [preferences, setPreferences] = useState(() => loadFromStorage(STORAGE_KEYS.PREFERENCES, { sound: true }))
  const [levelScores, setLevelScores] = useState(() => loadFromStorage(STORAGE_KEYS.LEVEL_SCORES, {}))
  const [leaderboard, setLeaderboard] = useState([])
  const [board, setBoard] = useState([])
  const [level, setLevel] = useState(1)
  const [maxUnlocked, setMaxUnlocked] = useState(1)
  const [completedLevels, setCompletedLevels] = useState({})
  const [status, setStatus] = useState('playing')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [message, setMessage] = useState('')
  const [gridSize, setGridSize] = useState(8)
  const [animationState, setAnimationState] = useState('idle')
  const [validMoves, setValidMoves] = useState(new Set())
  const [hoveredBlock, setHoveredBlock] = useState(null)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [destroyingIds, setDestroyingIds] = useState(new Set())

  useEffect(() => {
    fetchLeaderboard()
    fetchLevelRecords()
  }, [])

  const fetchLevelRecords = async () => {
    try {
      const res = await fetch('/api/level-records')
      const data = await res.json()
      // Merge with local storage, using a simple merge where server data takes precedence if newer
      // Actually, server data is global so it should probably be the truth for records
      setLevelScores(prev => ({ ...prev, ...data }))
    } catch { }
  }

  const submitLevelRecord = async (payload) => {
    try {
      await fetch('/api/submit-level-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch { }
  }

  useEffect(() => { saveToStorage(STORAGE_KEYS.PREFERENCES, preferences) }, [preferences])
  useEffect(() => { saveToStorage(STORAGE_KEYS.LEVEL_SCORES, levelScores) }, [levelScores])

  // Update valid moves whenever board changes
  useEffect(() => {
    const moves = findValidMoves(board)
    setValidMoves(moves)
  }, [board])

  // Handle timer
  useEffect(() => {
    let interval = null
    if (timerActive && status === 'playing') {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    } else {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [timerActive, status])

  const formatTime = (seconds) => {
    if (seconds === Infinity || seconds === null || seconds === undefined || isNaN(seconds)) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=20')
      const data = await res.json()
      setLeaderboard(data)
    } catch { }
  }

  const submitToLeaderboard = async () => {
    if (!currentProfile) return
    const totalTime = Object.values(levelScores).reduce((sum, item) => sum + (typeof item === 'object' ? (item.username === currentProfile.username ? (item.time || 0) : 0) : 0), 0)
    try {
      await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentProfile.username, avatar: currentProfile.avatar, level: TOTAL_LEVELS, score: totalTime }) })
      fetchLeaderboard()
    } catch { }
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

  const updateProfileStats = (newStats, updatedLevelScores = levelScores) => {
    if (!currentProfile) return
    const totalTime = Object.values(updatedLevelScores).reduce((sum, item) => {
      if (typeof item === 'object' && item.username === currentProfile.username) {
        return sum + (item.time || 0)
      }
      return sum
    }, 0)

    const updated = { ...currentProfile, stats: { ...newStats, highScore: totalTime }, progress: { maxUnlocked, completed: completedLevels } }
    saveProfiles(profiles.map(p => p.id === updated.id ? updated : p))
    setCurrentProfile(updated)
  }

  useEffect(() => {
    if (!currentProfile) return
    const prevStats = levelScores[level] || { time: Infinity, username: '' }
    if (status === 'won') {
      const isNewRecord = elapsedTime < (prevStats.time || Infinity)

      let nextLevelScores = levelScores
      if (isNewRecord) {
        playSound('highscore', preferences.sound)
        setIsNewHighScore(true)

        const updatedEntry = {
          time: elapsedTime,
          username: currentProfile.username,
          avatar: currentProfile.avatar,
        }

        nextLevelScores = { ...levelScores, [level]: updatedEntry }
        setLevelScores(nextLevelScores)

        submitLevelRecord({
          level,
          username: currentProfile.username,
          avatar: currentProfile.avatar,
          time: elapsedTime,
          is_new_record: true
        })
      }

      const newStats = {
        ...currentProfile.stats,
        played: currentProfile.stats.played + 1,
        won: currentProfile.stats.won + 1
      }
      updateProfileStats(newStats, nextLevelScores)
      setTimerActive(false)
    }
    if (status === 'lost') {
      const newStats = { ...currentProfile.stats, played: currentProfile.stats.played + 1, lost: currentProfile.stats.lost + 1 }
      updateProfileStats(newStats, levelScores)
      setTimerActive(false)
    }
  }, [status])

  useEffect(() => { if (status === 'won') playSound('win', preferences.sound); if (status === 'lost') playSound('lose', preferences.sound) }, [status])

  const getGridSize = (lvl) => lvl <= 10 ? 8 : lvl <= 25 ? 9 : 10

  const startLevel = (lvl) => {
    if (lvl > maxUnlocked) return
    setLevel(lvl); setGridSize(getGridSize(lvl)); newGame(lvl); setScreen('game'); setIsNewHighScore(false)
  }

  const newGame = async (lvl = level) => {
    fetchLevelRecords()
    try {
      const res = await fetch('/api/new-game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: lvl }) })
      const data = await res.json()
      setBoard(data.board); setStatus(data.status); setMessage(''); setAnimationState('idle'); setIsNewHighScore(false)
      setElapsedTime(0); setTimerActive(false)
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
    // Block-level validations
    if (!block) return
    if (block.block_type !== 'destructor') {
      setMessage('Only destructors can be clicked')
      return
    }
    if (status !== 'playing') {
      setMessage('Game is over')
      return
    }
    if (animationState !== 'idle') return

    if (!timerActive) setTimerActive(true) // Start timer on first interaction
    playSound('click', preferences.sound)

    try {
      const res = await fetch('/api/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ block_id: block.id, current_state: { board, score: 0, moves: 0 } }) })
      const data = await res.json()

      if (data.error) {
        setMessage(data.error)
        return
      }

      setDestroyingIds(new Set(data.destroyed_ids))
      setAnimationState('destroying')

      setTimeout(() => {
        playSound('destroy', preferences.sound)
        setBoard(data.board)
        setDestroyingIds(new Set())
        if (data.status === 'won') handleLevelComplete()
        setStatus(data.status); setMessage('')
        setAnimationState('falling')
        setTimeout(() => { setAnimationState('idle') }, 350)
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
            <div className="profile-info"><span className="profile-name">{p.username}</span><span className="profile-stats">Total Time: {formatTime(p.stats.highScore)}</span></div>
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
        <span className="high-score">Total Time: {formatTime(currentProfile?.stats.highScore)}</span>
        <button className="sound-btn" onClick={toggleSound}>{preferences.sound ? '🔊' : '🔇'}</button>
      </div>
      <h1>Boxout</h1><p className="map-subtitle">Select a Level</p>
      <div className="level-nodes">
        {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map(lvl => (
          <button key={lvl} className={`level-node ${completedLevels[lvl] ? 'completed' : ''} ${level === lvl && screen === 'game' ? 'current' : ''} ${lvl > maxUnlocked ? 'locked' : ''}`}
            onClick={() => startLevel(lvl)} disabled={lvl > maxUnlocked}>
            {completedLevels[lvl] ? '✓' : lvl}
            {levelScores[lvl] && levelScores[lvl].time > 0 && (
              <span className="level-score">
                {formatTime(levelScores[lvl].time)}
              </span>
            )}
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
      <div className="leaderboard-list">
        {leaderboard.map((entry, idx) => (
          <div key={idx} className={`leaderboard-entry ${currentProfile?.username === entry.username ? 'highlight' : ''}`}>
            <span className="rank">#{idx + 1}</span><span className="avatar">{entry.avatar}</span><span className="name">{entry.username}</span><span className="score">{formatTime(entry.time)}</span>
          </div>
        ))}
        {leaderboard.length === 0 && <p className="no-scores">No scores yet!</p>}
      </div>
      <button className="back-btn" onClick={() => setScreen('map')}>← Back to Map</button>
    </div>
  )

  const renderGame = () => {
    const levelStats = levelScores[level] || { time: Infinity, username: 'N/A', avatar: '' }
    const recordTime = typeof levelStats === 'object' ? (levelStats.time || Infinity) : Infinity
    const recordHolder = typeof levelStats === 'object' ? (levelStats.username || 'N/A') : 'N/A'
    const recordAvatar = typeof levelStats === 'object' ? (levelStats.avatar || '') : ''
    return (
      <div className="game-container">
        <button className="back-btn" onClick={backToMap}>← Map</button>
        <button className="help-btn" onClick={() => setShowHelp(true)}>?</button>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙</button>
        <h1>Boxout</h1>
        {showSettings && (
          <div className="help-overlay" onClick={() => setShowSettings(false)}>
            <div className="help-modal settings-modal" onClick={e => e.stopPropagation()}>
              <button className="help-close" onClick={() => setShowSettings(false)}>×</button>
              <h2>⚙️ Settings</h2>
              <div className="help-content">
                <div className="settings-row">
                  <span className="settings-label">{preferences.sound ? '🔊' : '🔇'} Sound Effects</span>
                  <button className={`toggle-switch ${preferences.sound ? 'on' : 'off'}`} onClick={toggleSound}>
                    <span className="toggle-knob" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showHelp && (
          <div className="help-overlay" onClick={() => setShowHelp(false)}>
            <div className="help-modal" onClick={e => e.stopPropagation()}>
              <button className="help-close" onClick={() => setShowHelp(false)}>×</button>
              <h2>How to Play</h2>
              <div className="help-content">
                <div className="help-section">
                  <h3>🎯 Goal</h3>
                  <p>Clear all blocks from the board to complete the level.</p>
                </div>
                <div className="help-section">
                  <h3>✕ Destructors</h3>
                  <p>Blocks marked with an <strong>✕</strong> are <strong>destructors</strong>. These are the only blocks you can click. They appear darker than regular blocks.</p>
                </div>
                <div className="help-section">
                  <h3>💥 Destroying Blocks</h3>
                  <p>Click a destructor to destroy it along with any adjacent (up/down/left/right) blocks of the <strong>same color</strong>. Destructors cannot destroy other destructors — only regular blocks.</p>
                </div>
                <div className="help-section">
                  <h3>⬇️ Gravity</h3>
                  <p>After blocks are destroyed, remaining blocks fall down to fill the gaps. No new blocks appear from the top.</p>
                </div>
                <div className="help-section">
                  <h3>⏱️ Speed Run</h3>
                  <p>Clear the board as fast as possible. Your total time across all 50 levels determines your rank on the global leaderboard!</p>
                </div>
                <div className="help-section">
                  <h3>💀 Game Over</h3>
                  <p>If you run out of destructors while blocks remain, the level is lost. Try again!</p>
                </div>
                <div className="help-section">
                  <h3>💡 Tips</h3>
                  <p>Blocks with a <strong>green glow</strong> are valid moves — they have at least one adjacent same-color block to destroy. Plan your moves carefully!</p>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="level-display">Level {level}</div>
        <div className="level-info">
          <div>Fastest Clear: {formatTime(recordTime)} {recordTime !== Infinity && <span className="record-txt">by {recordAvatar} {recordHolder}</span>}</div>
        </div>
        <div className="timer-display">
          <div className="timer-value">{formatTime(elapsedTime)}</div>
          <div className="timer-label">Time</div>
        </div>
        {message && <div className="message">{message}</div>}
        {status === 'playing' && (
          <div className={`board ${animationState}`} style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
            {board.flat().map((block, idx) => {
              const isValid = block && block.block_type === 'destructor'
              const isHovered = hoveredBlock === block?.id
              return (
                <div key={block?.id || `empty-${idx}`}
                  className={`cell ${block ? 'filled' : 'empty'} ${block?.block_type || ''} ${isValid ? 'valid-move' : ''} ${isHovered && isValid ? 'hovered' : ''} ${destroyingIds.has(block?.id) ? 'destroying' : ''}`}
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
            {isNewHighScore && <div className="new-highscore">⏱️ NEW RECORD TIME! ⏱️</div>}
            <div className="confetti">🎊</div>
            <h2>Level Complete!</h2>
            <p className="final-score">Time: {formatTime(elapsedTime)}</p>
            {elapsedTime <= recordTime && <p className="personal-best">Personal Best! ⭐</p>}
            {level < TOTAL_LEVELS ? <button onClick={nextLevel} className="new-game-btn next-level-btn">Next Level →</button> : <button onClick={backToMap} className="new-game-btn">All Levels Complete!</button>}
          </div>
        )}
        {status === 'lost' && (
          <div className="overlay gameover">
            <h2>💀 Game Over</h2>
            <p>No destructors left!</p>
            <p className="final-score">Time: {formatTime(elapsedTime)}</p>
            {recordTime !== Infinity && <p className="personal-best">Best: {formatTime(recordTime)}</p>}
            <button onClick={() => newGame()} className="new-game-btn">Try Again</button>
          </div>
        )}
      </div>
    )
  }

  if (screen === 'profiles') return renderProfiles()
  if (screen === 'leaderboard') return renderLeaderboard()
  if (screen === 'map') return renderMap()
  return renderGame()
}

export default App
