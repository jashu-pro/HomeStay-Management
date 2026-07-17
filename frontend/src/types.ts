export type UserRole = 'admin' | 'viewer';

export interface User {
  id: string;
  username: string;
  password?: string; // Omitting when sending to client
  role: UserRole;
  fullName: string;
  email?: string;
  phone?: string;
  profile_image?: string;
  email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
  verification_token?: string;
  reset_token?: string;
  reset_token_expires_at?: string;
  ownerId?: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  failedLoginAttempts?: number;
  lockoutUntil?: string;
  forcePasswordReset?: boolean;
}

export interface Guest {
  id: string;
  fullName: string;
  gender: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  nationality: string;
  // Gov Identity
  aadhaarNumber: string;
  aadhaarFront?: string; // Base64 data-url or empty
  aadhaarBack?: string;  // Base64 data-url or empty
  passportNumber?: string;
  drivingLicense?: string;
  panCard?: string;
  userId?: string;
}

export interface Booking {
  id: string;
  guestId: string;
  guestName: string;
  bookingDate: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomNumber: string;
  roomType: string;
  status: 'upcoming' | 'checked-in' | 'checked-out' | 'cancelled';
  specialRequests: string;
  userId?: string;
}

export interface VisitorLog {
  id: string;
  guestName: string;
  arrive: string; // ISO datetime string or YYYY-MM-DDTHH:mm
  depart: string; // ISO datetime string or YYYY-MM-DDTHH:mm
  purpose: string;
  visitorsCount: number;
  vehicleNumber: string;
  emergencyContact: string;
  userId?: string;
}

export interface Room {
  roomNumber: string;
  category: string;
  pricePerNight: number;
  capacity: number;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  userId?: string;
}

export interface Invoice {
  invoiceNumber: string;
  bookingId: string;
  guestName: string;
  roomCharges: number;
  foodCharges: number;
  laundryCharges: number;
  extraServices: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  advancePaid: number;
  remainingBalance: number;
  userId?: string;
}

export interface Payment {
  id: string;
  invoiceNumber: string;
  paymentDate: string;
  amountPaid: number;
  balanceDue: number;
  paymentMethod: 'Cash' | 'UPI' | 'Credit Card' | 'Debit Card' | 'Bank Transfer';
  transactionId: string;
  status: 'Pending' | 'Completed' | 'Refunded';
  notes: string;
  userId?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  details: string;
}

export interface SystemNotification {
  id: string;
  type: 'check-in' | 'check-out' | 'payment' | 'booking';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  linkId?: string; // Reference to booking, invoice, etc.
  userId?: string;
}

export interface DashboardStats {
  totalGuests: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  occupiedRooms: number;
  availableRooms: number;
  monthlyRevenue: number;
  pendingPayments: number;
  totalBookings: number;
}

export interface RecycleBinItem {
  id: string;
  type?: 'guest' | 'visitor';
  guest: Guest;
  bookings: Booking[];
  invoices: Invoice[];
  payments: Payment[];
  visitorLogs: VisitorLog[];
  deletedAt: string;
  deletedBy: string;
  reason?: string;
  userId?: string;
}

export interface CleanupSettings {
  retentionDays: 'never' | '30' | '60' | '90';
}

export interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  token?: string;
  timestamp: string;
}
