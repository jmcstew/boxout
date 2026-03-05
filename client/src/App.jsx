import { useState, useEffect } from 'react'
import './App.css'

const COLORS = {
  red: '#E53935',
  blue: '#1E88E5',
  yellow: '#FDD835',
  green: '#43A047',
  purple: '#8E24AA'
}

const BOARD_SIZE = 8

function App() {
  const [board, setBoard] = useState([])
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(0)
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
          colors: ['red', 'blue', 'green', 'yellow', 'purple']
        })
      })
      const data = await response.json()
      setBoard(data.board)
      setScore(data.score)
      setMoves(data.moves)
      setMessage('')
    } catch (err) {
      setMessage('Backend not running. Start server with: cd server && uvicorn main:app --reload')
    }
  }

  const handleClick = async (block) => {
    if (!block) return
    
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
      setMessage('')
    } catch (err) {
      setMessage('Error communicating with server')
    }
  }

  return (
    <div className="game-container">
      <h1>Boxout</h1>
      
      <div className="stats">
        <span>Score: {score}</span>
        <span>Moves: {moves}</span>
      </div>
      
      {message && <div className="message">{message}</div>}
      
      <div className="board" style={{ 
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`
      }}>
        {board.flat().map((block, idx) => (
          <div
            key={block?.id || `empty-${idx}`}
            className={`cell ${block ? 'filled' : 'empty'}`}
            style={{
              backgroundColor: block ? COLORS[block.color] : '#1a1a2e'
            }}
            onClick={() => handleClick(block)}
          />
        ))}
      </div>
      
      <button onClick={newGame} className="new-game-btn">
        New Game
      </button>
    </div>
  )
}

export default App
