# Papyrus

Papyrus is a web-based duty roster (shift scheduling) application built for a fire department. It manages daily and temporary shift assignments, imports duty rosters from PDF exports, and lets staff view, adjust, and export schedules through a browser.

The project started as an Electron desktop app and has since been migrated to a Node.js/Express web application, served behind an Apache reverse proxy.

---

## Features

- **Login & sessions** – username/password login (bcrypt password hashing) with server-side sessions stored in SQLite (`express-session` + `connect-sqlite3`).
- **User & personnel database** – SQLite database (`better-sqlite3`) linking user accounts to one or more assigned persons (first/last name).
- **Daily schedule** – view and edit the current day's duty roster, with drag-and-drop assignment of personnel to positions/vehicles.
- **Temporary / alternative schedule** – a separate "alternative plan" flow for ad-hoc changes, shown in a popup/iframe, with its own save state.
- **PDF import** – upload an existing duty roster PDF and automatically extract shift/position data (`pdf-parse-fork`, `pdf-lib`).
- **Export** – export schedules and person lists (e.g. to Excel via `exceljs`).
- **Settings** – per-user display settings (e.g. show/hide certain duty categories), persisted server-side.
- **Mobile support** – touch-based drag-and-drop and a responsive stylesheet for use on phones/tablets.

---

## Tech stack

- **Backend:** Node.js, Express
- **Database:** SQLite (`better-sqlite3` for app data, `connect-sqlite3` for sessions)
- **Auth:** `bcrypt`, `express-session`
- **Files/PDF/Excel:** `fs-extra`, `pdf-lib`, `pdf-parse-fork`, `exceljs`
- **Frontend:** plain HTML/CSS/JavaScript (no framework), served as static files by Express
- **Deployment:** Ubuntu/Proxmox server, Apache as reverse proxy, process managed with `pm2`

> Note: the project was originally an Electron app (`start:desktop` script, `main.js`, `scripts/preload.js`). That code path is no longer maintained — the app now runs exclusively as a web server via `server.js`.

---

## Getting started

```bash
git clone https://github.com/SexyJackXy/Papyrus.git
cd Papyrus
npm install
npm start
```

This starts the Express server (`server.js`). By default it serves the app on the configured port; open it in a browser and log in via `/views/login.html`.

### Creating a user

Use `scripts/createUser.js` to create the first login user in the SQLite database (see the script for usage).

---

## Project structure

```
Papyrus/
├── server.js               # Express app entry point (web server, routes, auth)
├── db.js                   # SQLite access layer (users, assigned persons)
├── scripts/
│   ├── core.js          # Main client-side logic (roster UI, drag & drop)
│   ├── alternaivPlan.js    # Alternative/temporary plan logic
│   ├── settings.js         # Client-side settings page logic
│   ├── parseShift.js       # Shift parsing helpers
│   ├── pdfExtractor.js     # PDF import/extraction
│   └── createUser.js       # CLI helper to create a login user
├── views/                  # HTML pages (dashboard, login, index, settings, shift schedule, alternative plan)
│   └── styles/             # CSS files
├── img/                    # Icons and images used in the UI
├── dailySchedule/          # Current daily schedule + archive (runtime data)
├── temporarySchedule/      # Current temporary/alternative schedule (runtime data)
├── exportedPersons/        # Exported person lists (runtime data)
├── classifications/        # Imported duty roster PDFs (runtime data)
└── globalVariables/        # Settings storage (settings.json, template.json)
```

---

## Deployment

The app is deployed on an Ubuntu/Proxmox server and reverse-proxied through Apache. Deployment workflow:

1. Pull the latest code on the server (`git pull`).
2. Run `npm install` if dependencies changed.
3. Restart the process with `pm2` (e.g. `pm2 restart division` or equivalent).
4. Apache forwards requests to the Node.js/Express server.

---

## Cleanup notes

A few leftovers from earlier development stages can be removed:

- `main.js` and `scripts/preload.js` — Electron entry point and preload script from before the migration to Express; `main.js` references a `scripts/build.js` file that no longer exists, so this code path is already broken and unused.
- The `electron` devDependency and the `start:desktop` script in `package.json` — only relevant to the unused Electron mode above.
- `node_modules/` — should not be shipped/committed; regenerate with `npm install`.
- `app.db-shm`, `app.db-wal`, `sessions.db` — SQLite runtime files, regenerated automatically, already covered by `.gitignore`.
- Stray temp files such as `classifications/tmp*.tmp.pdf` left behind by PDF uploads.

The folders `dailySchedule/`, `temporarySchedule/`, `exportedPersons/`, and `classifications/` hold runtime/user data rather than source code — check their contents before deleting anything, since they may contain real schedules.

---

## License

No license file present yet — add one if this project will be distributed or used outside its current context.