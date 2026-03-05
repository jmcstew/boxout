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
uvicorn main:app --reload
```

### Frontend
```bash
cd client
npm install
npm run dev
```
