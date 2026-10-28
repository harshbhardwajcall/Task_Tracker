# 🚀 Task Tracker - Enterprise Workforce & Task Lifecycle Management System

A modern, full-stack Task and Workforce Management platform engineered with **React 18**, **Tailwind CSS**, **Node.js**, **Express**, and **SQLite (`sql.js`)**. 

Designed for teams to coordinate projects, monitor individual and departmental productivity, track task progression through comprehensive audit logs, and safely manage organizational records.

> 📖 **First time setting up this project?** Follow our fast **[Quick Setup Guide (SETUP.md)](./SETUP.md)** to get running in under 3 minutes!

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [System Data Flow](#-system-data-flow)
- [Getting Started & Installation](#-getting-started--installation)
- [Default Demo Credentials](#-default-demo-credentials)
- [REST API Reference](#-rest-api-reference)
- [Theme & Aesthetics](#-theme--aesthetics)
- [License & Credits](#-license--credits)

---

## ✨ Key Features

### 1. Role-Based Access Control (RBAC) & Manager Workspace
- **Admin Workspace:** Full organizational overview, team metrics, employee management, department and project CRUD, credentials configuration, and the two-stage Recycle Bin.
- **Manager Workspace:** Build cross-functional squads/teams, assign engineers & interns with specific roles, and allocate project deliverables.
- **Employee & Intern Workspace:** Personalized, clutter-free dashboard focused on assigned tasks, upcoming deadlines, status changes, and individual performance metrics.

### 2. Personal Self-Logs & Tests (For Everyone)
- Private personal productivity hub for all team members (Admins, Managers, Employees, Interns).
- Categorize entries by `Test Suite / Edge Case`, `Scratchpad Note`, `Self Task`, or `Checklist`.
- Interactive status toggling (`Open` ➔ `In Progress` ➔ `Done`) with timestamp tracking.

### 3. System Change History & Audit Logs
- Comprehensive `system_logs` repository capturing every mutation executed by Admins, Managers, and Employees.
- Records exact timestamp, user ID, user name, role, action, affected entity, and detailed description of the change.
- Filterable and searchable activity table in the Change History view.

### 4. Time-Based Evaluation & Velocity Meter
- Record `estimated_hours` during task creation.
- Automatically calculates `completion_duration_hours` upon task completion (tracking the exact time span between start and finish).
- Dynamic performance velocity gauge evaluating whether tasks were delivered ahead of schedule, on time, or delayed.

### 5. Automated Email Notifications & Workforce Alerts
Built-in enterprise notification engine powered by Nodemailer and configured for custom corporate mail servers (e.g. `mail.call-astro.in`):
- **Task Lifecycle Alerts:**
  - **Task Created / Assigned:** Immediate HTML email to the assignee with project, due date, priority, and task details.
  - **Task Modified:** Detailed diff table showing previous vs. updated values when task parameters or due dates change.
  - **Approaching Deadline (24h Alert):** Automated background watcher checking tasks due within 24 hours.
  - **Overdue Alert:** High-priority alert dispatched when tasks cross their scheduled deadline.
  - **Repeat Task Loop Warnings & Resets:** Automated cycle reminders and reset notices for recurring task loops.
- **User Lifecycle & Onboarding:**
  - **Welcome Email:** Sent when an Admin, Manager, Employee, or Intern is registered with portal sign-in URL, role badge, and temporary credentials.
  - **Role Change Notice:** Immediate update notification when an account is promoted or changed (e.g., Employee to Manager).
  - **Account Deactivation:** Graceful offboarding notification when an account is deactivated or removed.
- **Project & Squad Allocation Notifications:**
  - **Project Allocated to Team:** Dispatches email alerts to all squad members and the squad manager when a project is assigned (`POST /api/teams/:id/projects`).
  - **Squad Creation with Project:** Automatically notifies the team lead and all draft members when a squad is created with an allocated project.
  - **Project Reassignment:** Notifies team members when team project assignments are modified or updated.
  - **New Member Welcome to Project:** Informs new squad joiners about all active projects currently allocated to their squad.
  - **Department Allocation:** Notifies department heads and managers when a new project is created under their department.

### 6. Interactive WhatsApp-Style Task Chatbox & Media Preview
- Interactive chat thread on tasks supporting rich text remarks.
- Seamless clipboard image pasting (<kbd>Ctrl</kbd> + <kbd>V</kbd>) directly into comments.
- In-browser image modal preview (lightbox) with full-screen zoom and direct download button without forcing file downloads just to view.


### 7. Safe Deletion & Two-Stage Recycle Bin
- Accidental task deletions are soft-deleted and preserved in the **Recycle Bin**.
- Tasks in the Recycle Bin can be **Restored** to active status or **Permanently Purged** alongside their stored disk attachments.
- When an employee is removed, their associated tasks are retained in the database so work is never lost.

### 8. Modern Glassmorphic Design System
- Seamless **Dark & Light Mode** switching with persistent preference storage.
- Custom typography, frosted-glass panels, smooth micro-animations, and dynamic background branding.


---

## 🏛 Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                     │
│  React 18  •  Vite  •  Tailwind CSS  •  Lucide Icons   │
│  Context API (Auth & Theme) • Modals • Responsive UI  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST APIs (JSON)
                            │ Bearer Token + X-User-Id
┌───────────────────────────▼────────────────────────────┐
│                  EXPRESS.JS BACKEND                    │
│   Auth Middleware (JWT/Bcrypt) • Multer (Uploads)      │
│   Routes: /api/auth, /api/tasks, /api/metadata         │
└───────────────────────────┬────────────────────────────┘
                            │ Parameterized SQL Queries
┌───────────────────────────▼────────────────────────────┐
│                    SQLITE DATABASE                     │
│  tracker.db (via sql.js engine with file-sync export)  │
│  Tables: users, departments, projects, tasks,          │
│          task_comments, task_attachments, task_history │
└───────────────────────────┘
```

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 18 | Declarative component UI and reactive state |
| **Build Tool** | Vite | Lightning-fast development server & optimized production bundling |
| **Styling** | Tailwind CSS + Vanilla CSS | Glassmorphism, CSS variables, dark/light themes |
| **Icons** | Lucide React | Clean, modern UI iconography |
| **Backend Runtime** | Node.js + Express.js | REST API server, authentication, and file storage |
| **Database** | SQLite via `sql.js` | Embedded relational database with disk persistence (`tracker.db`) |
| **Security** | JWT + Bcrypt.js | Stateless token authentication and password hashing |
| **File Handling** | Multer | Multipart file uploads stored in `/uploads` |

---

## 📂 Project Directory Structure

```plaintext
Task_Tracker/
├── index.html                   # HTML entry point with root container
├── package.json                 # Dependencies and scripts (dev, build, server)
├── vite.config.js               # Vite config with API proxy to port 5000
├── tailwind.config.js           # Custom colors, theme extensions, and animations
├── server/                      # Backend Express Application
│   ├── index.js                 # Express server bootstrap & router mounting
│   ├── db/
│   │   ├── index.js             # sql.js database init, schema setup & seed data
│   │   └── tracker.db           # Persistent SQLite database file
│   ├── middleware/
│   │   └── auth.js              # JWT authentication & role-based middleware
│   ├── routes/
│   │   ├── auth.js              # /api/auth (Login, user management, password reset)
│   │   ├── tasks.js             # /api/tasks (Task CRUD, attachments, history, recycle bin)
│   │   └── metadata.js          # /api (Employees, Departments, Projects endpoints)
│   ├── utils/
│   │   └── attachmentHelper.js  # File cleanup & task retention helpers
│   └── tests/                   # Backend verification and regression test suites
├── src/                         # Frontend React Application
│   ├── main.jsx                 # React root DOM mount
│   ├── App.jsx                  # Main application router and view controller
│   ├── index.css                # Global stylesheet, design system tokens & glass utilities
│   ├── context/
│   │   ├── AuthContext.jsx      # Global authentication state (user, token, role)
│   │   └── ThemeContext.jsx     # Dark/Light theme toggle & localStorage sync
│   ├── services/
│   │   └── api.js               # Centralized HTTP client wrapping all REST endpoints
│   ├── pages/                   # Main Page Views
│   │   ├── AdminView.jsx        # Admin dashboard with summary cards & task table
│   │   ├── EmployeeDashboard.jsx# Employee/Intern personalized task board
│   │   ├── DirectoryView.jsx    # Employees, Projects & Departments directory
│   │   ├── RecycleBinView.jsx   # Soft-deleted tasks restore & permanent purge
│   │   ├── ReportsView.jsx      # Productivity & workload analytics reports
│   │   ├── CalendarView.jsx     # Monthly calendar deadline scheduler
│   │   ├── AdminSettingsView.jsx# Admin user settings and credential management
│   │   └── Login.jsx            # Authentication page with demo quick-login
│   ├── components/
│   │   ├── index.js             # Centralized component export barrel
│   │   ├── layout/
│   │   │   ├── Navbar.jsx       # Side navigation bar
│   │   │   └── TopNav.jsx       # Header bar with user profile, role badge & theme toggle
│   │   ├── modals/              # Interactive Dialogs
│   │   │   ├── CreateTaskModal.jsx
│   │   │   ├── EditTaskModal.jsx
│   │   │   ├── TaskDetailsModal.jsx
│   │   │   ├── AddEmployeeModal.jsx
│   │   │   ├── AddDepartmentModal.jsx
│   │   │   ├── AddProjectModal.jsx
│   │   │   ├── EditProjectModal.jsx
│   │   │   ├── EditUserModal.jsx
│   │   │   ├── EmployeeAnalyticsModal.jsx
│   │   │   └── ResetPasswordModal.jsx
│   │   ├── tasks/
│   │   │   ├── FilterBar.jsx    # Search, status, priority, and date range filters
│   │   │   ├── SummaryCards.jsx # Top metric counters
│   │   │   └── TaskTable.jsx    # Interactive task data grid
│   │   └── ui/
│   │       ├── PriorityBadge.jsx# Low, Medium, High, Urgent badges
│   │       └── StatusBadge.jsx  # To Do, In Progress, Completed badges
└── uploads/                     # Storage folder for uploaded task attachments
```

---

## 🔄 System Data Flow

1. **User Action:** The user triggers an action (e.g., updates a project or creates a task) in the UI.
2. **API Call:** React components call the appropriate method in `src/services/api.js`.
3. **Authentication:** `api.js` automatically injects the `Authorization: Bearer <token>` and `X-User-Id` headers.
4. **Backend Processing:**
   - `server/middleware/auth.js` validates credentials and checks permissions.
   - The route handler validates incoming data (including duplicate name/email prevention).
   - `server/db/index.js` executes parameterized queries on SQLite.
   - For file attachments, `multer` writes binary assets to `/uploads`.
5. **Persistence & Response:** The updated database state is committed to `tracker.db`, and a formatted JSON response is returned to the client.
6. **Reactive State Update:** The React component updates local state or triggers parent reload functions to refresh the UI immediately without requiring a full page reload.

---

## 🛠 Getting Started & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- [npm](https://www.npmjs.com/) (v9.0.0 or higher)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Task_Tracker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   *(Update SMTP mail settings in `.env` if you wish to test email dispatches)*

4. **Start the application (Concurrent Frontend & Backend):**
   ```bash
   npm run dev
   ```
   * Frontend runs on: `http://localhost:5173`
   * Backend API runs on: `http://localhost:5000`
   * *The database tables and initial administrator account will be initialized automatically on first startup.*

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🔑 Administrator Credentials

Initial administrator credentials are configured in your `.env` file:

```env
DEFAULT_ADMIN_EMAIL=admin@company.com
DEFAULT_ADMIN_PASSWORD=your_secure_password
```

| Role | Portal Mode | Default Configuration | Notes |
|---|---|---|---|
| **Admin** | **Admin Portal** | Defined via `DEFAULT_ADMIN_EMAIL` & `DEFAULT_ADMIN_PASSWORD` in `.env` | Full access to governance, settings, teams, employees & logs |
| **Employees / Managers** | **Employee Portal** | Created dynamically by Admin via **Admin Settings** | Credentials are assigned or sent via automated email |

---

## 📡 REST API Reference

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/login` - Authenticate user and receive JWT token.
- `GET /api/auth/me` - Fetch currently authenticated user profile.
- `GET /api/auth/users` - List all system users.
- `POST /api/auth/admin/users` - Create a new user (Admin only).
- `PUT /api/auth/admin/users/:id/password` - Reset a user's password (Admin only).

### 📋 Tasks (`/api/tasks`)
- `GET /api/tasks` - List tasks with query filters (status, priority, assigned_to, search).
- `POST /api/tasks` - Create a task with optional file attachment.
- `GET /api/tasks/:id` - Fetch full task details, comments, attachments, and history.
- `PUT /api/tasks/:id` - Update task fields.
- `PATCH /api/tasks/:id/status` - Quick update task status.
- `DELETE /api/tasks/:id` - Soft-delete task to Recycle Bin.
- `POST /api/tasks/:id/comments` - Add a comment to a task.
- `POST /api/tasks/:id/attachments` - Upload an attachment.
- `DELETE /api/tasks/:id/attachments/:attId` - Delete a task attachment.

### ♻️ Recycle Bin (`/api/tasks/recycle-bin`)
- `GET /api/tasks/recycle-bin/list` - List all soft-deleted tasks.
- `POST /api/tasks/:id/restore` - Restore a task back to active status.
- `DELETE /api/tasks/:id/permanent` - Permanently delete task and associated files.
- `DELETE /api/tasks/recycle-bin/empty` - Empty entire recycle bin.

### 👥 Teams & Squad Allocations (`/api/teams`)
- `GET /api/teams` - List all teams with member counts and allocated projects.
- `GET /api/teams/:id` - Fetch single team details, member roster, and project deliverables.
- `POST /api/teams` - Create a new team squad (Manager & Admin).
- `PUT /api/teams/:id` - Update team details and description.
- `DELETE /api/teams/:id` - Delete team squad.
- `POST /api/teams/:id/members` - Add employee or intern to team with role (`Lead`, `Member`, `Intern`).
- `DELETE /api/teams/:id/members/:userId` - Remove member from team.
- `POST /api/teams/:id/projects` - Allocate project to team.
- `DELETE /api/teams/:id/projects/:projectId` - Deallocate project from team.

### 📝 Personal Self-Logs (`/api/self-logs`)
- `GET /api/self-logs` - Fetch user's private test cases, scratchpad notes, and self tasks.
- `POST /api/self-logs` - Create a new personal log entry (`Test`, `Note`, `Self-Task`, `Checklist`).
- `PUT /api/self-logs/:id` - Update personal log title, notes, or toggle status (`Open`, `In Progress`, `Done`).
- `DELETE /api/self-logs/:id` - Delete personal log.

### 📜 System Change History & Audit Logs (`/api/audit-logs`)
- `GET /api/audit-logs` - Query immutable system change logs recording actions across Admins, Managers, and Employees with timestamp, user ID, role, action, and details.

### 📊 Manager Reports & Workload Intelligence (`/api/reports`)
- `GET /api/reports` - Query aggregate project workload by employee, project breakdowns, active estimated hours, capacity metrics, and department throughput with date range (`Today`, `This Week`, `This Month`, `All Time`, `Custom`), project, and department filtering.


### 🏢 Directory & Metadata (`/api`)
- `GET /api/employees` - List all employees and interns.
- `POST /api/employees` - Create employee or intern record.
- `DELETE /api/employees/:id` - Delete employee (retaining their tasks).
- `GET /api/employees/:id/analytics` - Get detailed individual performance statistics.
- `GET /api/departments` - List departments with member counts.
- `POST /api/departments` - Create department (with duplicate name check).
- `DELETE /api/departments/:id` - Delete department.
- `GET /api/projects` - List projects with task counts.
- `POST /api/projects` - Create project (with duplicate name check).
- `PUT /api/projects/:id` - Edit project name, department, and description.
- `DELETE /api/projects/:id` - Delete project.

---

## 🎨 Theme & Aesthetics

The application includes an adaptive, frosted-glass design system:
- **Dark Mode:** Deep slate palettes (`slate-900`, `zinc-900`, `neutral-950`) with high-contrast text and luminous accent badges.
- **Light Mode:** Crisp, clean styling with translucent frosted panels, dark charcoal typography, and subtle drop-shadows.
- **Background Branding:** Adaptive watermark background that dynamically calibrates contrast for both light and dark backgrounds.

---

## 📄 License & Credits

* Built with ❤️ by the Call-Astro Team.
* Licensed under the [MIT License](LICENSE).
