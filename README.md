# 🎓 EduPath — Advanced Online Education & E-Learning Platform

[![Live Website](https://img.shields.io/badge/🌐_Live_Website-edupathlearn.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://edupathlearn.vercel.app/)
[![Django](https://img.shields.io/badge/Django-6.0-092E20?style=for-the-badge&logo=django)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql)](https://supabase.com)
[![Redis](https://img.shields.io/badge/Redis-Caching-DC382D?style=for-the-badge&logo=redis)](https://redis.io)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-Search-005571?style=for-the-badge&logo=elasticsearch)](https://elastic.co)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe)](https://stripe.com)

🚀 **Live Deployed Website**: [https://edupathlearn.vercel.app/](https://edupathlearn.vercel.app/)

EduPath is a full-stack, enterprise-grade e-learning platform built for students, course creators, and platform administrators. Featuring full-text Elasticsearch search, real-time WebSocket notifications, dual payment gateways (Stripe & PayPal), interactive quizzes, PDF certificate generation, and an analytical reporting dashboard.

---

## ✨ Key Features

### 👨‍🎓 Student Experience
* **Course Catalog & Dual-Engine Search**: Search courses using high-performance Elasticsearch BM25 full-text queries or PostgreSQL fallbacks with typo-tolerance, autocomplete, and facet filters.
* **Interactive Learning Player**: Video playback, module navigation, and automatic progress tracking.
* **Quiz Engine & Attempt History**: Timed quizzes, automated grading, option shuffling, and score tracking.
* **Automated PDF Certificates**: Instant PDF certificate generation upon 100% course completion powered by `ReportLab`.
* **Activity Calendar Heatmap**: GitHub-style daily learning activity heatmap and active learning streak counters.

### 👨‍🏫 Mentor Portal
* **Course Builder**: Modular drag-and-drop course creator for lessons, quizzes, and widescreen 16:9 thumbnail previews.
* **Course Analytics**: Recharts visualizations for 30-day enrollment trends (`LineChart`), syllabus progress distribution (`PieChart`), and lesson drop-off completion (`BarChart`).
* **Q&A Discussion Forum**: Threaded discussion boards with mentor moderation and solution flagging.

### 🛡️ Admin Dashboard & Reporting
* **Content & Mentor Moderation**: One-click approval workflows for new course submissions and mentor verification requests.
* **Analytical Reports Engine**: High-speed system metrics powered by Redis caching (`admin_reports` TTL 300s) with date range, category, and student status filters.
* **Excel & CSV Export**: One-click report downloads generated via `openpyxl`.
* **Abuse Moderation Queue**: Review reported student comments with automated rating average recalculation upon content removal.

---

## 🛠️ Architecture & Technology Stack

```
                             [EduPath System Architecture]

   [React Frontend (Vite)] ───────────────────────► [Django REST Framework API]
   • Route-Guarded Navigation                      • SimpleJWT Authentication
   • Recharts & Activity Heatmaps                  • PostgreSQL (Supabase PgBouncer)
   • WebSocket Listener (Notifications)            • Redis Caching & Elasticsearch
                                                   • WebSockets (Django Channels / Daphne)
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React (Vite), React Router v6, Vanilla CSS Tokens, Recharts, Tabler Icons |
| **Backend** | Python 3.14, Django 6.0, Django REST Framework, SimpleJWT |
| **Database** | PostgreSQL on Supabase (PgBouncer Transaction Pooler) |
| **Search Engine** | Elasticsearch DSL (`django-elasticsearch-dsl`) |
| **Cache & Realtime** | Redis, Django Channels (Daphne ASGI WebSockets) |
| **Payments** | Stripe Checkout API & PayPal Sandbox Webhooks |
| **Media & Storage** | Cloudinary Cloud Media Storage |
| **Email Delivery** | Brevo (Dual-Mode: Port 465 SSL SMTP & Brevo HTTPS REST API) |

---

## 🚀 Quick Start & Local Setup

### Prerequisites
* Python 3.10+
* Node.js 18+
* PostgreSQL or Supabase Database

### 1. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Environment variables
cp .env.example .env

# Run database migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

### 2. Frontend Setup
```bash
cd frontend

# Install node dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will start at `http://localhost:5173` and connect to backend API at `http://localhost:8000`.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
