from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Set, Optional
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
    block_type: str = "gamepiece"

class GameState(BaseModel):
    board: List[List[Block]]
    score: int
    moves: int
    status: str = "playing"  # "playing", "won", "lost"

class NewGameRequest(BaseModel):
    rows: int = 8
    cols: int = 8
    colors: List[str] = ["red", "blue", "green", "yellow", "purple"]
    destructor_chance: float = 0.2

def generate_board(rows: int, cols: int, colors: List[str], destructor_chance: float = 0.2) -> List[List[Block]]:
    """Generate a new game board with random colored blocks."""
    board = []
    block_id = 0
    for row in range(rows):
        row_blocks = []
        for col in range(cols):
            color = random.choice(colors)
            block_type = "destructor" if random.random() < destructor_chance else "gamepiece"
            row_blocks.append(Block(
                id=block_id,
                color=color,
                row=row,
                col=col,
                block_type=block_type
            ))
            block_id += 1
        board.append(row_blocks)
    return board

def check_game_status(board: List[List[Block]]) -> str:
    """Check if player won or lost."""
    # Count blocks
    total_blocks = 0
    destructors = 0
    gamepieces = 0
    
    for row in board:
        for block in row:
            if block is not None:
                total_blocks += 1
                if block.block_type == "destructor":
                    destructors += 1
                else:
                    gamepieces += 1
    
    # Win: no blocks remaining
    if total_blocks == 0:
        return "won"
    
    # Lose: no destructors but game pieces remain
    if destructors == 0 and gamepieces > 0:
        return "lost"
    
    # Still playing
    return "playing"

@app.get("/")
async def root():
    return {"message": "Boxout API", "version": "1.0.0"}

@app.post("/api/new-game")
async def new_game(request: NewGameRequest):
    """Start a new game with specified parameters."""
    board = generate_board(request.rows, request.cols, request.colors, request.destructor_chance)
    return GameState(board=board, score=0, moves=0, status="playing")

@app.post("/api/click")
async def click_block(block_id: int, current_state: GameState):
    """Handle destructor click - destroy adjacent same-color blocks."""
    rows = len(current_state.board)
    cols = len(current_state.board[0]) if rows > 0 else 0
    
    # Find the clicked block
    clicked = None
    for row in current_state.board:
        for block in row:
            if block and block.id == block_id:
                clicked = block
                break
        if clicked:
            break
    
    if not clicked:
        return {"error": "Block not found"}
    
    if clicked.block_type != "destructor":
        return {"error": "Only destructors can be clicked"}
    
    target_color = clicked.color
    to_destroy: Set[int] = {clicked.id}
    
    # Check 4 adjacent cells
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    
    for dr, dc in directions:
        adj_row = clicked.row + dr
        adj_col = clicked.col + dc
        
        if 0 <= adj_row < rows and 0 <= adj_col < cols:
            adj_block = current_state.board[adj_row][adj_col]
            if adj_block and adj_block.color == target_color:
                to_destroy.add(adj_block.id)
    
    if len(to_destroy) < 2:
        return {"error": "Need at least 1 adjacent same-color block"}
    
    # Remove blocks, apply gravity, fill with new blocks
    new_board = remove_blocks(current_state.board, to_destroy)
    new_board = apply_gravity(new_board)
    new_board = fill_from_top(new_board)
    
    # Score: exponential bonus
    points = len(to_destroy) * len(to_destroy) * 10
    
    # Check win/lose status
    status = check_game_status(new_board)
    
    return GameState(
        board=new_board,
        score=current_state.score + points,
        moves=current_state.moves + 1,
        status=status
    )

def remove_blocks(board: List[List[Block]], block_ids: Set[int]) -> List[List[Block]]:
    """Remove blocks from the board."""
    new_board = []
    for row in board:
        new_row = [b if b is None or b.id not in block_ids else None for b in row]
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

def fill_from_top(board: List[List[Block]]) -> List[List[Block]]:
    """Fill empty spaces at top with new random blocks."""
    if not board:
        return board
    
    cols = len(board[0])
    rows = len(board)
    colors = ["red", "blue", "green", "yellow", "purple"]
    
    # Find max block_id
    max_id = 0
    for row in board:
        for block in row:
            if block and block.id > max_id:
                max_id = block.id
    next_id = max_id + 1
    
    new_board = []
    for row_idx, row in enumerate(board):
        new_row = []
        for col_idx, block in enumerate(row):
            if block is None:
                # Generate new block
                color = random.choice(colors)
                block_type = "destructor" if random.random() < 0.2 else "gamepiece"
                new_row.append(Block(
                    id=next_id,
                    color=color,
                    row=row_idx,
                    col=col_idx,
                    block_type=block_type
                ))
                next_id += 1
            else:
                block.row = row_idx
                block.col = col_idx
                new_row.append(block)
        new_board.append(new_row)
    
    return new_board

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
