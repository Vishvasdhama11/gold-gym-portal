# AuraDesk — Premium Admin & User Management Web Application

A clean, modern, premium-looking, and fully functional website with **strictly two roles**:
1. **Admin**
2. **User**

Built with enterprise-grade security standards, zero external npm dependencies, pure native Node.js (`node:http`, `node:sqlite`, `node:crypto`), and a high-performance responsive frontend.

---

## 🌟 Key Features

### 1. Two Main Public Pages & Intelligent Role Detection
- **`index.html` — Premium Landing Page**:
  - Obsidian & Slate luxury design with glowing background mesh and frosted glass cards.
  - Clear typography, attractive hero section with prominent **"Access Portal / Login"** CTA.
  - Highlights core features: Strict 2-Role Security, User Record Management, and Automated Fee Ledger.
- **`login.html` — Common Login Page**:
  - Single unified login interface for both Admin and Users.
  - Show/Hide password toggle.
  - **Automatic role detection**: backend inspects credentials and routes Admin to `/admin-dashboard.html` and Users to `/user-dashboard.html`.
  - No public Admin registration form.
  - Clear error alerts and convenient one-click demo credentials filler for evaluators.

### 2. Admin Dashboard (`admin-dashboard.html`)
- **Full User Profile Management**:
  - View all registered users with avatars, contact numbers, father's name, residential address, and fee summary.
  - Real-time search by user name or mobile number with debounce.
  - Status filter dropdown (`All`, `Paid`, `Partial`, `Unpaid`).
  - **Add New User**: Name, Mobile (unique), Password, Father's Name, Residential Address, Profile Photo upload (with live preview), and initial fee assignment.
  - **Edit User**: Modify details, update/replace profile photos, or reset password.
  - **Delete User**: Permanent deletion with two-step confirmation modal and cascading cleanup of fee records.
  - **View Individual Profile**: High-resolution profile card with full contact details and fee ledger snapshot.
- **Fee Management System**:
  - Real-time auto-calculation: `Remaining Fees = Total Fees - Paid Fees`.
  - Payment Status determination (`Paid`, `Partial`, `Unpaid`).
  - **Update Fee Details**: Adjust total fee allocation at any time.
  - **Record New Payments**: Enter payment amount, date, method (`Cash`, `UPI`, `Bank Transfer`, `Card`, `Cheque`), and reference notes.
  - **Complete Payment History Ledger**: Chronological audit trail of all payments.
  - Live metric KPI cards: Total Users, Total Allocated Fees, Collected Fees, and Outstanding Pending Fees.

### 3. User Dashboard (`user-dashboard.html`)
- **Strict Role-Based Isolation**:
  - Users can **only view their own information** (`/api/user/my-profile` & `/api/user/my-fees` query exclusively by authenticated session ID).
  - Users **cannot edit** profile details or fee records.
  - Users **cannot see** other users' records.
  - Users **cannot access** the Admin Dashboard (enforced by server 403 checks and client route guards).
- **Personal Details Display**:
  - High-resolution profile avatar.
  - Full Name & Member Badge.
  - Verified Mobile Number (User ID).
  - Father's Name & Residential Address.
  - Registration Date.
- **Fee Summary & Progress**:
  - Live Total Fees, Paid Fees, Remaining Fees, and Status badge.
  - Visual Payment Completion Progress Bar (`X% Paid`).
  - Detailed table of all verified receipts and payment history.

---

## 🔒 Security Architecture

- **Password Security**: Passwords are never stored in plain text. Hashed using NIST-recommended `scrypt` with cryptographically random per-user salt and verified with `crypto.timingSafeEqual` to prevent timing attacks.
- **Authentication**: Cryptographically signed HMAC-SHA256 tokens stored in `HttpOnly`, `SameSite=Lax` cookies, preventing XSS token theft.
- **Role-Based Access Control (RBAC)**: All `/api/admin/*` routes strictly require `role === 'admin'`. Unauthorized access attempts are rejected with `403 Forbidden`.
- **Database Integrity**: Native SQLite with ACID transactions, foreign keys, prepared statements (preventing SQL injection), and cascading deletion.
- **Photo Upload Security**: Validated MIME types, 5MB file size limit, and randomized UUID filenames preventing collisions and path traversal.

---

## 📁 Project Structure

```
premium-admin-user-portal/
├── server.js               # Native Node.js HTTP server, REST API router & static file engine
├── package.json            # Project manifest (zero external dependencies required)
├── README.md               # Complete documentation & instructions
├── data/
│   └── portal.db           # SQLite database (auto-created and seeded on startup)
├── src/
│   ├── auth.js             # scrypt hashing, timingSafeEqual, JWT creation & verification
│   ├── database.js         # SQLite schema, migrations, seed data, queries
│   ├── routes/
│   │   ├── authRoutes.js   # /api/auth/login, /api/auth/me, /api/auth/logout
│   │   ├── adminRoutes.js  # /api/admin/users, /api/admin/fees, /api/admin/stats
│   │   └── userRoutes.js   # /api/user/my-profile, /api/user/my-fees
│   └── utils/
│       └── uploadHelper.js # Secure profile photo storage in /public/uploads/
└── public/
    ├── index.html          # Premium Landing Page
    ├── login.html          # Common Login Page (Admin & User)
    ├── admin-dashboard.html# Full Admin Management Dashboard
    ├── user-dashboard.html # Read-Only User Portal
    ├── css/
    │   ├── style.css       # Core design system, variables, modals, buttons, toasts
    │   ├── landing.css     # Landing page hero, glow mesh, feature cards
    │   └── dashboard.css   # Stats grid, data tables, profile cards, progress bars
    ├── js/
    │   ├── api.js          # API helper, auth guards, currency/date formatters, toasts
    │   ├── login.js        # Common login controller, password toggle, role redirection
    │   ├── admin.js        # Admin CRUD controller, fee manager, search, modals
    │   └── user.js         # User dashboard controller, profile & fee metrics
    └── uploads/
        ├── default-avatar.svg # Modern geometric avatar
        └── default-admin.svg  # Premium admin shield emblem
```

---

## 🚀 How to Run the Project

### Prerequisites
- Node.js (v18+ recommended; Node v22 includes native `node:sqlite`)
- Zero external package installation required (`npm install` is NOT needed).

### Starting the Server
Open terminal in the project directory:
```bash
cd /Users/vishvasdhama/.gemini/antigravity/scratch/premium-admin-user-portal
node server.js
```

The application will start immediately:
```
=============================================================
  🌟 AuraDesk Premium Admin & User Management Portal 🌟
  🚀 Server running at: http://localhost:3000
-------------------------------------------------------------
  Default Credentials:
  👑 Admin: Identifier: "admin"        Password: "admin123"
  👤 User:  Identifier: "9876543210"   Password: "user123"
=============================================================
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**.

---

## 🔑 Default Seeded Credentials

| Role | User ID / Mobile | Password | Notes |
| :--- | :--- | :--- | :--- |
| **👑 Admin** | `admin` | `admin123` | Full administrative control |
| **👤 User 1** | `9876543210` | `user123` | Rahul Sharma (Partial Fees: ₹4,000 remaining) |
| **👤 User 2** | `9876543211` | `user123` | Priya Patel (Paid Fees: ₹0 remaining) |
| **👤 User 3** | `9876543212` | `user123` | Amit Verma (Unpaid Fees: ₹10,000 remaining) |
