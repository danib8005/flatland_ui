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

cd ~/workspace/ai4realnet/flatland_ui/frontend

# Erstmals
npm install

# Start (Hot-Module-Reload)
npm run start

Frontend laeuft auf http://localhost:4200.

## Quick-Start (zwei Terminals)

Terminal 1 - Backend:
cd ~/workspace/ai4realnet/flatland_ui/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

Terminal 2 - Frontend:
cd ~/workspace/ai4realnet/flatland_ui/frontend
npm run start

Browser: http://localhost:4200

## Smoke-Test (curl)

# Session erzeugen
curl -sL -X POST http://localhost:8000/session \
  -H "Content-Type: application/json" \
  -d '{"width":50,"height":20,"number_of_agents":3}'

# State holen
curl -s http://localhost:8000/session/<ID>/state | head -c 500

# HMI-Bundle
curl -s http://localhost:8000/session/<ID>/hmi

## Troubleshooting

Backend startet nicht:
cd ~/workspace/ai4realnet/flatland_ui/backend
source .venv/bin/activate
python -c "import flatland; print(flatland.__version__)"
Falls ModuleNotFoundError: pip install -r requirements.txt

Frontend kompiliert nicht:
cd ~/workspace/ai4realnet/flatland_ui/frontend
rm -rf node_modules package-lock.json
npm install
npm run start

WebSocket 403 Forbidden:
- CORS-Origin muss http://localhost:4200 enthalten (in app/config.py)
- Browser auf Strict-CSP-Modus pruefen

Map zeigt nichts an:
- Prüfe F12 -> Network -> /session/{id}/state ob 200 OK
- Prüfe Frontend-Terminal auf TS-Errors

## Migration Status

- [x] Phase A: EventBus + ModuleRegistry + Store-Erweiterung
- [x] Phase B: 3-Spalten-Layout
- [x] Phase C: Wrapper-Components (track-layout, graphic-timetable, layer-visibility)
- [x] Phase D1: Backend HMI Mock-API
- [x] Phase D2: NotificationsPanel
- [x] Phase D3: ScenarioPanel
- [ ] Phase D4: KPI-Filter
- [ ] Phase D5: Recommendations-Panel
- [ ] Phase D6: Simulation-Slider
- [ ] Phase D7: AgentInspector mit Tabs
- [ ] Phase E: Event-Flows (FOCUS, KPI_CHANGED, SCENARIO_CONFIRMED, ...)
- [ ] Phase F: Resizable Spalten

## Map-Visualisierung

- Schienen-Tiles aus Flatland-RL Asset-Library
- Empty-Cells: transparenter Hintergrund
- Switch-Cells: visuelle Weichen-Tiles
- Merge-Cells: oranger Kreis mit Strich (Signal-Symbol im Hintergrund)
- Decision-Layer: gestrichelte Path + Action-Pills bei naechstem Decision-Point
- Pan via Maus-Drag + 5 Pan-Buttons

