# Tasks

## Phase 1: Environment Setup & Core Architecture
- [x] Create workspace directory structure (`backend/` and `frontend/`)
- [x] Initialize Python Virtual Environment (`.venv`) and configure `requirements.txt`
- [x] Initialize Django Project, configure Django REST Framework (DRF) & Channels
- [x] Setup local database (SQLite for local dev, schema structured to be PostgreSQL/MySQL compatible)
- [x] Initialize React (Vite + TypeScript + CSS) project in `frontend/`
- [x] Configure `channels.layers.InMemoryChannelLayer` for local Redis-free WebSocket development


## Phase 2: Authentication & User Management (JWT)
- [x] Implement Custom User model with Roles (Student, Mentor, Admin)
- [x] Configure `djangorestframework-simplejwt` for JWT access/refresh tokens
- [x] Implement Auth endpoints (Register, Login, Refresh, Profile)
- [x] Create custom permission classes (`IsStudent`, `IsMentor`, `IsAdmin`)
- [x] Implement Frontend Auth Context and routing

## Phase 3: Course & Curriculum Management
- [x] Build backend models for Course, Module, Lesson, Quiz, Question, Attachment
- [x] Create APIs for Mentor to create and manage courses and curriculum
- [x] Setup file upload storage handlers (mock S3 or local storage for dev)
- [x] Create Admin moderation APIs for approving mentors/courses
- [x] Build Mentor Dashboard UI in React
- [x] Build Admin Panel UI in React

## Phase 4: Enrollment & Learning Flow
- [x] Build Course Catalog UI (search, filters, course cards) — `CoursesPage.jsx`
- [x] Build Course Detail Page (syllabus, enrollment card) — `CoursePage.jsx` + CSS fixed ✓
- [x] Implement Enrollment logic (Free instant + Paid mock checkout) — `payments/views.py`
- [x] Create Progress tracking backend APIs — `LessonProgressViewSet` in `payments/views.py`
- [x] Implement Certificate generation mechanism (ReportLab PDF) — `payments/utils.py`
- [x] Build Video/PDF Learning Player UI in React — `LearningPlayer.jsx`
- [x] Implement curriculum guardrails (hide assets from unenrolled) — `courses/serializers.py`
- [x] Build Mentor Course Builder UI — `CourseBuilder.jsx` + CSS fixed ✓

## Phase 5: Payment Integration
- [x] Integrate Stripe checkout sessions
- [x] Integrate PayPal sandbox checkout
- [x] Create payment webhook handlers
- [x] Implement refund logic & entitlement rollback

## Phase 6: Real-time Q&A Chat
- [ ] Setup Django Channels Routing & Consumer
- [ ] Configure Redis Channel Layer
- [ ] Implement threaded messages database storage
- [ ] Create message flagging & moderation controls
- [ ] Build live Q&A Chat component in React

## Phase 7: Search & Filtering
- [ ] Implement abstract Search Service class (supporting both Local DB search & Elasticsearch)
- [ ] Implement database-backed fallback search and filtering logic (price, level, duration, rating)
- [ ] Define Elasticsearch index schema for production deployment
- [ ] Build search & advanced filtering APIs with autocomplete on the frontend


## Phase 8: Ratings, Reviews & Notifications
- [ ] Implement one-review-per-course validation
- [ ] Add ratings calculations triggers (average rating aggregation)
- [ ] Create notification model and WebSocket consumers for in-app alerts
- [ ] Configure email notification sender (mock/SMTP)

## Phase 9: Frontend Integration & Polish
- [ ] Integrate React Query / State management
- [ ] Apply rich aesthetic design, responsive layouts, transitions, loading skeletons
- [ ] Verify accessibility and SEO metadata
