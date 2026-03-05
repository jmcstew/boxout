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

function App() {
  const [board, setBoard] = useState([])
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(0)
  const [status, setStatus] = useState('playing') // 'playing', 'won', 'lost'
  const [message, setMessage] = useState('')

  useEffect(() => {
    newGame()
  }, [])

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
      setMessage('Backend not running. Start server with: cd server && uvicorn main:app --reload')
    }
  }

  const handleClick = async (block) => {
    if (!block || block.block_type !== 'destructor') {
      return
    }
    
    if (status !== 'playing') return
    
    console.log('Destructor clicked:', {
      id: block.id,
      color: block.color,
      position: `(${block.row}, ${block.col})`
    })
    
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

  return (
    <div className="game-container">
      <h1>Boxout</h1>
      
      <div className="stats">
        <span>Score: {score}</span>
        <span>Moves: {moves}</span>
      </div>
      
      {message && <div className="message">{message}</div>}
      
      {status === 'playing' && (
        <div className="board" style={{ 
          gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`
        }}>
          {board.flat().map((block, idx) => (
            <div
              key={block?.id || `empty-${idx}`}
              className={`cell ${block ? 'filled' : 'empty'} ${block?.block_type || ''}`}
              style={{
                backgroundColor: getBlockColor(block)
              }}
              onClick={() => handleClick(block)}
              title={block?.block_type === 'destructor' ? 'Destructor - Click to destroy!' : 'Game Piece'}
            />
          ))}
        </div>
      )}
      
      {status === 'won' && (
        <div className="overlay victory">
          <h2>🎉 Level Complete!</h2>
          <p>Final Score: {score}</p>
          <p>Moves: {moves}</p>
          <button onClick={newGame} className="new-game-btn">
            Play Again
          </button>
        </div>
      )}
      
      {status === 'lost' && (
        <div className="overlay gameover">
          <h2>💀 Game Over</h2>
          <p>No destructors remaining!</p>
          <p>Final Score: {score}</p>
          <button onClick={newGame} className="new-game-btn">
            Try Again
          </button>
        </div>
      )}
      
      {status === 'playing' && (
        <button onClick={newGame} className="new-game-btn">
          New Game
        </button>
      )}
    </div>
  )
}

export default App
