# ResolveMe — Project Memory

## What this project is

An AI-powered ticket management system that receives support emails, auto-classifies them, and helps agents respond faster using AI-generated summaries and suggested replies.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS + React Router (Vite) |
| Backend | Node.js + Express + TypeScript (Bun runtime) |
| Database | PostgreSQL + Prisma ORM |
| Auth | Database sessions (express-session) |
| AI | Anthropic Claude API |
| Email | SendGrid or Mailgun |
| Deployment | Docker + cloud provider |

## Project Structure

```
resolveme/
├── client/       # React + Vite frontend (port 5173)
└── server/       # Express backend (port 3000)
```

## Running the project

```bash
# Server (from server/)
bun --watch src/index.ts

# Client (from client/)
bun run dev
```

## Key domain rules

- Ticket statuses: `open`, `resolved`, `closed`
- Ticket categories: `general_question`, `technical_question`, `refund_request`
- Roles: `admin` (seeded at deploy) and `agent` (created by admin)
- Admin has full access; agents handle tickets

## Documentation

Always use **context7** to fetch up-to-date documentation before working with any library or framework in this project — including React, Express, Vite, Prisma, Tailwind, React Router, and the Anthropic SDK. Do not rely on training data alone for API usage, configuration, or version-specific behaviour.

To use context7:
1. Call `mcp__context7__resolve-library-id` with the library name
2. Call `mcp__context7__query-docs` with the resolved ID and a specific question
