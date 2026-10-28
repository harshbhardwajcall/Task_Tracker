# 🛠️ Task Tracker - Quick Setup & Onboarding Guide

Welcome to **Task Tracker**! This guide walks you through setting up and running the application locally on your machine in under **3 minutes**.

---

## ⚡ 1-Minute Quick Start (TL;DR)

Open your terminal in your desired folder and run:

```bash
# 1. Clone the repository
git clone <your-repository-url>
cd Task_Tracker

# 2. Install dependencies (Frontend & Backend)
npm install

# 3. Create your local environment configuration
# On Windows (PowerShell):
Copy-Item .env.example .env
# On Mac/Linux (Bash):
cp .env.example .env

# 4. Start the application
npm run dev
```

Open your browser at **[http://localhost:5173](http://localhost:5173)**.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
- **npm**: `v9.0.0` or higher (bundled with Node.js)
- **Git**: ([Download Git](https://git-scm.com/))

Verify versions in your terminal:
```bash
node -v
npm -v
```

---

## 🔑 Initial Administrator Login Credentials

When the backend boots up for the first time, the system automatically creates the initial System Administrator:

| Role | Portal Mode | Environment Variables | Notes |
|---|---|---|---|
| **System Admin** | **Admin Portal** | `DEFAULT_ADMIN_EMAIL` & `DEFAULT_ADMIN_PASSWORD` | Configured securely in `.env` |

> **Note:** No fake demo users or dummy tasks are generated. Once logged in as Administrator, you can create your actual company departments, teams, managers, and employees directly from the Admin Portal.

### 🚀 Step-by-Step First Login Walkthrough

1. Open your browser and navigate to **`http://localhost:5173`**.
2. Click the **"Admin Login"** toggle button at the bottom of the login panel to switch to Admin mode.
3. Enter your administrator credentials as defined in `.env`:
   - **Work Email:** (value of `DEFAULT_ADMIN_EMAIL` in `.env`)
   - **Password:** (value of `DEFAULT_ADMIN_PASSWORD` in `.env`)
4. Click **"Sign In as Admin"**.
5. You will immediately be authenticated and redirected to the **Admin Management Dashboard**, where you can manage teams, projects, real employees, and system settings.
6. *(Recommended)* Navigate to **Profile & Settings** to update your administrator password for production security.

---

## ⚙️ Environment Configuration (`.env`)

A template file named `.env.example` is provided in the repository root.

When you copy it to `.env`:
```env
# Server Port
PORT=5000

# Application URL
APP_URL=http://localhost:5173

# Company SMTP Mail Service (Optional - for Email Notifications)
SMTP_HOST=mail.callastro.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@callastro.com
SMTP_PASS=your_email_password
MAIL_FROM="Call Astro Tasks <your_email@callastro.com>"
```

> **Note:** The app works completely fine without real email credentials! If email credentials are not set, task notifications simply skip dispatching without breaking any UI operations.

---

## 💻 Available NPM Scripts

Run these scripts from the project root:

| Command | Description |
|---|---|
| `npm run dev` | Starts both the **Express backend** (port `5000`) and the **Vite frontend** (port `5173`) concurrently |
| `npm run build` | Compiles the production-ready React bundle into the `dist/` directory |
| `npm run preview` | Previews the compiled production build locally |
| `npm run test` | Runs the automated backend API test suite |

---

## 🏗️ Architecture & Network Ports

```
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│  React 18 Frontend (Vite)       │        │  Express.js Backend API          │
│  http://localhost:5173          ├───────►│  http://localhost:5000           │
│  (UI Components & Tailwind CSS) │ REST   │  (Routes, JWT Auth & Multer)     │
└─────────────────────────────────┘        └─────────────────┬────────────────┘
                                                             │
                                                   ┌─────────▼────────┐
                                                   │ SQLite (sql.js)  │
                                                   │ tracker.db       │
                                                   └──────────────────┘
```

- **Frontend Port:** `5173` (proxies `/api` calls directly to port 5000)
- **Backend API Port:** `5000`
- **Database Engine:** SQLite (powered by `sql.js` in-memory with automatic disk-sync to `server/db/tracker.db`)

---

## ❓ Troubleshooting & FAQs

### 1. "Port 5000 or 5173 is already in use"
If another application is running on port `5000`:
- Set `PORT=5001` in your `.env` file.
- Or terminate the existing process occupying the port:
  - **Windows:** `Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process`
  - **Mac/Linux:** `npx kill-port 5000`

### 2. "How to reset the database to a blank slate?"
To start with a completely fresh, empty database:
- Stop the running development server (`Ctrl + C`).
- Delete `server/db/tracker.db`.
- Run `npm run dev`. The server will regenerate fresh tables and bootstrap the initial Admin from `.env`.

### 3. "Which files should I NEVER commit to Git?"
- **`.env`** (Contains your secrets and email passwords).
- **`server/db/tracker.db`** (Your local SQLite database with real tasks and user records).
- **`uploads/`** (User-uploaded files and media).
*(All of these are already configured in `.gitignore` for your safety).*

---

## 📞 Support & Contributions
For feature requests, bug reports, or questions, please open an issue in this repository or contact the project team. Happy tracking! 🚀
