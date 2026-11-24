# CivicEvents+ — Civic Events Platform

A civic engagement platform. Residents discover and register for community events, give feedback, listen to audio announcements, watch captioned promo videos and receive notifications. Administrators manage events, media, users and notifications from a dashboard.

## Main Features

- **Residents:** sign up and log in, search and filter events, register or cancel, rate events, play audio announcements, watch promos with synced captions, notifications, profile.
- **Administrators:** statistics dashboard; event management with image upload and registrant lists; audio announcement and promo video uploads with publish/unpublish; user enable/disable; notification management.
- **Role-based access** enforced in the browser and by the API (JWT).

## Technologies

| Layer | Stack |
|---|---|
| Frontend | HTML5, Tailwind CSS, jQuery, JavaScript |
| Backend | Node.js, Express, JWT, Multer (uploads) |
| Database | PostgreSQL |

## Repository Structure

| Folder | Contents |
|---|---|
| [`frontend/`](frontend/README.md) | The web client. Features, structure, API configuration, role-based access. |
| [`backend/`](backend/README.md) | The provided REST API. Database creation, `.env`, Postman collection. |
| [`video-demo/`](video-demo/README.md) | Demo video |

## Quick Start

Requires Node.js, PostgreSQL and Python 3.

```bash
# 1. Backend: create the database first (see backend/README.md) and fill in backend/.env
cd backend
npm install
export DB_USER=<db-user> DB_PASSWORD=<db-password> DB_NAME=civic-events-db DB_HOST=localhost DB_PORT=5432
npm run db:setup && npm run db:seed
npm run dev                         # API on http://localhost:4000

# 2. Frontend: in a new terminal
cd frontend
npm start                           # http://localhost:5500
```

The seed creates one admin and one normal user for local testing. Their login details are at the top of `backend/migrations/002_seed_data.sql`.

See [frontend/README.md](frontend/README.md) for configuration details and the known limitations of the provided backend.
