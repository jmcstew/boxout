from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Set, Optional
import random
import sqlite3
import os
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "/tmp/boxout_leaderboard.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS leaderboard
                 (id INTEGER PRIMARY KEY, username TEXT, avatar TEXT, level INTEGER, score INTEGER, timestamp TEXT)''')
    conn.commit()
    conn.close()

init_db()

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

class ClickRequest(BaseModel):
    block_id: int
    current_state: GameState

class SubmitScoreRequest(BaseModel):
    username: str
    avatar: str
    level: int
    score: int

class ClickResponse(BaseModel):
    board: List[List[Optional[Block]]]
    score: int
    moves: int
    status: str
    destroyed_ids: List[int]

def get_difficulty_for_level(level: int) -> dict:
    if level <= 10: rows, cols = 8, 8
    elif level <= 25: rows, cols = 9, 9
    else: rows, cols = 10, 10
    if level <= 10: destructor_chance = max(0.08, 0.22 - (level - 1) * 0.01)
    elif level <= 25: destructor_chance = max(0.08, 0.18 - (level - 11) * 0.005)
    else: destructor_chance = max(0.08, 0.12 - (level - 26) * 0.002)
    colors = ["red", "blue", "green"] if level <= 5 else ["red", "blue", "green", "yellow"] if level <= 15 else ["red", "blue", "green", "yellow", "purple"]
    return {"rows": rows, "cols": cols, "destructor_chance": destructor_chance, "colors": colors}

def generate_winnable_board(level: int, seed: Optional[int] = None) -> List[List[Block]]:
    if seed is not None:
        random.seed(seed)
    diff = get_difficulty_for_level(level)
    rows, cols, colors = diff["rows"], diff["cols"], diff["colors"]
    board = [[None for _ in range(cols)] for _ in range(rows)]
    heights = [0] * cols
    block_id = 0
    
    # Keep going until the board is mostly full
    # We use a while loop to fill column by column from the bottom
    while any(h < rows for h in heights):
        available_cols = [c for c in range(cols) if heights[c] < rows]
        if not available_cols:
            break
            
        # Pick a column for the destructor
        c = random.choice(available_cols)
        color = random.choice(colors)
        
        # 1. Place the destructor at the bottom of its column
        r = rows - 1 - heights[c]
        board[r][c] = Block(id=block_id, color=color, row=r, col=c, block_type="destructor")
        block_id += 1
        heights[c] += 1
        
        # 2. Add blocks to the left, right, and same columns as fodder
        # This ensures the destructor always has something of its color to destroy
        for dc in [-1, 0, 1]:
            tc = c + dc
            if 0 <= tc < cols and heights[tc] < rows:
                tr = rows - 1 - heights[tc]
                # Only place a block if it's empty
                if board[tr][tc] is None:
                    board[tr][tc] = Block(id=block_id, color=color, row=tr, col=tc, block_type="gamepiece")
                    block_id += 1
                    heights[tc] += 1
                    
    # Fill any remaining gaps just in case
    for r in range(rows):
        for c in range(cols):
            if board[r][c] is None:
                board[r][c] = Block(id=block_id, color=random.choice(colors), row=r, col=c, block_type="gamepiece")
                block_id += 1
                
    return board

def clone_board(board: List[List[Block]]) -> List[List[Optional[Block]]]:
    return [[Block(id=b.id, color=b.color, row=b.row, col=b.col, block_type=b.block_type) if b else None for b in row] for row in board]

def find_connected(board: List[List[Optional[Block]]], row: int, col: int, color: str) -> Set[int]:
    rows, cols = len(board), len(board[0])
    if row < 0 or row >= rows or col < 0 or col >= cols: return set()
    connected, stack, visited = set(), [(row, col)], set()
    while stack:
        r, c = stack.pop()
        if (r, c) in visited: continue
        visited.add((r, c))
        block = board[r][c]
        if block and block.color == color:
            connected.add(block.id)
            for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
                nr, nc = r+dr, c+dc
                if 0 <= nr < rows and 0 <= nc < cols: stack.append((nr, nc))
    return connected

def apply_gravity_sim(board: List[List[Optional[Block]]]) -> List[List[Optional[Block]]]:
    if not board: return board
    cols, rows = len(board[0]), len(board)
    new_board = [[None] * cols for _ in range(rows)]
    for col in range(cols):
        new_row = [board[row][col] for row in range(rows) if board[row][col] is not None]
        for i, block in enumerate(new_row): new_board[rows - len(new_row) + i][col] = block
    return new_board

def has_winnable_moves(board: List[List[Optional[Block]]]) -> bool:
    if not board: return False
    rows, cols = len(board), len(board[0])
    for r in range(rows):
        for c in range(cols):
            block = board[r][c]
            if block and block.block_type == "destructor" and len(find_connected(board, r, c, block.color)) >= 2: return True
    return False

def is_solvable(board: List[List[Block]], max_depth: int = 50) -> bool:
    sim_board = clone_board(board)
    for _ in range(max_depth):
        if not any(b for row in sim_board for b in row if b): return True
        if not has_winnable_moves(sim_board): return False
        best_move, best_count = None, 0
        for r in range(len(sim_board)):
            for c in range(len(sim_board[0])):
                block = sim_board[r][c]
                if block and block.block_type == "destructor":
                    count = len(find_connected(sim_board, r, c, block.color))
                    if count >= 2 and count > best_count: best_count, best_move = count, block.id
        if best_move:
            # Simulate click
            clicked = next((b for row in sim_board for b in row if b and b.id == best_move), None)
            if clicked:
                to_destroy = find_connected(sim_board, clicked.row, clicked.col, clicked.color)
                to_destroy.add(clicked.id)
                if len(to_destroy) >= 2:
                    sim_board = [[b if b is None or b.id not in to_destroy else None for b in row] for row in sim_board]
                    sim_board = apply_gravity_sim(sim_board)
        else: break
    return not any(b for row in sim_board for b in row if b)

def validate_and_generate(level: int, seed: Optional[int] = None) -> List[List[Block]]:
    for attempt in range(10):
        board = generate_winnable_board(level, seed + attempt if seed else None)
        if is_solvable(board): return board
    return board

def check_game_status(board: List[List[Optional[Block]]]) -> str:
    # Check if ALL blocks were destroyed (win)
    total = sum(1 for row in board for b in row if b is not None)
    if total == 0:
        return "won"
    
    # Check if no destructors remain but game pieces do (lose)
    destructors = sum(1 for row in board for b in row if b and b.block_type == "destructor")
    gamepieces = sum(1 for row in board for b in row if b and b.block_type == "gamepiece")
    
    if destructors == 0 and gamepieces > 0:
        return "lost"
    
    return "playing"

@app.get("/")
async def root(): return {"message": "Boxout API", "version": "1.0.0"}

@app.post("/api/new-game")
async def new_game(request: NewGameRequest):
    board = validate_and_generate(request.level or 1, request.seed)
    return GameState(board=board, score=0, moves=0, status="playing")

@app.post("/api/click")
async def click_block(request: ClickRequest):
    block_id = request.block_id
    current_state = request.current_state
    # Validate input
    rows, cols = len(current_state.board), len(current_state.board[0]) if current_state.board else 0
    if not rows or not cols: return {"error": "Invalid board"}
    if current_state.status != "playing": return {"error": "Game is over"}
    
    # Find clicked block
    clicked = None
    for row in current_state.board:
        for block in row:
            if block and block.id == block_id:
                clicked = block
                break
        if clicked:
            break
    
    if not clicked: return {"error": "Block not found"}
    if clicked.block_type != "destructor": return {"error": "Only destructors can be clicked"}
    
    # Find adjacent same-color blocks
    target_color = clicked.color
    to_destroy = {clicked.id}
    
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    for dr, dc in directions:
        adj_row, adj_col = clicked.row + dr, clicked.col + dc
        if 0 <= adj_row < rows and 0 <= adj_col < cols:
            adj_block = current_state.board[adj_row][adj_col]
            if adj_block and adj_block.color == target_color and adj_block.block_type != "destructor":
                to_destroy.add(adj_block.id)
    
    # Process destruction
    new_board = [[b if b is None or b.id not in to_destroy else None for b in row] for row in current_state.board]
    new_board = apply_gravity_sim(new_board)
    
    # Calculate score
    points_per_block = COLOR_POINTS.get(target_color, 10)
    total_points = len(to_destroy) * points_per_block
    
    # Check game status
    status = check_game_status(new_board)
    
    return ClickResponse(
        board=new_board,
        score=current_state.score + total_points,
        moves=current_state.moves + 1,
        status=status,
        destroyed_ids=list(to_destroy)
    )

def apply_gravity(board: List[List[Optional[Block]]]) -> List[List[Optional[Block]]]:
    if not board: return board
    cols, rows = len(board[0]), len(board)
    new_board = [[None] * cols for _ in range(rows)]
    for col in range(cols):
        new_row = [board[row][col] for row in range(rows) if board[row][col] is not None]
        for i, block in enumerate(new_row): new_board[rows - len(new_row) + i][col] = block
    return new_board

def fill_from_top(board: List[List[Optional[Block]]]) -> List[List[Optional[Block]]]:
    if not board: return board
    cols, rows, colors = len(board[0]), len(board), ["red", "blue", "green", "yellow", "purple"]
    max_id = max((b.id for row in board for b in row if b), default=0)
    next_id = max_id + 1
    new_board = []
    for r, row in enumerate(board):
        new_row = []
        for c, block in enumerate(row):
            if block is None:
                new_row.append(Block(id=next_id, color=random.choice(colors), row=r, col=c, block_type="destructor" if random.random() < 0.15 else "gamepiece"))
                next_id += 1
            else:
                block.row, block.col = r, c
                new_row.append(block)
        new_board.append(new_row)
    return new_board

# Leaderboard endpoints
@app.get("/api/leaderboard")
async def get_leaderboard(limit: int = 10):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT username, avatar, level, score FROM leaderboard ORDER BY score DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return [{"username": r[0], "avatar": r[1], "level": r[2], "score": r[3]} for r in rows]

@app.post("/api/leaderboard")
async def submit_score(request: SubmitScoreRequest):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO leaderboard (username, avatar, level, score, timestamp) VALUES (?, ?, ?, ?, ?)",
               (request.username, request.avatar, request.level, request.score, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/leaderboard/{username}")
async def get_player_rank(username: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT MAX(score) FROM leaderboard WHERE username = ?", (username,))
    best = c.fetchone()[0] or 0
    c.execute("SELECT COUNT(*) FROM leaderboard WHERE score > ?", (best,))
    rank = (c.fetchone()[0] or 0) + 1
    c.execute("SELECT username, avatar, level, score FROM leaderboard WHERE username = ? ORDER BY score DESC LIMIT 5", (username,))
    scores = [{"level": r[2], "score": r[3]} for r in c.fetchall()]
    conn.close()
    return {"bestScore": best, "rank": rank, "scores": scores}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
