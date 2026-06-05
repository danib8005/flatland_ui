# Flatland UI

Human-in-the-Loop Dispatcher fuer Flatland Bahnsimulation.

## Setup

    pyenv local flatland_ui
    bash scripts/setup_00_repo.sh
    bash scripts/setup_01_backend.sh
    cd backend && pip install -r requirements.txt
    uvicorn app.main:app --reload

## Team

- Adrian Egli
- Michaela Hildebrandt
- Daniel Boos
