# Premium Store - Neo-Brutalism E-Commerce Website

A fully functional, frontend-only modern e-commerce shopping website built with Next.js featuring a **single premium product** (MacBook Pro M3 Max worth ₹3,49,900) with complete shopping features including EMI approval flow.

## 🎨 Design Features

- **Neo-Brutalism UI**: Bold borders, bright colors, brutal shadows
- **Fully Responsive**: Mobile-first design for all devices
- **Custom Fonts**: Space Grotesk (display) + Inter (body)
- **Animations**: Smooth transitions and hover effects

## ⭐ Key Features

### Single Product Store
- Only ONE premium product (₹1L+ MacBook Pro M3 Max)
- Full product details with image gallery, specifications, reviews
- Multiple product cards showing different "variants" (Best Deal, Trending, etc.)

### Complete E-Commerce Flow
✅ Homepage with hero carousel and flash deals
✅ Product detail page with zoom, reviews, delivery check
✅ Shopping cart with quantity management
✅ Multi-step checkout process
✅ **EMI Payment with Bank Approval Flow** ⭐
✅ Order tracking and history
✅ Wishlist functionality
✅ User authentication (email + phone OTP)
✅ Profile management
✅ Support page with chatbot UI
✅ Admin dashboard (UI only)

### 💳 EMI Feature (MOST IMPORTANT)

The checkout includes a complete **EMI approval simulation**:

1. **EMI Selection**: Choose 3/6/9/12 months
2. **Bank Selection**: HDFC, ICICI, SBI, Axis, Kotak
3. **EMI Form**: 
   - Card type (Credit/Debit)
   - Card last 4 digits
   - Monthly income
   - Bank statement upload (optional)
4. **Approval Process**:
   - Shows "Waiting for Bank Approval" modal
   - Loading spinner for 5-8 seconds
   - Random approval/rejection (70% approval rate)
   - ✅ If approved: User can place order
   - ❌ If rejected: Shows error message

### Pages

**Public Pages:**
- `/` - Homepage
- `/login` - Login (Email + Phone OTP)
- `/signup` - Signup
- `/product/[id]` - Product Details
- `/cart` - Shopping Cart
- `/checkout` - Checkout with EMI
- `/orders` - Order History
- `/wishlist` - Saved Items
- `/profile` - User Profile
- `/support` - Customer Support

**Admin Pages (UI Only):**
- `/admin/dashboard` - Overview
- `/admin/orders` - Order Management
- `/admin/users` - User Management
- `/admin/analytics` - Analytics Dashboard

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run Development Server
```bash
npm run dev
```

The app will be available at **http://localhost:3000**

### Step 3: Build for Production
```bash
npm run build
npm start
```

## 📁 Project Structure

```
premium-store/
├── app/
│   ├── layout.tsx              # Root layout with StoreProvider
│   ├── page.tsx                # Homepage
│   ├── globals.css             # Global styles + neo-brutalism
│   ├── login/page.tsx          # Login page
│   ├── signup/page.tsx         # Signup page
│   ├── product/[id]/page.tsx   # Product detail page
│   ├── cart/page.tsx           # Shopping cart
│   ├── checkout/page.tsx       # Checkout with EMI ⭐
│   ├── orders/page.tsx         # Order history
│   ├── wishlist/page.tsx       # Wishlist
│   ├── profile/page.tsx        # User profile
│   ├── support/page.tsx        # Support & FAQ
│   └── admin/
│       ├── dashboard/page.tsx  # Admin dashboard
│       ├── orders/page.tsx     # Order management
│       ├── users/page.tsx      # User management
│       └── analytics/page.tsx  # Analytics
├── components/
│   ├── Button.tsx              # Reusable button component
│   ├── Navbar.tsx              # Navigation bar
│   └── Footer.tsx              # Footer
├── store/
│   └── StoreContext.tsx        # Global state management
├── data/
│   └── product.ts              # Single product data
├── types/
│   └── index.ts                # TypeScript interfaces
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## 🎯 Features Breakdown

### Authentication
- **Email + Password** login
- **Phone + OTP** login (dummy OTP: 123456)
- **Social login UI** (Google, Facebook)
- Session stored in localStorage

### Product Features
- ✅ Image gallery with zoom
- ✅ Full specifications table
- ✅ Ratings & reviews section
- ✅ Bank offers & discounts
- ✅ Pincode delivery check
- ✅ Warranty & return policy

### Cart Features
- ✅ Add/remove items
- ✅ Quantity adjustment
- ✅ Price breakdown (subtotal, discount, GST, delivery)
- ✅ Save for later (move to wishlist)

### Checkout Features
**Step 1: Address**
- Select saved addresses
- Add new address form

**Step 2: Delivery**
- Standard (3-5 days)
- Express (1-2 days)
- Scheduled delivery

**Step 3: Payment** ⭐
- **EMI Option** with complete approval flow
- Credit/Debit Card
- UPI
- Digital Wallets
- Cash on Delivery

**Step 4: Review & Confirm**
- Order summary
- Final confirmation

### Data Persistence
All data is stored in **localStorage**:
- User session
- Cart items
- Wishlist
- Orders
- Addresses
- Notifications

## 🎨 Color Scheme (Neo-Brutalism)

- **Primary**: #FF6B6B (Red/Pink)
- **Secondary**: #4ECDC4 (Teal)
- **Accent**: #FFE66D (Yellow)
- **Dark**: #1A1A1A
- **Light**: #F7FFF7

## 📱 Responsive Design

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

All components are fully responsive with mobile-first approach.

## 🧪 Testing the App

### Login Credentials
- **Email**: Any valid email (e.g., test@example.com)
- **Password**: Any password
- **Phone OTP**: 123456

### Testing EMI Approval
1. Add product to cart
2. Go to checkout
3. Select EMI payment
4. Choose duration and bank
5. Fill EMI form
6. Click "Submit for EMI Approval"
7. Wait 5-8 seconds
8. 70% chance of approval ✅
9. If approved, place order

## 💡 Dummy Data

- **Product**: MacBook Pro 16" M3 Max (₹3,49,900)
- **OTP**: 123456
- **Login**: Any email/password works
- **EMI Approval**: Random (70% success rate)

## 🛠️ Technologies Used

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Context API
- **Icons**: Lucide React
- **Images**: Unsplash (via CDN)

## 📝 Notes

- This is a **frontend-only demo** with no backend
- All data is **simulated** and stored in localStorage
- EMI approval is **randomly generated** (not real bank integration)
- Product images are from Unsplash
- No actual payment processing

## 🎯 Future Enhancements

- Multiple products
- Real payment gateway integration
- Backend API integration
- User reviews and ratings system
- Product search and filters
- Order tracking with live updates

## 📄 License

This project is for demonstration purposes only.

---

**Built with ❤️ using Next.js and Neo-Brutalism Design**
