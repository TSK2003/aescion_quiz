# AESCION EDTECH SOLUTIONS - Enterprise Assessment Platform

A robust, enterprise-grade assessment and quiz management platform built with modern web technologies. This application allows administrators to manage courses, participants, and quizzes while providing a secure, proctored environment for students to take assessments.

## 🚀 Technologies Used
* **Frontend Framework:** React 19 + Vite
* **Styling:** Tailwind CSS v4 + Framer Motion
* **State Management:** Zustand
* **Routing:** React Router v7
* **Backend:** Firebase (Authentication, Firestore Database, Hosting)
* **Data Processing:** SheetJS (`xlsx`) for Excel Parsing
* **Data Visualization:** Recharts



## 🔐 Default Login Credentials
An initial Admin account is automatically seeded into the database the first time you run the application.

* **Email:** `admin_aescion@aescion.com`
* **Password:** `AescionAdmin#@123`

*(Note: Participants must register their own accounts. Once registered, their accounts start as "Pending" and must be approved by the Admin before they can access the dashboard).*

## 🌟 Key Features
* **Role-Based Access Control:** Secure routes for Admins and Participants.
* **Bulk Question Import:** Upload `Quiz_A.xlsx` and `Quiz_B.xlsx` to automatically parse and validate multiple-choice questions.
* **A/B Assignment System:** Admins can manually assign different question sets to specific users.
* **Proctored Exam Environment:** 
  - Strict 15-second per question timer.
  - Fullscreen enforcement.
  - Tab-switch and window-minimize tracking.
  - Developer console and copy/paste blocking.
  - 3-strike automatic disqualification rule.
* **Live Analytics & Leaderboard:** View score distributions via interactive charts and a dedicated Live TV Projector page (`/live-tv`).
* **Audit Trails:** Track all system events and violations in real-time.

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory and add your Firebase configuration:
```env
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
npm run preview
```

### 5. Deploy to Firebase Hosting
```bash
npx firebase login
npx firebase init hosting
npx firebase deploy --only hosting
```
