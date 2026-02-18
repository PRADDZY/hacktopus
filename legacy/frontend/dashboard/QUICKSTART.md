# Quick Start Guide - Bank Risk Management Dashboard

## Installation & Setup

1. **Navigate to the project directory:**
```bash
cd bank-risk-dashboard
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run the development server:**
```bash
npm run dev
```

4. **Open your browser:**
Navigate to [http://localhost:3000](http://localhost:3000)

## What You'll See

### 1. Dashboard (Home Page)
- 4 KPI cards showing key metrics
- Complete EMI requests table
- Search and filter capabilities
- Click "Review" on any request to open the buyer details drawer

### 2. EMI Requests Page
- Dedicated view for all EMI applications
- Summary cards at the top
- Full request management table

### 3. Analytics Page
- Monthly default prediction chart
- Risk distribution trends
- Top risk factors analysis
- Category breakdown

### 4. Audit Logs Page
- Complete activity tracking
- Filter by status (Success/Warning/Error)
- Search functionality

## Key Features to Try

1. **Search**: Use the search bar in the navbar or table filters
2. **Notifications**: Click the bell icon to view alerts
3. **Profile Menu**: Click the user avatar for profile options
4. **Buyer Details**: Click "Review" on any EMI request to open detailed analysis
5. **Navigation**: Use the left sidebar to navigate between pages
6. **Table Actions**: Try the Approve/Reject buttons on pending requests

## Mock Data

All data is pre-populated with realistic examples:
- 8 EMI requests with varying risk levels
- 5 system alerts
- 12 months of default prediction data
- 12 months of risk trend data
- 8 audit log entries

## Build for Production

```bash
npm run build
npm start
```

## Troubleshooting

If you encounter any issues:

1. **Port already in use**: Change the port by running:
   ```bash
   PORT=3001 npm run dev
   ```

2. **Dependencies not installed**: Make sure to run `npm install` first

3. **Module not found errors**: Delete `node_modules` and `.next`, then run:
   ```bash
   rm -rf node_modules .next
   npm install
   npm run dev
   ```

## Technology Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts for data visualization
- Responsive design

## Browser Compatibility

Works best on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Enjoy exploring the Bank Risk Management Dashboard!
