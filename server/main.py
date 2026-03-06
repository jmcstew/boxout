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
    if level <= 10:
        rows, cols = 8, 8
    elif level <= 25:
        rows, cols = 9, 9
    else:
        rows, cols = 10, 10
    
    if level <= 10:
        destructor_chance = 0.22 - (level - 1) * 0.01
    elif level <= 25:
        destructor_chance = 0.18 - (level - 11) * 0.005
    else:
        destructor_chance = 0.12 - (level - 26) * 0.002
    destructor_chance = max(0.08, destructor_chance)
    
    if level <= 5:
        colors = ["red", "blue", "green"]
    elif level <= 15:
        colors = ["red", "blue", "green", "yellow"]
    else:
        colors = ["red", "blue", "green", "yellow", "purple"]
    
    return {"rows": rows, "cols": cols, "destructor_chance": destructor_chance, "colors": colors}

def generate_winnable_board(level: int, seed: Optional[int] = None) -> List[List[Block]]:
    if seed:
        random.seed(seed)
    
    diff = get_difficulty_for_level(level)
    rows, cols = diff["rows"], diff["cols"]
    colors = diff["colors"]
    
    board = [[None for _ in range(cols)] for _ in range(rows)]
    block_id = 0
    
    num_destructors = max(3, int(rows * cols * diff["destructor_chance"] * 0.6))
    
    for _ in range(num_destructors):
        attempts = 0
        placed = False
        
        while attempts < 20 and not placed:
            existing = [(r, c) for r in range(rows) for c in range(cols) if board[r][c] is not None]
            
            if existing and random.random() < 0.75:
                base_r, base_c = random.choice(existing)
                dr, dc = random.choice([(-1,0), (1,0), (0,-1), (0,1)])
                r, c = base_r + dr, base_c + dc
            else:
                r, c = random.randint(0, rows-1), random.randint(0, cols-1)
            
            if 0 <= r < rows and 0 <= c < cols and board[r][c] is None:
                color = random.choice(colors)
                board[r][c] = Block(id=block_id, color=color, row=r, col=c, block_type="destructor")
                block_id += 1
                placed = True
            attempts += 1
    
    for r in range(rows):
        for c in range(cols):
            if board[r][c] is None:
                color = random.choice(colors)
                board[r][c] = Block(id=block_id, color=color, row=r, col=c, block_type="gamepiece")
                block_id += 1
    
    return board

def clone_board(board: List[List[Block]]) -> List[List[Optional[Block]]]:
    new_board = []
    for row in board:
        new_row = []
        for block in row:
            if block:
                new_row.append(Block(id=block.id, color=block.color, row=block.row, col=block.col, block_type=block.block_type))
            else:
                new_row.append(None)
        new_board.append(new_row)
    return new_board

def find_connected(board: List[List[Optional[Block]]], row: int, col: int, color: str) -> Set[int]:
    rows, cols = len(board), len(board[0])
    if row < 0 or row >= rows or col < 0 or col >= cols:
        return set()
    
    connected = set()
    stack = [(row, col)]
    visited = set()
    
    while stack:
        r, c = stack.pop()
        if (r, c) in visited:
            continue
        visited.add((r, c))
        
        block = board[r][c]
        if block and block.color == color:
            connected.add(block.id)
            directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
            for dr, dc in directions:
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols:
                    stack.append((nr, nc))
    
    return connected

def apply_gravity_sim(board: List[List[Optional[Block]]]) -> List[List[Optional[Block]]]:
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

def simulate_click(board: List[List[Optional[Block]]], block_id: int) -> List[List[Optional[Block]]]:
    rows, cols = len(board), len(board[0])
    
    clicked = None
    for row in board:
        for block in row:
            if block and block.id == block_id:
                clicked = block
                break
        if clicked:
            break
    
    if not clicked or clicked.block_type != "destructor":
        return board
    
    to_destroy = find_connected(board, clicked.row, clicked.col, clicked.color)
    to_destroy.add(clicked.id)
    
    if len(to_destroy) < 2:
        return board  # No valid move - return unchanged
    
    new_board = []
    for row in board:
        new_row = [b if b is None or b.id not in to_destroy else None for b in row]
        new_board.append(new_row)
    
    return apply_gravity_sim(new_board)

def has_winnable_moves(board: List[List[Optional[Block]]]) -> bool:
    if not board:
        return False
    
    rows, cols = len(board), len(board[0])
    
    for row in range(rows):
        for col in range(cols):
            block = board[row][col]
            if block and block.block_type == "destructor":
                connected = find_connected(board, row, col, block.color)
                if len(connected) >= 2:
                    return True
    
    return False

def is_solvable(board: List[List[Block]], max_depth: int = 50) -> bool:
    sim_board = clone_board(board)
    
    for _ in range(max_depth):
        has_blocks = any(b for row in sim_board for b in row if b)
        if not has_blocks:
            return True
        
        if not has_winnable_moves(sim_board):
            return False
        
        best_move = None
        best_count = 0
        
        rows, cols = len(sim_board), len(sim_board[0])
        for row in range(rows):
            for col in range(cols):
                block = sim_board[row][col]
                if block and block.block_type == "destructor":
                    connected = find_connected(sim_board, row, col, block.color)
                    if len(connected) >= 2 and len(connected) > best_count:
                        best_count = len(connected)
                        best_move = block.id
        
        if best_move:
            sim_board = simulate_click(sim_board, best_move)
        else:
            break
    
    has_blocks = any(b for row in sim_board for b in row if b)
    return not has_blocks

def validate_and_generate(level: int, seed: Optional[int] = None) -> List[List[Block]]:
    max_attempts = 10
    
    for attempt in range(max_attempts):
        board = generate_winnable_board(level, seed + attempt if seed else None)
        
        if is_solvable(board):
            print(f"[Level {level}] Generated winnable board (attempt {attempt + 1})")
            return board
        
        print(f"[Level {level}] Regenerating - attempt {attempt + 1} not solvable")
    
    print(f"[Level {level}] Warning: could not generate solvable board after {max_attempts}")
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
    
    # Win: no blocks remaining
    if total == 0:
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
    level = request.level or 1
    board = validate_and_generate(level, request.seed)
    return GameState(board=board, score=0, moves=0, status="playing")

@app.post("/api/click")
async def click_block(block_id: int, current_state: GameState):
    rows = len(current_state.board)
    cols = len(current_state.board[0]) if rows > 0 else 0
    
    if rows == 0 or cols == 0:
        return {"error": "Invalid board"}
    
    # Find block
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
    
    # Check if this is a valid move (has adjacent same-color)
    target_color = clicked.color
    to_destroy: Set[int] = {clicked.id}
    
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    for dr, dc in directions:
        adj_row, adj_col = clicked.row + dr, clicked.col + dc
        if 0 <= adj_row < rows and 0 <= adj_col < cols:
            adj_block = current_state.board[adj_row][adj_col]
            if adj_block and adj_block.color == target_color:
                to_destroy.add(adj_block.id)
    
    # Must have at least 2 blocks to destroy (destructor + adjacent)
    if len(to_destroy) < 2:
        return {"error": "Need at least 1 adjacent same-color block"}
    
    # Valid move - process destruction
    points_per_block = COLOR_POINTS.get(target_color, 10)
    total_points = len(to_destroy) * points_per_block
    
    new_board = remove_blocks(current_state.board, to_destroy)
    new_board = apply_gravity(new_board)
    new_board = fill_from_top(new_board)
    
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

def fill_from_top(board: List[List[Optional[Block]]]) -> List[List[Optional[Block]]]:
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
