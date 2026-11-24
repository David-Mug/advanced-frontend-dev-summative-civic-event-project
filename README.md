# CivicEvent+ Project

A civic engagement platform: residents discover and register for community events, listen to audio announcements, watch captioned promo videos and receive notifications; administrators manage everything from a dashboard.

| Folder | Contents |
|---|---|
| [`backend/`](backend/README.md) | Node.js + Express + PostgreSQL API (provided) |
| [`frontend/`](frontend/README.md) | HTML5 + Tailwind CSS + jQuery client |
| [`video-demo/`](video-demo/README.md) | Demo video |

## Quick start

```bash
# Backend (see backend/README.md for database creation and .env)
cd backend && npm install
npm run db:setup && npm run db:seed     # needs DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT exported
npm run dev                             # http://localhost:4000

# Frontend (new terminal)
cd frontend && python3 -m http.server 5500   # http://localhost:5500
```

Demo accounts from the seed: `admin@civicevents.local` / `Admin@1234` and `user@civicevents.local` / `User@1234`.

Full feature list, role-based access details, API map and known backend limitations: [frontend/README.md](frontend/README.md).
