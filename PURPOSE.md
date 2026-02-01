# 🎯 SOLE AIM OF THIS PROJECT (Nothing More, Nothing Less)

To build a simple, clean expense-tracking web app that demonstrates your ability to design, build, and deploy a modern backend system using TypeScript, PostgreSQL, Docker, and cloud infrastructure (AWS/Kubernetes), while collaborating effectively with a frontend developer.

That's it.

**Not:**
- Building the next Mint
- Shipping a consumer product
- Showing off every AWS service

This is a portfolio + collaboration + systems-thinking project.

## 🧠 What This Project Is REALLY Showcasing

### Technical
- Clean backend architecture
- Auth done properly (JWT)
- Relational data modeling
- Environment separation (local / staging / prod)
- Cloud readiness (Docker → AWS → K8s)

### Professional
- Working with a frontend dev
- API contracts
- Documentation (Postman, README)
- Scoped, intentional feature set

## 🧱 CORE FEATURES (LOCKED SCOPE)

These are the only features we are building.

### 1️⃣ Authentication
- Sign up (email, full name, password)
- Login (email, password)
- JWT-based authentication
- Protected routes

### 2️⃣ Dashboard (Read-Only Aggregations)
- Total amount spent
- Number of expenses
- Average monthly expense
- Category breakdown
- Budget vs expense comparison
- Monthly trends

⚠️ No charts logic complexity beyond basic aggregations.

### 3️⃣ Expense Management
- Create expense
- View expense history
- Filter by month & category
- Search expenses
- Update expense
- Delete expense

**Fields:**
- Date
- Category
- Note
- Amount

### 4️⃣ Budget Management
- Set monthly budget per category
- View past budgets
- Cannot edit budgets once month starts
- Compare budget vs spending

### 5️⃣ Profile Settings
- View user info
- Edit name
- Logout
- Email is immutable

## 🖥️ Platform Constraints (Very Important)

- Desktop web app only
- No mobile optimization
- No notifications
- No offline mode

## 🏗️ BACKEND GOALS (This Is the Real Meat)

### Architecture
- Modular structure (auth, users, expenses, budgets)
- Controller → service → repository
- Type-safe DTOs

### Data
- PostgreSQL
- Prisma ORM
- Migrations

### Security
- Password hashing
- JWT auth
- Protected routes

## ☁️ INFRASTRUCTURE GOALS (Phased, Not Rushed)

### Phase 1
- Local dev (Docker Postgres)
- Staging DB (Neon)
- Deployed backend for testing

### Phase 2
- Dockerized backend
- AWS RDS (Postgres)
- AWS-hosted backend

### Phase 3
- Kubernetes deployment
- Config via env vars
- Horizontal scalability (conceptual)

## 🤝 COLLABORATION GOALS

- Separate repos (frontend & backend)
- Postman collection as API contract
- Stable staging endpoints
- Clear README

## 🚫 WHAT WE ARE NOT BUILDING (On Purpose)

This part is just as important.

❌ Payments
❌ Bank integrations
❌ OAuth / social login
❌ Notifications
❌ File uploads
❌ Admin panels
❌ Mobile app

Avoiding these is discipline, not limitation.

## 🧠 One-Sentence Summary (Bookmark This)

"A scoped, production-style expense tracker built to demonstrate backend engineering fundamentals, cloud readiness, and real-world collaboration."

Whenever you feel lost or tempted to add features — read that sentence again.
