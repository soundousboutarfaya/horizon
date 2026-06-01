<div align="center">

# 🏙️ Horizon — Unsanitary Housing Reporting Platform

**A civic-tech web app that lets Montréal residents report unsanitary housing, map it, and cross-reference it with the city's official open data on sanitation convictions.**

[![CI](https://github.com/your-username/horizon/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/horizon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.6-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-node%3Atest-success)](test/)

</div>

---

## 📖 Overview

In Montréal, tenants living in unsanitary conditions often don't know that their building may already have a record of sanitation violations, or how to report a new problem. **Horizon** brings both sides together in one place:

- Residents **submit a report** (issue type, description, photo, address) through a guided form.
- Each report is **automatically geocoded** and pinned on an interactive map.
- The map also overlays **official sanitation convictions** published by the City of Montréal as open data, so a citizen can see whether their address — or their street — already has a history.
- A simple **dashboard** summarizes reports by type and over time.

The project is built with a deliberately small, dependency-light stack to keep the codebase easy to read and audit.

## ✨ Features

- **Guided reporting form** with photo upload (JPEG / PNG / WebP / GIF, max 5 MB)
- **Automatic geocoding** of addresses via OpenStreetMap (Nominatim), with multiple spelling fallbacks for messy user input
- **Interactive map** (Leaflet + OpenStreetMap) with two toggleable layers:
  - Citizen reports (blue markers)
  - Official City of Montréal convictions (orange markers, grouped by address with total fines)
- **Filters** by issue type, by year, and by source
- **Address search** across stored reports (accent- and punctuation-insensitive)
- **Charts dashboard** (Chart.js): reports by type and by month
- **Admin panel** (HTTP Basic Auth) to review full reports — including reporter identity — and delete entries
- **Open data ingestion**: an idempotent importer for the *Contrevenants condamnés — salubrité* dataset
- **Responsive & accessible**: keyboard-dismissable modals, `role="dialog"`, visible focus, labelled fields

## 🛠️ Tech Stack

| Layer        | Technologies                                                        |
| ------------ | ------------------------------------------------------------------- |
| **Backend**  | Node.js, Express 5, SQLite 3, Multer (uploads)                       |
| **Frontend** | HTML5, CSS3, vanilla JavaScript, Leaflet, Chart.js                  |
| **Geocoding**| Nominatim (live reports), Photon / Komoot (bulk open-data import)   |
| **Tooling**  | `node:test` (zero-dependency test runner), Docker, GitHub Actions CI |
| **Data**     | [donnees.montreal.ca](https://donnees.montreal.ca/dataset/liste-central-condamnations-salubrite-logements) open dataset |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) **≥ 20.6** (uses the built-in `--env-file` flag and `node:test` runner)

### Installation

```bash
git clone https://github.com/your-username/horizon.git
cd horizon
npm install
```

### Configuration

```bash
cp .env.example .env
# then edit .env — at minimum set ADMIN_USER / ADMIN_PASSWORD
```

| Variable         | Default        | Description                                   |
| ---------------- | -------------- | --------------------------------------------- |
| `PORT`           | `3000`         | HTTP port                                     |
| `ADMIN_USER`     | `admin`        | Admin panel username                          |
| `ADMIN_PASSWORD` | `admin123`     | Admin panel password (**change this!**)       |
| `HORIZON_DB`     | `./horizon.db` | SQLite file path (`:memory:` for ephemeral)   |
| `UPLOADS_DIR`    | `./uploads`    | Where uploaded photos are stored              |

> ⚠️ If no admin credentials are set, the server boots with insecure defaults and prints a warning. Always set real credentials before exposing it.

### Seed the open data (optional but recommended)

The convictions layer is populated from the City's CSV. The importer is **idempotent** and caches geocoding results, so re-running it is cheap:

```bash
npm run import
```

### Run

```bash
npm start        # production-style start
npm run dev      # watch mode, loads variables from .env
```

Then open **http://localhost:3000**. The admin panel lives at **http://localhost:3000/admin**.

## 🧪 Testing

Tests use Node's built-in runner — **no extra dependencies**. They cover the search/normalization utilities, the geocoding candidate builder, and the HTTP API (run against an in-memory SQLite database).

```bash
npm test
```

## 🐳 Docker

```bash
# Build & run with Docker Compose (persists DB + uploads in named volumes)
ADMIN_PASSWORD=super-secret docker compose up --build
```

Or with plain Docker:

```bash
docker build -t horizon .
docker run -p 3000:3000 -e ADMIN_PASSWORD=super-secret horizon
```

## 🗂️ Project Structure

```
.
├── server.js                 Express app factory + routes (exported for tests)
├── config.js                 Centralized configuration from environment variables
├── lib/
│   ├── db.js                 SQLite connection + schema bootstrap
│   ├── geocode.js            Address → coordinates (Nominatim) + candidate builder
│   ├── text.js               Accent-insensitive search tokenization
│   └── auth.js               Constant-time HTTP Basic Auth middleware
├── import-violations.js      Idempotent open-data importer (Photon geocoding)
├── test/                     node:test unit + API tests
├── public/                   Frontend (index.html, style.css, script.js)
├── private/admin.html        Admin panel (served behind Basic Auth)
├── Dockerfile · docker-compose.yml
└── .github/workflows/ci.yml  CI: tests on Node 20 / 22 / 24
```

## 🔌 API Reference

| Method | Route                        | Auth  | Description                                  |
| ------ | ---------------------------- | ----- | -------------------------------------------- |
| GET    | `/api/reports`               | —     | List citizen reports (no personal data)      |
| GET    | `/api/violations`            | —     | List geocoded official convictions           |
| GET    | `/api/search?address=…`      | —     | Search reports by address                    |
| POST   | `/api/reports`               | —     | Create a report (multipart form-data)        |
| POST   | `/api/reports/:id/geocode`   | —     | (Re)geocode a report's address               |
| GET    | `/api/admin/reports`         | Basic | Full reports incl. reporter identity         |
| DELETE | `/api/admin/reports/:id`     | Basic | Delete a report                              |
| GET    | `/admin`                     | Basic | Admin HTML page                              |

## 🔒 Security

- **SQL injection** — every query uses parameterized statements
- **XSS** — all user-supplied data is HTML-escaped before rendering
- **Auth** — admin routes use HTTP Basic Auth with **constant-time** credential comparison (`crypto.timingSafeEqual`) to avoid timing leaks
- **Uploads** — restricted by MIME type and capped at 5 MB
- **Input validation** — required fields and email format checked server-side
- **Headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` set on every response
- **Privacy** — the public API never exposes reporter name/email; only the authenticated admin endpoint does. The local database is git-ignored so test/personal data is never committed.

## 🧭 Possible Improvements

- Replace Basic Auth with session-based login + hashed passwords (bcrypt/argon2)
- Per-IP rate limiting on the report endpoint
- Pagination for large datasets
- Migrate from SQLite to PostgreSQL + PostGIS for spatial queries at scale
- End-to-end tests (Playwright)

## 📄 License

[MIT](LICENSE) — see the LICENSE file. Open data © Ville de Montréal, under the
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) license.
