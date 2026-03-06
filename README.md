# Boxout - Puzzle Game

A block-clearing puzzle game where players destroy adjacent same-color blocks.

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** FastAPI + SQLAlchemy

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

> **Note:** The Vite dev server proxies all `/api` requests to the backend on the same machine, so LAN devices only need to access the frontend URL. Make sure both the backend (port 8000) and frontend (port 5173) are running on the host machine.
