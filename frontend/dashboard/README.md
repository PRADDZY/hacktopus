# Bank Risk Management Dashboard

A professional, enterprise-grade frontend application for managing bank EMI requests and risk assessment.

## Features

- **Dashboard Overview**: Real-time KPI cards showing pending requests, high-risk alerts, and auto-processing stats
- **EMI Requests Management**: Comprehensive table with search, filter, sort, and pagination capabilities
- **Buyer Details Drawer**: Side panel with detailed financial analysis and risk breakdown
- **Analytics Page**: Visual charts showing default predictions and risk trends
- **Audit Logs**: Complete activity tracking with filtering and search
- **Responsive Design**: Works seamlessly on desktop and tablet devices

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Heroicons (via SVG)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/dashboard/
├── app/
│   ├── layout.tsx              # Root layout with sidebar and navbar
│   ├── page.tsx                # Dashboard page
│   ├── emi-requests/
│   │   └── page.tsx           # EMI requests page
│   ├── analytics/
│   │   └── page.tsx           # Analytics page
│   └── audit-logs/
│       └── page.tsx           # Audit logs page
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Left navigation sidebar
│   │   └── Navbar.tsx         # Top navigation bar
│   └── dashboard/
│       ├── KPICard.tsx        # KPI metric card
│       ├── EMIRequestsTable.tsx   # Requests data table
│       └── BuyerDetailsDrawer.tsx # Buyer details side panel
├── lib/
│   └── mockData.ts            # Mock data for development
├── types/
│   └── index.ts               # TypeScript type definitions
└── public/                     # Static assets
```

## Key Components

### Sidebar Navigation
- Dashboard
- EMI Requests
- Analytics
- Audit Logs

### Top Navbar
- Search functionality
- Notification dropdown with alerts
- User profile dropdown
- Secure session indicator

### Dashboard Features
- 4 KPI cards with real-time metrics
- Comprehensive EMI requests table
- Advanced filtering and search
- Pagination support

### Buyer Details Drawer
- Financial overview (income, EMIs, expenses, savings)
- Income vs Expense bar chart
- EMI burden donut chart
- Debt trap probability gauge
- Risk breakdown with progress bars
- Approve/Reject actions

### Analytics Page
- Monthly default prediction line chart
- Risk distribution trend bar chart
- Top risk factors analysis
- Category distribution

### Audit Logs
- Complete activity tracking
- Filter by status
- Search functionality
- Detailed action information

## Design Principles

- Clean, professional banking UI
- Consistent spacing and alignment
- No gradients or excessive animations
- Structured layouts with minimal styling
- Enterprise-grade appearance
- Responsive and accessible

## Mock Data

The application uses mock data for demonstration purposes. All data is defined in `lib/mockData.ts` and includes:
- EMI requests
- Alerts
- Monthly default predictions
- Risk trend data

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This is a demonstration project for educational purposes.
