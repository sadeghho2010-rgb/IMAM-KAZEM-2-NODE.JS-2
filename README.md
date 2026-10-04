# 🏛️ Madrasah Comprehensive Management System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, full-stack management and administrative platform tailored for theological institutes, seminaries, and academic academies. Designed for multi-role workflows, reliable student tracking, automated tuition calculation, cryptographic audit trails, and multi-cloud portability.

---

## 🚀 Key Features

- **Multi-Role Access Control (3-Tier RBAC):**
  - **Level 1 (Super Admin & Vice Principals):** System-wide configuration, access control, database backups, audit trails.
  - **Level 2 (Academic, Financial, & Grade Supervisors):** Attendance, curriculum, tuition fees, loans, oral examinations, research evaluations.
  - **Level 3 (Students & Class Representatives):** Personal activity, self-service request portal, meal reservations, lockers, study logs.
- **Self-Service Student Request Desk:**
  - Online student ticketing to Academic, Financial, and Welfare/Cultural departments.
  - Department officer availability toggles and official decision/rejection letters.
- **Financial & Tuition Calculation Engine:**
  - Automated calculation of student stipends, dormitory allowances, loan installments, and faculty compensation.
- **Cryptographic Audit Trail (Hash Chain):**
  - Tamper-evident SHA-256 chained transaction logging.
- **Real-Time Anomaly Detection & Instant Rollback:**
  - Heuristic detection of bulk mutations, unusual transactions, and out-of-office actions with one-click snapshot rollback.
- **Physical Locker Management:**
  - Visual 200-locker matrix, vacancy tracking, key handover history, and defect tracking.
- **Universal Portability:**
  - Compatible with Runflare, Railway, Vercel, Docker, and Linux VPS (Ubuntu + PM2 + Nginx).

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion (Framer Motion) |
| **Backend** | Node.js (v18-v22), Express.js, JWT, BcryptJS, Zod Schemas |
| **Build & Tooling** | Vite 6, esbuild, TypeScript Compiler (`tsc`) |
| **Databases** | MySQL 8 / MariaDB / PostgreSQL, Local IndexedDB with Offline Sync |
| **Process Management** | PM2 (`ecosystem.config.cjs`), Docker (`Dockerfile`, `docker-compose.yml`) |

---

## ⚙️ Quick Start (Local Development)

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0 (or Bun / pnpm)

### 2. Installation
```bash
git clone https://github.com/your-username/madrasah-app.git
cd madrasah-app
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```
Fill in the `JWT_SECRET`, `JWT_REFRESH_SECRET`, and optional database variables in `.env`.

### 4. Database Setup
Execute `database_complete.sql` in your MySQL 8 or PostgreSQL database:
```bash
mysql -u root -p madrasah_db < database_complete.sql
```

### 5. Running the Application
```bash
# Start full-stack dev server (Express + Vite HMR)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Production Deployment

### Option A: Runflare
Refer to the comprehensive [Runflare Deployment Guide](DEPLOYMENT.md) for full, step-by-step instructions.

### Option B: Docker Compose
```bash
docker compose up -d --build
```

### Option C: Ubuntu VPS with PM2 & Nginx
```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
```
Refer to [DEPLOYMENT.md](DEPLOYMENT.md) for full Nginx and SSL setup.

---

## 🚀 Deploy on Runflare (استقرار روی ران‌فلر)

برای استقرار راحت، سریع و کاملاً بهینه‌سازی شده سیستم روی پلتفرم ابری ران‌فلر، به صورت زیر عمل کنید:

* **راهنمای گام‌به‌گام**: [راهنمای جامع استقرار در Runflare (DEPLOYMENT.md)](DEPLOYMENT.md)
* **اطلاعات ورود پیش‌فرض (Default Login Credentials)**:
  * **نام کاربری**: `admin`
  * **کلمه عبور**: `Admin@123456`
* **صفحه سلامت سیستم**: پس از ورود با نقش مدیریت ارشد (`super_admin`) می‌توانید وضعیت مصرف منابع سرور و پایش زنده دیتابیس را در سربرگ **سلامت سیستم** مشاهده کنید.

---

## 📚 Documentation

- [Farsi Documentation (راهنمای فارسی)](README.fa.md)
- [Architecture & Design](ARCHITECTURE.md)
- [Database Schema & Data Dictionary](DATABASE.md)
- [REST API Catalog](API.md)
- [Security & Threat Model](SECURITY.md)
- [Troubleshooting & Runbook](TROUBLESHOOTING.md)
- [Changelog](CHANGELOG.md)

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
