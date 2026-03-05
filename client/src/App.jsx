import { useState, useEffect } from 'react'

const COLORS = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7'
}

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
          rows: 8,
          cols: 8,
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
      
      <div className="board">
        {board.map((row, rowIdx) => (
          <div key={rowIdx} className="row">
            {row.map((block, colIdx) => (
              <div
                key={block?.id || `${rowIdx}-${colIdx}`}
                className={`block ${block ? 'filled' : 'empty'}`}
                style={{
                  backgroundColor: block ? COLORS[block.color] : 'transparent'
                }}
                onClick={() => handleClick(block)}
              />
            ))}
          </div>
        ))}
      </div>
      
      <button onClick={newGame} className="new-game-btn">
        New Game
      </button>
    </div>
  )
}

export default App
