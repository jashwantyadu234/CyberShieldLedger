# CyberShield Ledger

An AI-assisted cybercrime intake and triage demo with encrypted evidence, integrity proofs, threat intelligence, and role-based citizen, investigator, and administrator portals.

## Included demo flow

1. A citizen signs in and files a complaint with optional evidence.
2. The API extracts indicators, classifies the complaint, scores risk, and identifies potential duplicates.
3. Evidence is encrypted and represented by a SHA-256 integrity hash; the hash is anchored through the blockchain adapter.
4. Investigators can triage cases, inspect the threat graph, and verify the chain of custody.
5. Citizens can query a phone number or UPI ID before making a payment.

## Run locally

Open two terminals in the project root.

```powershell
# Terminal 1: API
python -m pip install -r backend/requirements.txt
Set-Location backend
uvicorn app.main:app --reload --port 8000
```

```powershell
# Terminal 2: web portal
Set-Location frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The web portal proxies `/api` requests to the FastAPI service at port 8000. Before starting the API, copy `backend/.env.example` to `backend/.env` and set strong, unique `SECRET_KEY` and `EVIDENCE_ENCRYPTION_KEY` values.

## Production web build

```powershell
Set-Location frontend
npm run build
```

The static site is generated in `frontend/dist`. Deploy it behind a web server that forwards `/api` requests to the FastAPI service, or set an appropriate production API base URL.

## Project structure

- `frontend/` — React, TypeScript, Vite, and Tailwind user portals.
- `backend/` — FastAPI application package, AI, analytics, encrypted evidence, and ledger adapter.
- `Contracts/` — Solidity smart contract source for ledger interactions.
