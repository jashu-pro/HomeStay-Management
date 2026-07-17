# HomeStay Management

A full-stack Homestay Management System with a React frontend and Express.js backend.

## Project Structure

```
HomeStay-Management-main/
├── frontend/     ← React + Vite + Tailwind + Supabase
└── backend/      ← Express API + JWT Auth + JSON database
```

---

## Getting Started

### 1. Backend (Express API — port 3000)

```bash
cd backend
npm install
cp .env.example .env   # Fill in JWT_SECRET and any optional vars
npm run dev
```

### 2. Frontend (React + Vite — port 5173)

```bash
cd frontend
npm install
cp .env.example .env   # Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Open **http://localhost:5173** in your browser.

> The Vite dev server automatically proxies all `/api/*` requests to the backend on port 3000.

---

## Environment Variables

### `backend/.env`
| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret key for signing JWT tokens |
| `SMTP_HOST` | SMTP server hostname (optional) |
| `SMTP_PORT` | SMTP port, e.g. 587 (optional) |
| `SMTP_USER` | SMTP username (optional) |
| `SMTP_PASS` | SMTP password (optional) |
| `RESEND_API_KEY` | Resend.com API key for emails (optional) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (optional) |
| `CLOUDINARY_API_KEY` | Cloudinary API key (optional) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (optional) |
| `FRONTEND_URL` | Frontend production URL for CORS (production only) |

### `frontend/.env`
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

---

## Scripts

### Backend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Express API in dev mode (tsx) |
| `npm run build` | Bundle server for production (esbuild) |
| `npm run start` | Run production build |

### Frontend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
