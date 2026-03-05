from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Set, Optional
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COLOR_POINTS = {"red": 10, "blue": 15, "yellow": 20, "green": 25, "purple": 30}

class Block(BaseModel):
    id: int
    color: str
    row: int
    col: int
    block_type: str = "gamepiece"

class GameState(BaseModel):
    board: List[List[Optional[Block]]]
    score: int
    moves: int
    status: str = "playing"

class NewGameRequest(BaseModel):
    level: int = 1
    seed: Optional[int] = None

def get_difficulty_for_level(level: int) -> dict:
    if level <= 5:
        rows, cols = 8, 8
    elif level <= 10:
        rows, cols = 9, 9
    else:
        rows, cols = 10, 10
    
    base_chance = 0.20
    destructor_chance = max(0.12, base_chance - (level - 1) * 0.005)
    
    if level <= 3:
        colors = ["red", "blue", "green"]
    elif level <= 7:
        colors = ["red", "blue", "green", "yellow"]
    else:
        colors = ["red", "blue", "green", "yellow", "purple"]
    
    return {"rows": rows, "cols": cols, "destructor_chance": destructor_chance, "colors": colors}

def generate_winnable_board(level: int, seed: Optional[int] = None) -> List[List[Block]]:
    """Generate a guaranteed winnable board using reverse placement."""
    if seed:
        random.seed(seed)
    
    diff = get_difficulty_for_level(level)
    rows, cols = diff["rows"], diff["cols"]
    colors = diff["colors"]
    
    # Start with empty board
    board = [[None for _ in range(cols)] for _ in range(rows)]
    block_id = 0
    
    # Place solvable destructors using "explosion" pattern
    num_destructors = max(3, int(rows * cols * diff["destructor_chance"] * 0.5))
    
    for _ in range(num_destructors):
        # Pick a random empty position or near existing blocks
        attempts = 0
        placed = False
        
        while attempts < 20 and not placed:
            # Try to place near existing blocks for connectivity
            existing = [(r, c) for r in range(rows) for c in range(cols) if board[r][c] is not None]
            
            if existing and random.random() < 0.7:
                # Place near existing block
                base_r, base_c = random.choice(existing)
                dr, dc = random.choice([(-1,0), (1,0), (0,-1), (0,1)])
                r, c = base_r + dr, base_c + dc
            else:
                # Place randomly
                r, c = random.randint(0, rows-1), random.randint(0, cols-1)
            
            if 0 <= r < rows and 0 <= c < cols and board[r][c] is None:
                color = random.choice(colors)
                board[r][c] = Block(id=block_id, color=color, row=r, col=c, block_type="destructor")
                block_id += 1
                placed = True
            attempts += 1
    
    # Fill remaining with game pieces
    for r in range(rows):
        for c in range(cols):
            if board[r][c] is None:
                color = random.choice(colors)
                board[r][c] = Block(id=block_id, color=color, row=r, col=c, block_type="gamepiece")
                block_id += 1
    
    return board

def check_game_status(board: List[List[Optional[Block]]]) -> str:
    total = destructors = gamepieces = 0
    for row in board:
        for block in row:
            if block is not None:
                total += 1
                if block.block_type == "destructor":
                    destructors += 1
                else:
                    gamepieces += 1
    if total == 0:
        return "won"
    if destructors == 0 and gamepieces > 0:
        return "lost"
    return "playing"

@app.get("/")
async def root():
    return {"message": "Boxout API", "version": "1.0.0"}

@app.post("/api/new-game")
async def new_game(request: NewGameRequest):
    level = request.level or 1
    board = generate_winnable_board(level, request.seed)
    return GameState(board=board, score=0, moves=0, status="playing")

@app.post("/api/click")
async def click_block(block_id: int, current_state: GameState):
    rows = len(current_state.board)
    cols = len(current_state.board[0]) if rows > 0 else 0
    
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
    
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    for dr, dc in directions:
        adj_row, adj_col = clicked.row + dr, clicked.col + dc
        if 0 <= adj_row < rows and 0 <= adj_col < cols:
            adj_block = current_state.board[adj_row][adj_col]
            if adj_block and adj_block.color == target_color:
                to_destroy.add(adj_block.id)
    
    if len(to_destroy) < 2:
        return {"error": "Need at least 1 adjacent same-color block"}
    
    points_per_block = COLOR_POINTS.get(target_color, 10)
    total_points = len(to_destroy) * points_per_block
    
    new_board = remove_blocks(current_state.board, to_destroy)
    new_board = apply_gravity(new_board)
    new_board = fill_from_top(new_board, level=1)
    
    status = check_game_status(new_board)
    
    return GameState(
        board=new_board,
        score=current_state.score + total_points,
        moves=current_state.moves + 1,
        status=status
    )

def remove_blocks(board: List[List[Optional[Block]]], block_ids: Set[int]) -> List[List[Optional[Block]]]:
    new_board = []
    for row in board:
        new_row = [b if b is None or b.id not in block_ids else None for b in row]
        new_board.append(new_row)
    return new_board

def apply_gravity(board: List[List[Optional[Block]]]) -> List[List[Optional[Block]]]:
    if not board:
        return board
    cols = len(board[0])
    rows = len(board)
    new_board = [[None] * cols for _ in range(rows)]
    
    for col in range(cols):
        new_row = [board[row][col] for row in range(rows) if board[row][col] is not None]
        for i, block in enumerate(new_row):
            new_board[rows - len(new_row) + i][col] = block
    return new_board

def fill_from_top(board: List[List[Optional[Block]]], level: int) -> List[List[Optional[Block]]]:
    if not board:
        return board
    cols = len(board[0])
    rows = len(board)
    colors = ["red", "blue", "green", "yellow", "purple"]
    
    max_id = max((b.id for row in board for b in row if b), default=0)
    next_id = max_id + 1
    
    new_board = []
    for row_idx, row in enumerate(board):
        new_row = []
        for col_idx, block in enumerate(row):
            if block is None:
                color = random.choice(colors)
                block_type = "destructor" if random.random() < 0.15 else "gamepiece"
                new_row.append(Block(id=next_id, color=color, row=row_idx, col=col_idx, block_type=block_type))
                next_id += 1
            else:
                block.row, block.col = row_idx, col_idx
                new_row.append(block)
        new_board.append(new_row)
    return new_board

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
