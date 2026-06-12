# Flatland Dispatcher UI

Human-in-the-Loop Train-Dispatching auf Basis von Flatland-RL.




## Architektur

3-Spalten-HMI (Phase A-D in Migration):

- LEFT (280px): Notifications + Layer-Visibility + Sidebar
- MIDDLE (1fr): Track Layout (Map) + Graphic Timetable (Marey) + Simulation Slider
- RIGHT (320px): Scenarios + KPI Filter + Recommendations + Inspector

Backend: FastAPI + Flatland-RL.
Frontend: Angular 18 (standalone components, signals) + SBB Lyne Elements.

## Voraussetzungen

- Python 3.12+
- Node.js 20+ / npm 10+

## Backend - Setup + Start
```bash
cd ~/workspace/ai4realnet/flatland_ui/backend
```

# Erstmals: virtuelle Umgebung
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
# Start (Auto-Reload bei Code-Aenderung)
```
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend laeuft dann auf http://localhost:8000:
- API-Docs interactive: http://localhost:8000/docs
- Health-Check: http://localhost:8000/health

### Wichtige Endpoints

POST   /session                              # Neue Session
GET    /session/{id}/state                   # Aktueller State
POST   /session/{id}/step                    # Step ausfuehren
POST   /session/{id}/play                    # Auto-play start
POST   /session/{id}/pause                   # Pause
POST   /session/{id}/reset                   # Reset
POST   /session/{id}/agent/{handle}/override # Action-Override setzen
DELETE /session/{id}/agent/{handle}/override # Override loeschen

# HMI Mock-Daten (procedural per Seed)
GET    /session/{id}/hmi/notifications
GET    /session/{id}/hmi/scenarios
GET    /session/{id}/hmi/recommendations
GET    /session/{id}/hmi                      # Alles in einem Bundle

# WebSocket (Live-State-Updates)
WS     /ws/session/{id}

## Frontend - Setup + Start
```bash
cd ~/workspace/ai4realnet/flatland_ui/frontend
```

# Erstmals
```bash
npm install
```

# Start (Hot-Module-Reload)
```bash
npm run start
```

Frontend laeuft auf http://localhost:4200.

## Quick-Start (zwei Terminals)

Terminal 1 - Backend:
```bash
cd ~/workspace/ai4realnet/flatland_ui/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```
Terminal 2 - Frontend:
```bash
cd ~/workspace/ai4realnet/flatland_ui/frontend
npm run start
```
Browser: http://localhost:4200

## Smoke-Test (curl)

# Session erzeugen
```bash
curl -sL -X POST http://localhost:8000/session \
  -H "Content-Type: application/json" \
  -d '{"width":50,"height":20,"number_of_agents":3}'
```
# State holen
```bash
curl -s http://localhost:8000/session/<ID>/state | head -c 500
```

# HMI-Bundle
```bash
curl -s http://localhost:8000/session/<ID>/hmi
```
## Troubleshooting

Backend startet nicht:
```bash
cd ~/workspace/ai4realnet/flatland_ui/backend
source .venv/bin/activate
python -c "import flatland; print(flatland.__version__)"
```
Falls ModuleNotFoundError: pip install -r requirements.txt

Frontend kompiliert nicht:
```bash
cd ~/workspace/ai4realnet/flatland_ui/frontend
rm -rf node_modules package-lock.json
npm install
npm run start
```
 
 
  
- Pan via Maus-Drag + 5 Pan-Buttons

