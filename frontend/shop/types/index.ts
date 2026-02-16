export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviewsCount: number;
  images: string[];
  description: string;
  specifications: Record<string, string>;
  highlights: string[];
  offers: Offer[];
  warranty: string;
  returnPolicy: string;
  inStock: boolean;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  type: 'bank' | 'cashback' | 'festival' | 'emi';
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  product: Product;
  quantity: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveryDate?: string;
  address: Address;
  paymentMethod: string;
  emiDetails?: EMIDetails;
}

export interface EMIDetails {
  duration: number;
  monthlyPayment: number;
  bank: string;
  status: 'approved' | 'rejected' | 'pending';
  cardLastFour: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'price_drop' | 'sale' | 'delivery' | 'order';
  read: boolean;
  timestamp: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface AppState {
  auth: AuthState;
  cart: CartItem[];
  wishlist: Product[];
  orders: Order[];
  notifications: Notification[];
  addresses: Address[];
}
