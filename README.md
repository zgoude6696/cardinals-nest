# Cardinal’s Nest

Cardinal Dynamics — FRC 6696 team management hub — tasks, scouting, scheduling, and team management.

Stack: React 19 + Vite + Tailwind (front end) · Express 5 + Drizzle ORM + PostgreSQL (back end).

## Run Locally

**Prerequisites:** Node.js, a PostgreSQL database

1. Install dependencies:
   `npm install`
2. Set `DATABASE_URL` (and, for production, `SESSION_SECRET` — see [REPLIT_SETUP.md](REPLIT_SETUP.md) for the full list of env vars).
3. Run the app:
   `npm run dev`

See [REPLIT_SETUP.md](REPLIT_SETUP.md) for full deploy/setup details and [WELCOME_GUIDE.md](WELCOME_GUIDE.md) for a tour of the app.

For a temporary GitHub Codespaces demo, follow [CODESPACES_DEMO.md](CODESPACES_DEMO.md).

## Attribution

Cardinal’s Nest is the Cardinal Dynamics / FRC Team 6696 adaptation of [PioByte Hub](https://github.com/duellzach/PioByte-Hub), originally developed by FRC Team 10991 Piobyte and its contributors. We gratefully acknowledge their work as the foundation of this project.

This repository retains its GitHub fork relationship to the upstream project. Cardinal Dynamics branding and team-specific changes do not replace the upstream attribution or change the license terms.

Required Notice: Copyright FRC 10991 Piobyte (2026)

## License

Copyright FRC 10991 Piobyte (2026). Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md) — free to use, modify, and share for noncommercial purposes; commercial use requires permission from FRC 10991 Piobyte.
