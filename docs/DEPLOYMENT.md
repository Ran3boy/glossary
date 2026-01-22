# Инструкции доступа к фронтенду и бэкенду (этап 4)

## 1) Запуск через Docker Compose (рекомендуется)

В корне репозитория:

```bash
docker compose up --build
```

После сборки и запуска:

- Frontend (UI): http://localhost:8099  
- Backend (OpenAPI/Swagger): http://localhost:8000/docs  
- Backend (health): http://localhost:8000/health  

Остановка:

```bash
docker compose down
```

## 2) Перезапуск после изменения данных

Если вы изменили `backend/data/glossary.json`, проще всего пересобрать:

```bash
docker compose up --build
```

## 3) Запуск без Docker (для разработки)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

В режиме разработки Vite проксирует `/api` на backend (`http://localhost:8000`).
