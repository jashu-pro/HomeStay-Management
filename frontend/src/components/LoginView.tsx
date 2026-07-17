import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { 
  LogIn, Shield, Eye, EyeOff, UserPlus, HelpCircle, Mail, Phone, Lock, 
  Check, Key, Inbox, ArrowLeft, RefreshCw, Trash2, CheckCircle, AlertCircle, User, Sun, Moon
} from 'lucide-react';
import { safeFetch } from '../lib/api';

interface LoginViewProps {
  onLoginSuccess: (
    token: string, 
    user: { 
      id: string; 
      username: string; 
      role: 'admin' | 'viewer'; 
      fullName: string;
      email?: string;
      phone?: string;
      profile_image?: string;
      email_verified?: boolean;
    }
  ) => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  token?: string;
  timestamp: string;
}

export default function LoginView({ onLoginSuccess, lang, setLang }: LoginViewProps) {
  const t = translations[lang];

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
  
  // View states: 'login' | 'signup' | 'forgot' | 'reset' | 'verify'
  const [view, setView] = useState<'login' | 'signup' | 'forgot' | 'reset' | 'verify'>('login');
  
  // Form submission and UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 1. LOGIN STATES
  const [loginEmail, setLoginEmail] = useState(() => localStorage.getItem('remember_email') || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('remember_email'));

  // 2. SIGNUP STATES
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState("What is your mother's first name?");
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [signupAcceptTerms, setSignupAcceptTerms] = useState(false);

  // 3. FORGOT PASSWORD STATES
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [fetchedQuestion, setFetchedQuestion] = useState('');
  const [securityAnswerInput, setSecurityAnswerInput] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showNewPasswordForgot, setShowNewPasswordForgot] = useState(false);
  const [showConfirmPasswordForgot, setShowConfirmPasswordForgot] = useState(false);

  // 4. RESET PASSWORD STATES
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // 5. EMAIL VERIFICATION STATES
  const [verifyToken, setVerifyToken] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  // 6. SIMULATED EMAIL LIST STATE
  const [simulatedEmails, setSimulatedEmails] = useState<SimulatedEmail[]>([]);
  const [showEmailSandbox, setShowEmailSandbox] = useState(() => {
    // Completely disable simulated email sandbox widget in production
    return !(import.meta as any).env?.PROD;
  });

  // Prefill email if URL parameters exist (e.g. simulated link clicks)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const resetParam = window.location.pathname.includes('reset') || params.has('reset');
    
    if (tokenParam) {
      if (resetParam) {
        setResetToken(tokenParam);
        setView('reset');
      } else {
        setVerifyToken(tokenParam);
        setView('verify');
      }
    }
  }, []);

  // Poll simulated emails
  const fetchSimulatedEmails = async () => {
    try {
      const data = await safeFetch('/api/simulated-emails');
      setSimulatedEmails(data);
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('starting up') || errMsg.includes('invalid data format') || errMsg.includes('offline or unreachable')) {
        console.warn('Simulated emails fetch deferred: server is currently starting up or unreachable.');
      } else {
        console.error('Error fetching simulated emails:', err);
      }
    }
  };

  useEffect(() => {
    if (!showEmailSandbox) return;
    fetchSimulatedEmails();
    const interval = setInterval(fetchSimulatedEmails, 3000);
    return () => clearInterval(interval);
  }, [showEmailSandbox]);

  // Validation: Email format helper
  const isEmailValid = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  // Validation: Password complexity helper
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

  // HANDLER: LOGIN SUBMIT
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!loginEmail || !loginPassword) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await safeFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      // Handle Remember Me
      if (rememberMe) {
        localStorage.setItem('remember_email', loginEmail);
      } else {
        localStorage.removeItem('remember_email');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.toLowerCase().includes('verify')) {
        setUnverifiedEmail(loginEmail);
        setError('Your email is unverified. Please enter the verification token sent to your inbox.');
        setView('verify');
      } else {
        setError(err.message || 'Login credentials rejected.');
      }
    } finally {
      setLoading(false);
    }
  };

  // HANDLER: SIGNUP SUBMIT
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!signupName || !signupEmail || !signupUsername || !signupPassword || !signupConfirmPassword || !securityQuestion || !securityAnswer) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!isEmailValid(signupEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (signupUsername.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    const strengthError = checkPasswordStrength(signupPassword);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!signupAcceptTerms) {
      setError('You must accept the terms & conditions to sign up.');
      return;
    }

    setLoading(true);
    try {
      const data = await safeFetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: signupName,
          email: signupEmail,
          username: signupUsername,
          phone: signupPhone,
          password: signupPassword,
          confirmPassword: signupConfirmPassword,
          securityQuestion,
          securityAnswer,
          acceptTerms: signupAcceptTerms
        })
      });

      setSuccess('Account created successfully. You can now sign in.');
      setLoginEmail(signupUsername);
      setSignupName('');
      setSignupEmail('');
      setSignupUsername('');
      setSignupPhone('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      setSecurityAnswer('');
      setSignupAcceptTerms(false);
      setView('login');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLER: FORGOT PASSWORD - STEP 1 (GET SECURITY QUESTION)
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!forgotIdentifier) {
      setError('Please enter your registered email address or username.');
      return;
    }

    setLoading(true);
    try {
      const data = await safeFetch('/api/forgot-password/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier })
      });

      setFetchedQuestion(data.securityQuestion);
      setForgotStep(2);
    } catch (err: any) {
      setError(err.message || 'Verification request failed.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLER: FORGOT PASSWORD - STEP 2 (VERIFY ANSWER & RESET PASSWORD)
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!securityAnswerInput || !forgotNewPassword || !forgotConfirmPassword) {
      setError('All fields are required.');
      return;
    }

    const strengthError = checkPasswordStrength(forgotNewPassword);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await safeFetch('/api/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotIdentifier,
          securityAnswer: securityAnswerInput,
          password: forgotNewPassword,
          confirmPassword: forgotConfirmPassword
        })
      });

      setSuccess('Password updated successfully! You can now log in.');
      setLoginEmail(forgotIdentifier);
      setForgotIdentifier('');
      setFetchedQuestion('');
      setSecurityAnswerInput('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setForgotStep(1);
      setTimeout(() => {
        setView('login');
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLER: RESET PASSWORD SUBMIT
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetToken || !resetPassword || !resetConfirmPassword) {
      setError('All fields are required.');
      return;
    }

    const strengthError = checkPasswordStrength(resetPassword);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await safeFetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          password: resetPassword,
          confirmPassword: resetConfirmPassword
        })
      });

      setSuccess('Password has been reset successfully! You can now log in.');
      setView('login');
      setResetToken('');
      setResetPassword('');
      setResetConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLER: MANUAL EMAIL VERIFICATION SUBMIT
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!verifyToken) {
      setError('Please enter the verification token.');
      return;
    }

    setLoading(true);
    try {
      await safeFetch(`/api/verify-email?token=${verifyToken}`, { method: 'POST' });
      setSuccess('Email verified successfully! You can now log in.');
      setView('login');
      setVerifyToken('');
      setUnverifiedEmail('');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please double check your token.');
    } finally {
      setLoading(false);
    }
  };

  // Action: Automated verification click from Sandbox email list
  const handleVerifyFromEmailList = async (token: string) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await safeFetch(`/api/verify-email?token=${token}`, { method: 'POST' });
      setSuccess('Email verified successfully! You are now logged in / ready to log in.');
      setView('login');
      setVerifyToken('');
      fetchSimulatedEmails();
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Action: Simulated email click for password reset
  const handleResetFromEmailList = (token: string) => {
    setError('');
    setSuccess('');
    setResetToken(token);
    setView('reset');
  };

  // Action: Clear simulated mail
  const handleClearSimulatedMail = async () => {
    try {
      await safeFetch('/api/simulated-emails/clear', { method: 'POST' });
      setSimulatedEmails([]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-12 transition-colors duration-300">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>

      {/* Header */}
      <header className="p-6 flex justify-between items-center w-full max-w-7xl mx-auto shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-serif text-xl font-bold text-white">H</span>
          </div>
          <span className="font-sans font-bold tracking-wide text-lg text-slate-900 dark:text-white">Homestay Register</span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer mr-2 shadow-sm"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Language:</span>
          <button 
            id="lang-en-btn"
            onClick={() => setLang('en')}
            className={`px-3 py-1 text-xs rounded transition-all font-semibold cursor-pointer ${lang === 'en' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
          >
            English
          </button>
          <button 
            id="lang-te-btn"
            onClick={() => setLang('te')}
            className={`px-3 py-1 text-xs rounded transition-all font-semibold cursor-pointer ${lang === 'te' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
          >
            తెలుగు
          </button>
        </div>
      </header>

      {/* Main Authentication Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 rounded-2xl shadow-xl relative transition-all duration-300">
          
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center shadow-lg">
            <Shield className="w-9 h-9 text-blue-600 animate-pulse" />
          </div>

          <div className="text-center mt-6 mb-6">
            <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-white tracking-tight">
              {view === 'login' && t.signInTitle}
              {view === 'signup' && t.signUpTitle}
              {view === 'forgot' && t.forgotTitle}
              {view === 'reset' && t.resetTitle}
              {view === 'verify' && t.verifyTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-sans px-2 leading-relaxed">
              {view === 'login' && t.signInSubtitle}
              {view === 'signup' && t.signUpSubtitle}
              {view === 'forgot' && t.forgotSubtitle}
              {view === 'reset' && t.resetSubtitle}
              {view === 'verify' && (lang === 'en' ? `Verification token sent to ${unverifiedEmail || 'your email'}. Check your email inbox.` : `ధృవీకరణ టోకెన్ ${unverifiedEmail || 'మీ ఇమెయిల్'}కు పంపబడింది. మీ ఇమెయిల్ ఇన్‌బాక్స్ తనిఖీ చేయండి.`)}
            </p>
          </div>

          {/* Success Alerts */}
          {success && (
            <div className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-400 text-xs rounded-lg flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{success}</span>
            </div>
          )}

          {/* Error Alerts */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-rose-800 dark:text-rose-400 text-xs rounded-lg flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* --- VIEW 1: LOGIN FORM --- */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.emailOrUsername}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="email-input"
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={t.emailOrUsernamePlaceholder}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase font-mono">{t.password}</label>
                  <button 
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-all"
                  >
                    {t.forgotPasswordLink}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 inset-y-0 text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 flex items-center transition-all cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 border-slate-300 dark:border-slate-700 rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-950 transition-all"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{t.rememberMe}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white py-3 rounded-lg text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 mt-3 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? t.signingIn : t.signInBtn}</span>
              </button>

              <div className="text-center pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
                <span className="text-xs text-slate-500 dark:text-slate-400">{t.noAccount} </span>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccess('');
                    setView('signup');
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  {t.createAccountLink}
                </button>
              </div>
            </form>
          )}

          {/* --- VIEW 2: SIGNUP FORM --- */}
          {view === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.fullName}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder={t.fullNamePlaceholder}
                    required
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.emailAddress}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    required
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.username}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    placeholder={t.usernamePlaceholder}
                    required
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.phoneNumber} <span className="text-slate-400 dark:text-slate-550 font-normal lowercase">({t.optional})</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.securityQuestion}</label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-medium"
                >
                  <option value="What is your mother's first name?">{lang === 'en' ? "What is your mother's first name?" : "మీ తల్లి మొదటి పేరు ఏమిటి?"}</option>
                  <option value="What was your first school?">{lang === 'en' ? "What was your first school?" : "మీ మొదటి పాఠశాల ఏది?"}</option>
                  <option value="What is your favourite food?">{lang === 'en' ? "What is your favourite food?" : "మీకు ఇష్టమైన ఆహారం ఏది?"}</option>
                  <option value="What is your favourite movie?">{lang === 'en' ? "What is your favourite movie?" : "మీకు ఇష్టమైన సినిమా ఏది?"}</option>
                  <option value="What is your childhood nickname?">{lang === 'en' ? "What is your childhood nickname?" : "మీ చిన్ననాటి మారుపేరు ఏమిటి?"}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.securityAnswer}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <HelpCircle className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder={t.securityAnswerPlaceholder}
                    required
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.password}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder={t.passwordAtLeast}
                    required
                    className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 inset-y-0 text-slate-400 dark:text-slate-555 hover:text-slate-600 dark:hover:text-slate-300 flex items-center transition-all cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.confirmPassword}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder={t.confirmPasswordPlaceholder}
                    required
                    className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 inset-y-0 text-slate-400 dark:text-slate-555 hover:text-slate-600 dark:hover:text-slate-300 flex items-center transition-all cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Accept Terms checkbox */}
              <div className="flex items-start gap-2.5 pt-1.5">
                <input
                  id="accept-terms-checkbox"
                  type="checkbox"
                  checked={signupAcceptTerms}
                  onChange={(e) => setSignupAcceptTerms(e.target.checked)}
                  className="w-4 h-4 border-slate-300 dark:border-slate-700 rounded text-blue-600 focus:ring-blue-500 transition-all mt-0.5"
                  required
                />
                <label htmlFor="accept-terms-checkbox" className="text-xs text-slate-600 dark:text-slate-400 leading-normal select-none">
                  {lang === 'en' ? (
                    <>I accept the <a href="#" className="text-blue-600 hover:underline font-semibold">Terms & Conditions</a> and consent to security logs.</>
                  ) : (
                    <>నేను <a href="#" className="text-blue-600 hover:underline font-semibold">నిబంధనలు & షరతులను</a> అంగీకరిస్తున్నాను మరియు సెక్యూరిటీ లాగ్‌లకు సమ్మతిస్తున్నాను.</>
                  )}
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? t.registering : t.createAccountLink}</span>
              </button>

              <div className="text-center pt-3 border-t border-slate-100 dark:border-slate-850 mt-4 flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccess('');
                    setView('login');
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-200 transition-all cursor-pointer"
                >
                  {t.backToSignIn}
                </button>
              </div>
            </form>
          )}

          {/* --- VIEW 3: FORGOT PASSWORD FORM (2-STEP SECURITY QUESTIONS) --- */}
          {view === 'forgot' && (
            <div className="space-y-4 animate-fadeIn">
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.emailOrUsername}</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder={lang === 'en' ? "Enter registered email address or username" : "నమోదిత ఇమెయిల్ చిరునామా లేదా వినియోగదారు పేరును నమోదు చేయండి"}
                        required
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>{loading ? t.verifyingAccount : t.getSecurityQuestion}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotResetSubmit} className="space-y-4">
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-lg">
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 font-mono uppercase tracking-wider font-bold">{t.securityQuestionTitle}</p>
                    <p className="text-xs font-sans font-bold text-slate-850 dark:text-slate-200 mt-1 leading-normal">
                      {fetchedQuestion === "What is your mother's first name?" ? (lang === 'en' ? fetchedQuestion : "మీ తల్లి మొదటి పేరు ఏమిటి?") :
                       fetchedQuestion === "What was your first school?" ? (lang === 'en' ? fetchedQuestion : "మీ మొదటి పాఠశాల ఏది?") :
                       fetchedQuestion === "What is your favourite food?" ? (lang === 'en' ? fetchedQuestion : "మీకు ఇష్టమైన ఆహారం ఏది?") :
                       fetchedQuestion === "What is your favourite movie?" ? (lang === 'en' ? fetchedQuestion : "మీకు ఇష్టమైన సినిమా ఏది?") :
                       fetchedQuestion === "What is your childhood nickname?" ? (lang === 'en' ? fetchedQuestion : "మీ చిన్ననాటి మారుపేరు ఏమిటి?") :
                       fetchedQuestion}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.yourAnswer}</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                        <HelpCircle className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={securityAnswerInput}
                        onChange={(e) => setSecurityAnswerInput(e.target.value)}
                        placeholder={t.caseInsensitivePlaceholder}
                        required
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.password}</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showNewPasswordForgot ? 'text' : 'password'}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder={t.min8CharsLabel}
                        required
                        className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPasswordForgot(!showNewPasswordForgot)}
                        className="absolute right-3 inset-y-0 text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 flex items-center transition-all cursor-pointer"
                      >
                        {showNewPasswordForgot ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.confirmNewPassword}</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showConfirmPasswordForgot ? 'text' : 'password'}
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        placeholder={t.confirmPasswordPlaceholder}
                        required
                        className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPasswordForgot(!showConfirmPasswordForgot)}
                        className="absolute right-3 inset-y-0 text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 flex items-center transition-all cursor-pointer"
                      >
                        {showConfirmPasswordForgot ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{loading ? t.resettingPassword : t.resetPasswordBtn}</span>
                  </button>
                </form>
              )}

              <div className="text-center pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccess('');
                    setForgotIdentifier('');
                    setFetchedQuestion('');
                    setSecurityAnswerInput('');
                    setForgotNewPassword('');
                    setForgotConfirmPassword('');
                    setForgotStep(1);
                    setView('login');
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-250 transition-all cursor-pointer"
                >
                  {t.backToSignIn}
                </button>
              </div>
            </div>
          )}

          {/* --- VIEW 4: RESET PASSWORD FORM --- */}
          {view === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.resetToken}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder={t.resetTokenPlaceholder}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.password}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder={t.min8CharsLabel}
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 inset-y-0 text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 flex items-center transition-all cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.confirmPassword}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder={lang === 'en' ? "Match new password" : "కొత్త పాస్‌వర్డ్‌ను సరిపోల్చండి"}
                    required
                    className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 inset-y-0 text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 flex items-center transition-all cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? t.saving : t.resetPasswordBtn}</span>
              </button>

              <div className="text-center pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccess('');
                    setView('login');
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-250 transition-all cursor-pointer"
                >
                  {t.backToSignIn}
                </button>
              </div>
            </form>
          )}

          {/* --- VIEW 5: EMAIL VERIFICATION FORM --- */}
          {view === 'verify' && (
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-lg text-[11px] text-slate-600 dark:text-blue-300 leading-relaxed font-medium">
                {lang === 'en' ? (
                  "🛡️ Account is locked until email is verified. Enter the code from the simulated mailbox below to authorize access."
                ) : (
                  "🛡️ ఇమెయిల్ ధృవీకరించబడే వరకు ఖాతా లాక్ చేయబడుతుంది. ప్రాప్యతను ప్రాధికారికం చేయడానికి దిగువ ఉన్న సిమ్యులేటెడ్ మెయిల్‌బాక్స్ నుండి కోడ్‌ను నమోదు చేయండి."
                )}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">{t.verifyTokenLabel}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    placeholder={t.verifyTokenPlaceholder}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? t.verifying : t.verifyEmailBtn}</span>
              </button>

              <div className="text-center pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccess('');
                    setView('login');
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-250 transition-all cursor-pointer"
                >
                  {t.backToSignIn}
                </button>
              </div>
            </form>
          )}

        </div>
      </main>

      {/* --- SIMULATED EMAIL SANDBOX WIDGET (GENIUS TESTING HELPER) --- */}
      {showEmailSandbox && (
        <section className="max-w-2xl mx-auto w-full px-4 mt-6 shrink-0 transition-all duration-300">
          <div className="bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800 overflow-hidden font-mono">
            
            {/* Widget Header */}
            <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
                <h4 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-amber-400">
                  <Inbox className="w-3.5 h-3.5" />
                  {t.sandboxHeader}
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={fetchSimulatedEmails}
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                  title={lang === 'en' ? "Refresh mail queue" : "మెయిల్ క్యూను రిఫ్రెష్ చేయండి"}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={handleClearSimulatedMail}
                  disabled={simulatedEmails.length === 0}
                  className="p-1.5 hover:bg-slate-800 disabled:opacity-30 rounded text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                  title={lang === 'en' ? "Clear mailbox logs" : "మెయిల్‌బాక్స్ లాగ్‌లను క్లియర్ చేయి"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Simulated Email List */}
            <div className="p-3 max-h-56 overflow-y-auto space-y-3 text-xs">
              {simulatedEmails.length === 0 ? (
                <div className="py-8 text-center text-slate-500 leading-relaxed text-[11px] whitespace-pre-line">
                  {t.sandboxEmpty}
                </div>
              ) : (
                simulatedEmails.map((mail) => (
                  <div key={mail.id} className="bg-slate-950/80 border border-slate-850 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between items-start border-b border-slate-900 pb-1.5 text-[10px]">
                      <div>
                        <span className="text-blue-400 font-bold">{t.sandboxTo} </span>
                        <span className="text-slate-300 font-semibold">{mail.to}</span>
                      </div>
                      <span className="text-slate-500 text-[9px]">{new Date(mail.timestamp).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className="text-[11px] font-bold text-amber-300">
                      {t.sandboxSubject} {mail.subject}
                    </div>
                    
                    <pre className="text-[10px] text-slate-400 whitespace-pre-wrap font-sans bg-slate-950 p-2 rounded border border-slate-900/60 leading-normal max-h-24 overflow-y-auto">
                      {mail.body}
                    </pre>

                    {/* Interactive Action Buttons */}
                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-900/80">
                      {mail.subject.includes('Verify') && mail.token && (
                        <button
                          onClick={() => handleVerifyFromEmailList(mail.token!)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-sans font-semibold rounded text-[10px] transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          {t.sandboxAutoVerify}
                        </button>
                      )}
                      {mail.subject.includes('Reset') && mail.token && (
                        <button
                          onClick={() => handleResetFromEmailList(mail.token!)}
                          className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-sans font-semibold rounded text-[10px] transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Key className="w-3 h-3" />
                          {t.sandboxAutoReset}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-slate-400 font-mono max-w-7xl mx-auto w-full shrink-0">
        {t.loginFooterText}
      </footer>
    </div>
  );
}
