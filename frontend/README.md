# CivicEvents+ — Frontend

## Project Overview

CivicEvents+ is a civic engagement platform. Residents find community events, register for them, leave feedback, listen to audio announcements and watch captioned promo videos. Administrators manage events, media, users and notifications from a dashboard.

This folder is the client. It talks to the provided Express + PostgreSQL API in [`../backend`](../backend/README.md).

## Features

**Normal users**
- Sign up and log in, with password rules checked as you type.
- Browse events, with search, date, timing and location filters.
- View event details, register, and cancel a registration from **My Registrations**.
- Rate an event and leave a comment (one review per event, editable).
- Listen to audio announcements in an accessible player.
- Watch promo videos with timed captions and a transcript that follows the video. Clicking a line jumps to that moment.
- View notifications, with an unread count in the header.
- Update profile name and email.

**Administrators**
- Dashboard with live statistics and charts.
- Create, edit and delete events, with image upload, and view each event's registrants and feedback.
- Upload audio announcements, then publish or unpublish them.
- Upload promo videos (up to 100 MB) with captions, then publish or unpublish them. A cover image is taken automatically from the video.
- List users and enable or disable accounts.
- View and delete notifications.

**Throughout:** toasts, confirmation dialogs, skeleton loaders, empty and error states, upload progress bars, and a responsive layout from phone to desktop.

## Technologies Used

- HTML5 (semantic markup, ARIA)
- Tailwind CSS 3.4 (compiled to `css/styles.css`)
- jQuery 3.7 and plain JavaScript (no framework, no bundler)
- Backend: Node.js, Express, PostgreSQL and JWT authentication (provided in `../backend`)

## Project Structure

```
frontend/
├── index.html              Public landing page
├── pages/                  One HTML file per screen (login, events, admin-*.html, …)
├── js/
│   ├── config.js           API base URL and app settings
│   ├── api.js              All backend requests (adds the Bearer token)
│   ├── auth.js             Login, logout, token storage and role guards
│   ├── layout.js           Header, navigation and page boot
│   ├── ui.js · components.js · validation.js · media.js · notifications.js · charts.js
│   ├── pages/              One script per page
│   └── vendor/jquery.min.js
├── css/
│   ├── tailwind.input.css  Source styles (edit this file)
│   └── styles.css          Compiled output (committed, so no build is needed to run)
├── assets/images/          Logo, favicon, background pattern
├── scripts/build-pattern.js  Generates assets/images/logo-pattern.svg
├── tailwind.config.js      Brand colours and fonts
└── package.json            CSS build and dev-server scripts
```

## Installation and Setup

Requirements: Python 3 (or any static file server). Node.js is only needed to rebuild the CSS.

1. Start the backend first. See [Backend Connection](#backend-connection).
2. Optional, only if you change styles:

```bash
cd frontend
npm install
npm run build:css      # or: npm run watch:css while editing
```

## Backend Connection

The API address is set in `js/config.js`:

```js
let apiOrigin = 'http://localhost:4000';   // API_BASE_URL becomes http://localhost:4000/api
```

- If the backend runs elsewhere, change `apiOrigin` in that file.
- To override it in one browser without editing code, run this in the browser console, then reload:

  ```js
  localStorage.setItem('ce_api_base', 'http://<host>:4000')
  ```

Uploaded images, audio and video are loaded from `http://localhost:4000/uploads/…`. The backend's CORS setup allows the frontend to run on a different port.

## Environment Configuration

The frontend needs no environment variables. The only setting is the API origin above.

The backend reads its settings from `backend/.env`: `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_NAME` and `JWT_SECRET`. `PORT` is optional and defaults to 4000. Never commit real values.

## Running the Application

**1. Backend and database** (full details in [`backend/README.md`](../backend/README.md)):

```bash
cd backend
npm install
export DB_USER=<db-user> DB_PASSWORD=<db-password> DB_NAME=civic-events-db DB_HOST=localhost DB_PORT=5432
npm run db:setup       # creates the tables (migrations/001_create_tables.sql)
npm run db:seed        # demo accounts and sample data (migrations/002_seed_data.sql)
npm run dev            # http://localhost:4000
```

`db:setup` and `db:seed` read `DB_PASSWORD`, while the server reads `DB_PASS` from `.env`. Set both to the same password.

**2. Frontend** (new terminal):

```bash
cd frontend
npm start              # runs: python3 -m http.server 5500
```

Open <http://localhost:5500>. VS Code Live Server also works: open `frontend/index.html`.

**Demo accounts:** one admin and one normal user are created by the seed. Their emails and passwords are listed at the top of `backend/migrations/002_seed_data.sql`. They are for local development only.

## Role-Based Access

| | Normal user | Administrator |
|---|---|---|
| Browse events, announcements, promos | ✅ | ✅ (including unpublished items) |
| Register, cancel, leave feedback | ✅ | — |
| Notifications, profile | ✅ | ✅ |
| Admin dashboard and statistics | — | ✅ |
| Manage events, announcements, promos | — | ✅ |
| See registrants and all feedback | — | ✅ |
| Enable or disable users | — | ✅ |
| Delete notifications | — | ✅ |

- **In the browser:** every page checks the role before it loads. A normal user who opens an admin URL is sent back to their dashboard with a message, and admin links never appear in their menu. When the token expires, or the API returns 401, the user is signed out and sent to login.
- **In the API:** the backend enforces the same rules. Admin-only requests made with a user's token return `403`.
- **Token:** the JWT is kept in `sessionStorage`, so it belongs to one browser tab and is cleared when the tab closes. It is sent as `Authorization: Bearer <token>`.

## Known Backend Limitations

These are limits of the provided API, not missing frontend work:

- **Events have no publish or unpublish endpoint.** Events are visible as soon as they are created.
- **There is no service-request endpoint,** so that feature is not available.
- **Notifications can't be created or marked as read through the API.** They are generated automatically when content is created or published, and "read" is remembered in the browser.
- **Disabling a user doesn't block login,** because the login endpoint doesn't check account status.
- **A cancelled registration can't be renewed** for the same event.
- **An event with registrations can't be deleted.**
