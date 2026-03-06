# Deployment Guide: Pipette Calibration Management System

This document is intended for the IT/Informatics department to facilitate the deployment and maintenance of the Pipette Calibration Management System on a local server.

## 1. System Architecture
- **Backend:** FastAPI (Python 3.10+) utilizing SQLModel for ORM.
- **Frontend:** React (TypeScript) built with Vite.
- **Database:** SQLite with Write-Ahead Logging (WAL) enabled for enhanced concurrency.
- **Caching/State:** Client-side state management; SQLite for persistent storage.

## 2. Infrastructure Requirements
- **OS:** Windows Server 2019+ or Linux (Ubuntu 22.04 LTS recommended).
- **RAM:** 4GB minimum.
- **Storage:** 10GB (SSD preferred for SQLite performance).
- **Runtime:** 
  - Python 3.10+
  - Node.js 18+ (for build phase)
  - Git

## 3. Recommended Deployment Strategy: Docker (Containerization)
Containerization is the preferred method to ensure consistent environments and easy scaling.

### 3.1 Docker Configuration Files
We recommend creating a `docker-compose.yml` in the root directory:

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./pipettes.db:/app/pipettes.db
    restart: always
    environment:
      - DATABASE_URL=sqlite:///../pipettes.db

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: always
```

## 4. Manual Deployment (Bare Metal)

### 4.1 Backend Setup
1. Navigate to `backend/`
2. Create virtual environment: `python -m venv .venv`
3. Activate environment: `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Linux)
4. Install dependencies: `pip install -r requirements.txt`
5. Run with production server (Gunicorn/Uvicorn):
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

### 4.2 Frontend Setup
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Set environment variable for API: `VITE_API_URL=http://<server-ip>:8000`
4. Build: `npm run build`
5. Serve the `dist/` folder using a web server like Nginx or Apache.

## 5. Reverse Proxy Configuration (Nginx Example)
To provide a secure and standard port (80/443), use Nginx:

```nginx
server {
    listen 80;
    server_name pipette-manager.local;

    location / {
        root /var/www/pipette-frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 6. Database Maintenance & Backups
The system uses SQLite. To ensure data safety:
1. **Location:** The database file is located at the project root: `pipettes.db`.
2. **Backup Strategy:** Since WAL mode is enabled, the database can be safely backed up while the application is running. 
3. **Recommendation:** Perform a daily file-level copy of `pipettes.db` to a network share or secure cloud storage.
   - *Note:* Ensure you also back up the `-wal` and `-shm` files if they exist during the copy.

## 7. Security Considerations
- **CORS:** Currently configured to `allow_origins=["*"]`. It is recommended to restrict this to the specific domain/IP of the frontend in production.
- **Firewall:** Port 80 (Frontend) and 8000 (Backend API) must be open on the local server.
- **Secrets:** No sensitive credentials are stored in the codebase; ensure the server environment is secured according to organizational standards.

---
**Technical Contact:** Juan D. Puglia (Project Lead)
**Revision Date:** 2026-03-06
