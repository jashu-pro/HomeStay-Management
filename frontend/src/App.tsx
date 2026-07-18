import React, { useState, useEffect, useRef } from 'react';
import { Language, translations } from './lib/translations';
import { safeFetch, isBackendReady } from './lib/api';

// Import Views
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import GuestsView from './components/GuestsView';
import BookingsView from './components/BookingsView';
import VisitorLogView from './components/VisitorLogView';
import BillingView from './components/BillingView';
import RoomsView from './components/RoomsView';
import AuditView from './components/AuditView';
import BackupView from './components/BackupView';
import ReportsView from './components/ReportsView';
import PrintRegisterView from './components/PrintRegisterView';
import RecycleBinView from './components/RecycleBinView';

// Icons
import { 
  LayoutDashboard, Users, Calendar, Clipboard, CreditCard, Hotel, Shield, FileBarChart, LogOut, Menu, X, Printer, CheckCircle, Trash2,
  Settings, Lock, Eye, EyeOff, KeyRound, User, Phone, Mail, Camera, Upload, Sun, Moon, AlertCircle, Check
} from 'lucide-react';

const compressImageAndSet = (file: File, callback: (base64: string) => void, onError: (err: string) => void, lang: string) => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    onError(lang === 'en' 
      ? 'Unsupported image format. Please select a JPG, JPEG, PNG, or WEBP image.' 
      : 'మద్దతు లేని చిత్రం ఫార్మాట్. దయచేసి JPG, JPEG, PNG లేదా WEBP చిత్రాన్ని ఎంచుకోండి.');
    return;
  }

  const maxSizeBytes = 5 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    onError(lang === 'en'
      ? 'The image exceeds the maximum size of 5MB.'
      : 'చిత్రం గరిష్ట పరిమాణం 5MB కంటే ఎక్కువగా ఉంది.');
    return;
  }

  const reader = new FileReader();
  reader.onloadend = () => {
    const base64Str = reader.result as string;
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const compressThreshold = 200 * 1024; // 200 KB
      if (file.size > compressThreshold || img.width > 1200 || img.height > 1200) {
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          callback(compressedBase64);
        } else {
          callback(base64Str);
        }
      } else {
        callback(base64Str);
      }
    };
    img.onerror = () => {
      callback(base64Str);
    };
  };
  reader.readAsDataURL(file);
};

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  // Auth States
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('hs_token'));
  const [user, setUser] = useState<{ 
    id: string; 
    username: string; 
    role: 'admin' | 'viewer'; 
    fullName: string;
    email?: string;
    phone?: string;
    profile_image?: string;
    email_verified?: boolean;
  } | null>(() => {
    const saved = localStorage.getItem('hs_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [checkingAuth, setCheckingAuth] = useState(true);

  // Server wake-up status
  const [serverReady, setServerReady] = useState(isBackendReady);
  useEffect(() => {
    const onReady = () => setServerReady(true);
    window.addEventListener('backend-ready', onReady);
    // If already ready, dismiss immediately
    if (isBackendReady()) setServerReady(true);
    return () => window.removeEventListener('backend-ready', onReady);
  }, []);

  // Dark/Light Theme Support
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('hs_theme') as 'light' | 'dark') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('hs_theme', theme);
  }, [theme]);

  // Navigation States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'guests' | 'bookings' | 'visitors' | 'billing' | 'rooms' | 'audit' | 'reports' | 'recycle'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPrintRegister, setShowPrintRegister] = useState(false);
  const [allGuests, setAllGuests] = useState([]); // Shared guests list for printing

  // Settings & Profile States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileFullName, setProfileFullName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Security: Client-side Password Strength Check
  const checkPasswordStrength = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter (A-Z).';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter (a-z).';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one numerical digit (0-9).';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      return 'Password must contain at least one special character (e.g. !, @, #, $, %).';
    }
    return null;
  };

  // ---------------- SECURITY: AUTOMATIC INACTIVITY LOGOUT ----------------
  // Trigger logout after 10 minutes (600,000 ms) of complete user silence
  const inactivityTimeout = 10 * 60 * 1000; 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('hs_token');
    localStorage.removeItem('hs_user');
    setToken(null);
    setUser(null);
    setShowPrintRegister(false);
    setActiveTab('dashboard');
  };

  const resetInactivityTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (token) {
      timerRef.current = setTimeout(() => {
        alert(lang === 'en' 
          ? 'Session expired! You have been automatically logged out due to 10 minutes of complete inactivity.' 
          : 'సెషన్ ముగిసింది! 10 నిమిషాలపాటు నిష్క్రియంగా ఉన్నందున మీరు స్వయంచాలకంగా లాగౌట్ అయ్యారు.');
        handleLogout();
      }, inactivityTimeout);
    }
  };

  useEffect(() => {
    // Add event listeners to detect active user interactions
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    
    if (token) {
      resetInactivityTimer();
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
    };
  }, [token, lang]);

  // ---------------- SECURITY & DATABASE RESTORATION ON LOAD ----------------
  useEffect(() => {
    const verifySessionAndRestoreDB = async () => {
      if (!token) {
        setCheckingAuth(false);
        return;
      }
      
      try {
        console.log('[Auth & Sync] Initializing operator session...');
        
        // Restore server DB from browser local storage backup if it exists
        const localDbStr = localStorage.getItem('homestay_db');
        if (localDbStr) {
          try {
            console.log('[Auth & Sync] Restoring database file on server from local backup...');
            const syncData = await safeFetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ db: JSON.parse(localDbStr) })
            });
            if (syncData && syncData.db) {
              localStorage.setItem('homestay_db', JSON.stringify(syncData.db));
              console.log('[Auth & Sync] Database synchronization completed.');
            }
          } catch (syncErr) {
            console.error('[Auth & Sync] Non-blocking database sync warning:', syncErr);
          }
        }

        // Verify the operator token against the database
        const data = await safeFetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log(`[Auth & Sync] Session verified successfully. User ID: "${data.user.id}", Role: "${data.user.role}"`);
        setUser(data.user);
        localStorage.setItem('hs_user', JSON.stringify(data.user));
      } catch (err: any) {
        const msg = err?.message || '';
        // Only force logout on explicit authentication failures (401/403)
        // Network errors, timeouts, and server startup errors (Render cold start)
        // should NOT log the user out — we keep the cached session alive.
        const isAuthError = 
          msg.includes('401') ||
          msg.includes('403') ||
          msg.includes('Access denied') ||
          msg.includes('Invalid or expired token') ||
          msg.includes('session expired');

        if (isAuthError) {
          console.error('[Auth & Sync] Token rejected by server. Logging out...', err);
          handleLogout();
        } else {
          // Network error / server waking up — keep the user logged in
          console.warn('[Auth & Sync] Could not verify session (server may be waking up). Keeping cached session.', msg);
          // Use cached user data from localStorage
          const saved = localStorage.getItem('hs_user');
          if (saved) {
            try { setUser(JSON.parse(saved)); } catch (_) {}
          }
        }
      } finally {
        setCheckingAuth(false);
      }
    };

    verifySessionAndRestoreDB();
  }, [token]);

  // ---------------- AUTH HANDLERS ----------------
  const handleLoginSuccess = async (newToken: string, newUser: any) => {
    localStorage.setItem('hs_token', newToken);
    localStorage.setItem('hs_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setActiveTab('dashboard');

    // Immediately fetch and backup the server-side database upon login
    try {
      console.log('[Login Sync] Saving database state to local storage...');
      const syncData = await safeFetch('/api/sync', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      if (syncData && syncData.db) {
        localStorage.setItem('homestay_db', JSON.stringify(syncData.db));
        console.log('[Login Sync] Local database backup saved.');
      }
    } catch (err) {
      console.error('[Login Sync] Local database backup warning:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsSuccess('');

    const body: any = {
      fullName: profileFullName,
      phone: profilePhone,
      profile_image: profileImage
    };

    if (newPassword || currentPassword || confirmPassword) {
      if (!currentPassword) {
        setSettingsError(lang === 'en' ? 'Current password is required to save changes.' : 'మార్పులను సేవ్ చేయడానికి ప్రస్తుత పాస్‌వర్డ్ అవసరం.');
        return;
      }

      const strengthError = checkPasswordStrength(newPassword);
      if (strengthError) {
        setSettingsError(strengthError);
        return;
      }

      if (newPassword !== confirmPassword) {
        setSettingsError(lang === 'en' ? 'New passwords do not match.' : 'కొత్త పాస్‌వర్డ్‌లు సరిపోలడం లేదు.');
        return;
      }

      body.password = newPassword;
      body.currentPassword = currentPassword;
    }

    setSettingsLoading(true);

    try {
      const data = await safeFetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      setSettingsSuccess(lang === 'en' ? 'Profile and security settings updated successfully!' : 'ప్రొఫైల్ మరియు సెక్యూరిటీ సెట్టింగ్‌లు విజయవంతంగా నవీకరించబడ్డాయి!');
      
      if (data.token && data.user) {
        localStorage.setItem('hs_token', data.token);
        localStorage.setItem('hs_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);

        // Update user record inside local database backup in local storage
        const localDbStr = localStorage.getItem('homestay_db');
        if (localDbStr) {
          try {
            const localDb = JSON.parse(localDbStr);
            if (localDb && Array.isArray(localDb.users)) {
              const uIdx = localDb.users.findIndex((u: any) => u.id === data.user.id);
              if (uIdx !== -1) {
                // Keep password if it existed, but merge other fields from data.user
                localDb.users[uIdx] = {
                  ...localDb.users[uIdx],
                  ...data.user
                };
              } else {
                localDb.users.push(data.user);
              }
              localStorage.setItem('homestay_db', JSON.stringify(localDb));
              console.log('[Profile Update] Local storage homestay_db backup synchronized with new user profile.');
            }
          } catch (err) {
            console.error('[Profile Update] Failed to update homestay_db backup in local storage:', err);
          }
        }
      }

      // Clear password fields only
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err.message || (lang === 'en' ? 'Network error. Please try again.' : 'నెట్‌వర్క్ లోపం. దయచేసి మళ్ళీ ప్రయత్నించండి.'));
    } finally {
      setSettingsLoading(false);
    }
  };

  // Pre-load guests on mount or token changes for printable register list convenience
  const fetchSharedGuests = async () => {
    if (!token) return;
    try {
      const data = await safeFetch('/api/guests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllGuests(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSharedGuests();
  }, [token, activeTab]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans">
        {!serverReady && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
            <span>🚀 Server is waking up from sleep — this takes ~20 seconds on first visit. Please wait...</span>
          </div>
        )}
        <div className="space-y-4 text-center mt-8">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-500 font-medium animate-pulse">
            {lang === 'en' ? 'Verifying session & syncing database...' : 'సెషన్‌ని ధృవీకరిస్తోంది & డేటాబేస్‌ను సమకాలీకరిస్తోంది...'}
          </p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <>
        {!serverReady && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
            <span>🚀 Server is waking up — first visit takes ~20 seconds. Please wait before logging in...</span>
          </div>
        )}
        {serverReady && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-500 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-lg animate-pulse" style={{animationDuration:'1s', animationIterationCount: 3}}>
            <span>✅ Server is ready! You can now log in.</span>
          </div>
        )}
        <LoginView onLoginSuccess={handleLoginSuccess} lang={lang} setLang={setLang} />
      </>
    );
  }

  // Handle Forced Password Reset flow
  if (user && (user as any).forcePasswordReset) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 font-sans flex flex-col items-center justify-center p-4 relative">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
        
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-4 animate-pulse">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">Password Reset Required</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              An administrator has requested that you change your password. You must set a strong new password to secure your operator session and access Homestay OS.
            </p>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            setSettingsError('');
            setSettingsSuccess('');
            
            if (!newPassword || !confirmPassword) {
              setSettingsError('All fields are required.');
              return;
            }
            const strengthError = checkPasswordStrength(newPassword);
            if (strengthError) {
              setSettingsError(strengthError);
              return;
            }
            if (newPassword !== confirmPassword) {
              setSettingsError('Passwords do not match.');
              return;
            }

            setSettingsLoading(true);
            try {
              const res = await fetch('/api/auth/force-reset-password', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password: newPassword, confirmPassword })
              });
              const data = await res.json();
              if (res.ok && data.success) {
                setSettingsSuccess('Password updated successfully! Redirecting you...');
                localStorage.setItem('hs_user', JSON.stringify(data.user));
                setUser(data.user);
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => {
                  setSettingsSuccess('');
                }, 2000);
              } else {
                setSettingsError(data.error || 'Password update failed.');
              }
            } catch (err: any) {
              setSettingsError(err.message || 'Network error.');
            } finally {
              setSettingsLoading(false);
            }
          }} className="space-y-4">
            {settingsSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{settingsSuccess}</span>
              </div>
            )}
            
            {settingsError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{settingsError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">New Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters, with capital, digit & symbol"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-white text-black border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all font-sans font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 inset-y-0 text-slate-400 hover:text-slate-600 flex items-center transition-all cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-white text-black border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all font-sans font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 inset-y-0 text-slate-400 hover:text-slate-600 flex items-center transition-all cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={settingsLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{settingsLoading ? 'Updating Password...' : 'Save and Continue'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out / Cancel</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Handle Printable Register full screen layout
  if (showPrintRegister) {
    return (
      <PrintRegisterView 
        guests={allGuests} 
        onBack={() => setShowPrintRegister(false)} 
        lang={lang} 
      />
    );
  }

  // Sidebar navigation menu options
  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'guests', label: t.guests, icon: Users },
    { id: 'bookings', label: t.bookings, icon: Calendar },
    { id: 'visitors', label: t.visitorLog, icon: Clipboard },
    { id: 'billing', label: t.billing, icon: CreditCard },
    { id: 'rooms', label: t.rooms, icon: Hotel },
    { id: 'reports', label: t.reports, icon: FileBarChart },
    { id: 'audit', label: t.auditLogs, icon: Shield },
    ...(user.role === 'admin' ? [
      { id: 'recycle', label: lang === 'en' ? 'Recycle Bin' : 'రీసైకిల్ బిన్', icon: Trash2 }
    ] : [])
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col md:flex-row relative">
      
      {/* Decorative Blur Blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>

      {/* ---------------- MOBILE HEADER BAR ---------------- */}
      <header className="md:hidden flex justify-between items-center bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-40">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="font-serif text-md font-bold text-white">H</span>
          </div>
          <span className="font-sans font-bold text-slate-100 text-sm tracking-wide">{t.appName}</span>
        </div>
        <div className="flex items-center space-x-2">
          {user && (
            <button
              onClick={() => {
                setSettingsError('');
                setSettingsSuccess('');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setNewUsername(user.username || '');
                setProfileFullName(user.fullName || '');
                setProfilePhone(user.phone || '');
                setProfileImage(user.profile_image || '');
                setProfileEmail(user.email || '');
                setShowSettingsModal(true);
              }}
              className="w-7 h-7 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-bold shrink-0 cursor-pointer hover:border-blue-500 transition-all mr-1"
              title="Profile & Settings"
            >
              {user.profile_image ? (
                <img src={user.profile_image} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                user.fullName.substring(0, 1).toUpperCase()
              )}
            </button>
          )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-400"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ---------------- SIDEBAR (DESKTOP & MOBILE SIDE BAR) ---------------- */}
      <aside className={`
        fixed md:static inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800/80 p-5 flex flex-col justify-between z-50 transition-transform duration-300 md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-6">
          
          {/* Logo & Close button for mobile menu */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/10">
                <span className="font-serif text-lg font-bold text-white">H</span>
              </div>
              <span className="font-sans font-bold tracking-wide text-slate-100 text-sm">{t.appName}</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1 bg-slate-950 border border-slate-800 rounded text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User profile capsule */}
          <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-slate-400 font-bold border border-slate-700 shrink-0">
                {user.profile_image ? (
                  <img src={user.profile_image} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  user.fullName.substring(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-200 truncate">{user.fullName}</div>
                <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md mt-1">
                  {user.role === 'admin' ? t.admin : t.viewer}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => {
                setSettingsError('');
                setSettingsSuccess('');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setNewUsername(user?.username || '');
                setProfileFullName(user?.fullName || '');
                setProfilePhone(user?.phone || '');
                setProfileImage(user?.profile_image || '');
                setProfileEmail(user?.email || '');
                setShowSettingsModal(true);
              }}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
              title={lang === 'en' ? 'Settings & Profile' : 'సెట్టింగులు & ప్రొఫైల్'}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all
                    ${activeTab === item.id 
                      ? 'bg-blue-600 text-white shadow shadow-blue-600/10 font-bold' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}
                  `}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer (Language switch, print register and Log out) */}
        <div className="space-y-4 pt-5 border-t border-slate-800/80">
          
          {/* Print official register button */}
          <button
            id="nav-print-register-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              setShowPrintRegister(true);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg text-[10px] font-mono uppercase font-bold text-slate-400 hover:text-white transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-blue-500" />
            <span>Official Register</span>
          </button>

          {/* Language & Theme selection block */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
              <button
                onClick={() => setLang('en')}
                className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${lang === 'en' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                English
              </button>
              <button
                onClick={() => setLang('te')}
                className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${lang === 'te' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                తెలుగు
              </button>
            </div>
            
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-400 hover:text-white transition-all cursor-pointer shadow-inner"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>

          {/* Logout Trigger */}
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-950/20 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* ---------------- MAIN VIEWPORT WINDOW ---------------- */}
      <main className="flex-1 p-6 md:p-8 overflow-x-hidden min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Active component selector */}
          {activeTab === 'dashboard' && <DashboardView lang={lang} token={token} />}
          {activeTab === 'guests' && <GuestsView lang={lang} token={token} role={user.role} />}
          {activeTab === 'bookings' && <BookingsView lang={lang} token={token} role={user.role} />}
          {activeTab === 'visitors' && <VisitorLogView lang={lang} token={token} role={user.role} />}
          {activeTab === 'billing' && <BillingView lang={lang} token={token} role={user.role} />}
          {activeTab === 'rooms' && <RoomsView lang={lang} token={token} role={user.role} />}
          {activeTab === 'audit' && <AuditView lang={lang} token={token} />}
          {activeTab === 'recycle' && <RecycleBinView lang={lang} token={token} role={user.role} />}
          
          {activeTab === 'reports' && (
            <div className="space-y-8">
              <ReportsView lang={lang} token={token} />
              
              {/* Backups component nested cleanly inside reports for central accounting */}
              <BackupView lang={lang} token={token} role={user.role} username={user.username} />
            </div>
          )}

        </div>
      </main>

      {/* ---------------- SETTINGS & USER PROFILE MODAL ---------------- */}
      {showSettingsModal && (
        <div 
          onClick={() => setShowSettingsModal(false)} 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-8 animate-scaleUp"
          >
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400">
                  <Settings className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-sans font-bold tracking-wide">
                    {lang === 'en' ? 'My Profile & Settings' : 'నా ప్రొఫైల్ & సెట్టింగ్‌లు'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {lang === 'en' ? 'Manage your operator profile details and account security' : 'మీ ప్రొఫైల్ వివరాలు మరియు ఖాతా భద్రతను నిర్వహించండి'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
              
              {/* Success Alert */}
              {settingsSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span className="font-semibold">{settingsSuccess}</span>
                </div>
              )}

              {/* Error Alert */}
              {settingsError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex items-start gap-2.5">
                  <X className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="font-semibold">{settingsError}</span>
                </div>
              )}

              {/* PROFILE IMAGE AVATAR UPLOAD BLOCK */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-500 bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-2xl shrink-0">
                    {profileImage ? (
                      <img src={profileImage} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      profileFullName.substring(0, 1).toUpperCase() || 'H'
                    )}
                  </div>
                  <label htmlFor="avatar-file-input" className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1.5 rounded-full shadow-md cursor-pointer hover:bg-blue-700 transition-all border border-white">
                    <Camera className="w-3.5 h-3.5" />
                    <input 
                      id="avatar-file-input"
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSettingsError('');
                          compressImageAndSet(
                            file, 
                            (base64) => setProfileImage(base64),
                            (err) => setSettingsError(err),
                            lang
                          );
                        }
                      }}
                      className="hidden" 
                    />
                  </label>
                </div>
                
                <div className="text-center sm:text-left space-y-1">
                  <h4 className="text-xs font-bold text-slate-800">
                    {lang === 'en' ? 'Operator Avatar / Picture' : 'ఆపరేటర్ అవతార్ / చిత్రం'}
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {lang === 'en' ? 'Click the camera button to upload your brand image.' : 'మీ బ్రాండ్ ఇమేజ్‌ను అప్‌లోడ్ చేయడానికి కెమెరా బటన్‌ను క్లిక్ చేయండి.'}
                  </p>
                  {profileImage && (
                    <button
                      type="button"
                      onClick={() => setProfileImage('')}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer transition-all pt-1 block"
                    >
                      {lang === 'en' ? 'Remove Picture' : 'చిత్రాన్ని తీసివేయి'}
                    </button>
                  )}
                </div>
              </div>

              {/* CORE FIELDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'en' ? 'Full Name' : 'పూర్తి పేరు'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      required
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs transition-all outline-none font-medium"
                      placeholder="e.g. Mahesh Kumar"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'en' ? 'Mobile Number' : 'మొబైల్ సంఖ్య'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs transition-all outline-none font-medium"
                      placeholder="e.g. +91 95538 88649"
                    />
                  </div>
                </div>

                {/* Email Address (Read-only ID) */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {lang === 'en' ? 'Email Address (Registered Account Identity)' : 'ఇమెయిల్ చిరునామా (నమోదిత ఖాతా గుర్తింపు)'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={profileEmail}
                      disabled
                      className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-mono outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

              </div>

              {/* SECURITY: OPTIONAL PASSWORD REWRITE */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {lang === 'en' ? 'Change Security Password (Optional)' : 'భద్రతా పాస్‌వర్డ్‌ని మార్చండి (ఐచ్ఛికం)'}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {lang === 'en' ? 'Fill these fields only if you want to set a new password.' : 'మీరు కొత్త పాస్‌వర్డ్‌ను సెట్ చేయాలనుకుంటే మాత్రమే ఈ ఫీల్డ్‌లను పూరించండి.'}
                  </p>
                </div>

                {/* Current Password */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === 'en' ? 'Current Password' : 'ప్రస్తుత పాస్‌వర్డ్'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-white text-black border border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs transition-all outline-none font-semibold"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {lang === 'en' ? 'New Password' : 'కొత్త పాస్‌వర్డ్'}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 bg-white text-black border border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs transition-all outline-none font-semibold"
                        placeholder="Min 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {lang === 'en' ? 'Confirm New Password' : 'కొత్త పాస్‌వర్డ్‌ని నిర్ధారించండి'}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 bg-white text-black border border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs transition-all outline-none font-semibold"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all border border-slate-200"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  {settingsLoading 
                    ? (lang === 'en' ? 'Saving...' : 'సేవ్ అవుతోంది...') 
                    : (lang === 'en' ? 'Save Profile' : 'ప్రొఫైల్ సేవ్ చేయి')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
