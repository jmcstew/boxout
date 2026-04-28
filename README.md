# Boxout - Puzzle Game

A block-clearing puzzle game where players strategically use "destructor" blocks to wipe the board across 50 increasingly challenging levels.

## Features

### Gameplay
- **Two block types:** *Destructors* (darker, marked ✕) are the only blocks you can click. *Gamepieces* are the targets you need to eliminate.
- **Click to destroy:** Clicking a destructor removes it along with any adjacent (up/down/left/right) same-color gamepieces. Destructors cannot destroy other destructors.
- **Gravity:** After each destruction, remaining blocks fall down to fill gaps. No new blocks appear.
- **Valid move hints:** Destructors with at least one adjacent same-color block glow green so you can spot legal moves at a glance.
- **Win/Lose:** Clear every block from the board to win. Run out of destructors while gamepieces remain and it's game over.

### 50 Levels with Scaling Difficulty
| Levels | Grid | Colors | Destructor density |
|--------|------|--------|-------------------|
| 1–10   | 8×8  | 3      | High              |
| 11–25  | 9×9  | 4      | Medium            |
| 26–50  | 10×10| 5      | Low               |

All boards are generated to be solvable — no unwinnable levels.

### Speed Run Mode
- A per-level timer starts on your first click.
- Your fastest clear time is saved for each level (globally shared).
- Your **total time across all 50 levels** is your score on the global leaderboard — lowest time wins.

### Profiles & Progress
- Create multiple local profiles, each with a chosen emoji avatar.
- Progress (unlocked levels, completions, total time) is saved per profile.
- Levels unlock sequentially; complete a level to open the next.

### Global Leaderboard
- Rankings are based on cumulative time to complete all 50 levels.
- Per-level fastest-clear records are displayed in-game, showing who holds each record.

### Sound Effects
- Synthesized audio feedback for clicks, block destruction, level win/loss, and new record times.
- Sound can be toggled on/off from the Settings menu (⚙) or the map screen.

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** FastAPI + SQLAlchemy (SQLite for leaderboard persistence)

## Development

### Backend
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0
```

### Frontend
```bash
cd client
npm install
npm run dev
```

## LAN Access

Both the frontend and backend are configured to listen on all network interfaces (`0.0.0.0`), making the game accessible from any device on your local network.

1. Start the backend and frontend as described above.
2. Find your machine's local IP address:
   - **Windows:** `ipconfig` (look for IPv4 Address)
   - **Mac/Linux:** `ifconfig` or `ip addr`
3. From another device on the same network, open a browser and go to:
   ```
   http://<your-ip>:5173
   ```
   For example: `http://192.168.1.100:5173`

> **Note:** The Vite dev server proxies all `/api` requests to the backend on the same machine, so LAN devices only need the frontend URL. Make sure both the backend (port 8000) and frontend (port 5173) are running on the host machine.
