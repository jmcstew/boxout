from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import random

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Game models
class Block(BaseModel):
    id: int
    color: str
    row: int
    col: int

class GameState(BaseModel):
    board: List[List[Block]]
    score: int
    moves: int

class NewGameRequest(BaseModel):
    rows: int = 8
    cols: int = 8
    colors: List[str] = ["red", "blue", "green", "yellow", "purple"]

COLORS = ["red", "blue", "green", "yellow", "purple"]

def generate_board(rows: int, cols: int, colors: List[str]) -> List[List[Block]]:
    """Generate a new game board with random colored blocks."""
    board = []
    block_id = 0
    for row in range(rows):
        row_blocks = []
        for col in range(cols):
            row_blocks.append(Block(
                id=block_id,
                color=random.choice(colors),
                row=row,
                col=col
            ))
            block_id += 1
        board.append(row_blocks)
    return board

@app.get("/")
async def root():
    return {"message": "Boxout API", "version": "1.0.0"}

@app.post("/api/new-game")
async def new_game(request: NewGameRequest):
    """Start a new game with specified parameters."""
    board = generate_board(request.rows, request.cols, request.colors)
    return GameState(board=board, score=0, moves=0)

@app.post("/api/click")
async def click_block(block_id: int, current_state: GameState):
    """Handle block click - destroy adjacent same-color blocks."""
    # Find the clicked block
    clicked = None
    for row in current_state.board:
        for block in row:
            if block.id == block_id:
                clicked = block
                break
        if clicked:
            break
    
    if not clicked:
        return {"error": "Block not found"}
    
    # Find all adjacent same-color blocks (flood fill)
    to_destroy = find_adjacent(current_state.board, clicked.row, clicked.col, clicked.color)
    
    if len(to_destroy) < 2:
        return {"error": "Need at least 2 adjacent blocks"}
    
    # Remove blocks and apply gravity
    new_board = remove_blocks(current_state.board, to_destroy)
    new_board = apply_gravity(new_board)
    
    # Calculate score
    points = len(to_destroy) * len(to_destroy) * 10
    
    return GameState(
        board=new_board,
        score=current_state.score + points,
        moves=current_state.moves + 1
    )

def find_adjacent(board: List[List[Block]], row: int, col: int, color: str) -> List[Block]:
    """Flood fill to find all connected same-color blocks."""
    if row < 0 or row >= len(board) or col < 0 or col >= len(board[0]):
        return []
    
    target = board[row][col]
    if target is None or target.color != color:
        return []
    
    visited = set()
    stack = [(row, col)]
    result = []
    
    while stack:
        r, c = stack.pop()
        if (r, c) in visited:
            continue
        visited.add((r, c))
        
        block = board[r][c]
        if block and block.color == color:
            result.append(block)
            # Check 4 directions
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < len(board) and 0 <= nc < len(board[0]):
                    stack.append((nr, nc))
    
    return result

def remove_blocks(board: List[List[Block]], blocks: List[Block]) -> List[List[Block]]:
    """Remove blocks from the board."""
    block_ids = {b.id for b in blocks}
    new_board = []
    for row in board:
        new_row = [b if b.id not in block_ids else None for b in row]
        new_board.append(new_row)
    return new_board

def apply_gravity(board: List[List[Block]]) -> List[List[Block]]:
    """Apply gravity - make blocks fall down."""
    if not board:
        return board
    
    cols = len(board[0])
    rows = len(board)
    new_board = [[None] * cols for _ in range(rows)]
    
    for col in range(cols):
        new_row = []
        for row in range(rows):
            if board[row][col] is not None:
                new_row.append(board[row][col])
        
        # Fill from bottom
        for i, block in enumerate(new_row):
            new_board[rows - len(new_row) + i][col] = block
    
    return new_board

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
