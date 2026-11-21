# Academy Library

A unified learning catalogue for books, articles, videos, and lesson recordings—built with **React + TypeScript + Tailwind CSS** on the frontend and **Express + SQLite (FTS5)** on the backend.

## Documentation

- [Product Requirements Document (PRD)](docs/PRD.md)
- [Domain Model & ER Diagram](docs/DOMAIN_MODEL.md)

## Features

- **Full-Text Search (SQLite FTS5)** — Instant ranked search across title, description, author, course, topic, and tags.
- **Tagging & Multi-Facet Filtering** — Filter by course, topic, level, resource type, and clickable tags.
- **CRUD with Role-Based Permissions** — Demo role switcher (Student, Lecturer, Admin) enforced on the backend API (`X-User-Id` header):
  - **Students**: browse, search, view Skill Map recommendations, and borrow/return physical books.
  - **Lecturers**: add/edit/delete their own resources, build group collections, and sync Reel recordings.
  - **Admins**: manage all resources, collections, and Depot returns.
- **Live Link Previews** — Fetches Open Graph metadata (`og:title`, `og:description`, `og:image`) when adding legitimate external links (with SSRF protection and graceful fallback).
- **Group Collections** — Curated lists organized by student group (`JS-24`, `PY-24`, etc.).
- **Integrations (Simulated)**:
  - **Reel** — One-click automatic sync of new lesson recordings.
  - **Skill Map** — Personalized recommendations based on each student's skill gaps.
  - **Depot** — Physical office bookshelf availability, shelf location, borrower tracking, and 14-day borrow/return flow.

## Getting Started

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Project Structure

```
academy-library/
├── server/
│   ├── index.ts                 # Express API entry point
│   ├── db.ts                    # SQLite + FTS5 schema & seed data
│   ├── auth.ts                  # Role-based permission middleware
│   └── routes/
│       ├── resources.ts         # Search, filtering & CRUD
│       ├── collections.ts       # Group collections
│       ├── preview.ts           # Open Graph link preview fetcher
│       └── integrations.ts      # Reel sync, Skill Map, Depot borrow/return
└── src/
    ├── App.tsx                  # Main layout, search & filters
    ├── api.ts                   # Typed API client
    ├── types.ts                 # Shared TypeScript interfaces
    └── components/              # ResourceCard, ResourceModal, CollectionsView, SkillMapView, DepotView
```
