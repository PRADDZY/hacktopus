# FairLens – EMI Risk Intelligence Platform

A Next.js 15 + Tailwind CSS conversion of the FairLens EMI risk assessment platform.

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v3**
- **Chart.js + react-chartjs-2** (admin dashboard charts)
- **Google Fonts** – DM Sans, DM Mono, Syne

## Project Structure

```
fairlens/
├── app/
│   ├── globals.css          # Tailwind directives + custom animations
│   ├── layout.tsx           # Root layout with metadata
│   └── page.tsx             # Entry point → loads FairLensApp
├── components/
│   ├── ui.tsx               # Shared primitives: Badge, Btn, Card, Input, Modal, Toast…
│   ├── FairLensApp.tsx      # Root client component – page state, toasts, modals
│   ├── LoginPage.tsx
│   ├── BuyerNav.tsx
│   ├── AdminSidebar.tsx
│   ├── CheckoutPage.tsx
│   ├── UploadPage.tsx
│   ├── RiskPage.tsx         # Animated SVG gauge + progress bars
│   ├── HistoryPage.tsx
│   ├── SupportPage.tsx      # Chat UI with mock bot responses
│   ├── AdminDashboard.tsx   # Chart.js doughnut, bar, distribution charts
│   ├── AdminCasesPage.tsx   # Searchable & filterable cases table
│   ├── AdminCaseDetail.tsx  # Full case view + decision bar
│   └── Modals.tsx           # HR Review modal + Override modal
└── lib/
    └── data.ts              # Shared types, CASES data, bot response logic
```

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev

# 3. Open in browser
# http://localhost:3000
```

## Login Credentials (demo)

| Role       | Email                  | Password |
|------------|------------------------|----------|
| Customer   | user@fairlens.io       | any      |
| Bank Admin | admin@hdfc.com         | any      |

## Features

### Customer Flow
- **Shop** – Product page with EMI details
- **Upload** – Drag & drop bank statement (PDF/CSV/XLSX), financial profile form
- **Risk Report** – Animated debt-trap gauge, breakdown bars, AI recommendations
- **History** – Timeline of past EMI applications
- **Support** – AI chat assistant (mock keyword responses)

### Bank Admin Flow
- **Dashboard** – KPI stats, doughnut chart, bar chart, risk distribution
- **Cases** – Searchable/filterable table of all applications
- **Case Detail** – Full customer profile, risk flags, bank statement summary
- **Actions** – Approve / Reject / Manual Override with toast notifications
