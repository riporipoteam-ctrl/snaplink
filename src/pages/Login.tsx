import React, { useState, useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { Avatar } from '../components/ui/Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Mail, Lock, ArrowRight, UserPlus } from 'lucide-react';

export function Login() {
  const { currentUser, userProfile, signInWithGoogle } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);
  const [inviter, setInviter] = useState<{ displayName: string; photoURL?: string; username: string } | null>(null);

  // Extract invite/return/token info from URL
  const returnTo = searchParams.get('returnTo');
  const inviteUserId = searchParams.get('invite');
  const loginToken = searchParams.get('token');

  // Auto-login via token
  useEffect(() => {
    if (!loginToken || currentUser) return;
    setAutoLogging(true);
    const autoLogin = async () => {
      try {
        const tokenDoc = await getDoc(doc(db, 'login_tokens', loginToken));
        if (tokenDoc.exists()) {
          const data = tokenDoc.data();
          await signInWithEmailAndPassword(auth, data.email, data.password);
          // Auth state change will handle redirect
        } else {
          setError('This login link is invalid or has expired.');
          setAutoLogging(false);
        }
      } catch (err: any) {
        console.error('Auto-login failed:', err);
        setError('Login link failed. Please sign in manually.');
        setAutoLogging(false);
      }
    };
    autoLogin();
  }, [loginToken, currentUser]);

  // Fetch inviter profile if invite param exists
  useEffect(() => {
    if (!inviteUserId) return;
    const fetchInviter = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', inviteUserId));
        if (snap.exists()) {
          const data = snap.data();
          setInviter({ displayName: data.displayName, photoURL: data.photoURL, username: data.username });
        }
      } catch { /* silent */ }
    };
    fetchInviter();
  }, [inviteUserId]);

  if (currentUser) {
    if (userProfile) {
      // Redirect to invite profile, returnTo path, or home
      const destination = inviteUserId ? `/profile/${inviteUserId}` : returnTo || '/';
      return <Navigate to={destination} replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Show loading screen while auto-logging in via token
  if (autoLogging) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border border-white/50 dark:border-gray-700/50 p-8 rounded-[2.5rem] shadow-2xl text-center"
        >
          <Logo showText className="justify-center mb-6" />
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Logging you in...</p>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-red-500 text-sm font-medium">
              {error}
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found') setError('No account found with this email.');
      else if (code === 'auth/wrong-password') setError('Incorrect password.');
      else if (code === 'auth/email-already-in-use') setError('This email is already registered.');
      else if (code === 'auth/weak-password') setError('Password must be at least 6 characters.');
      else if (code === 'auth/invalid-email') setError('Please enter a valid email address.');
      else setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-blocked') {
        setError('Popup was blocked. Redirecting to Google sign-in...');
      } else if (code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google sign-in. Please use email/password instead.');
      } else {
        setError(err.message || 'Google sign-in failed. Try email/password instead.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 overflow-hidden relative selection:bg-blue-500/30">
      {/* Animated Background Orbs */}
      <motion.div 
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400/20 blur-[100px]"
        animate={{ x: [0, 30, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-400/20 blur-[120px]"
        animate={{ x: [0, -20, 0], y: [0, 20, 0], scale: [1, 0.9, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div 
        className="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] rounded-full bg-pink-400/20 blur-[150px]"
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* Main Container — slightly smaller */}
      <div className="relative w-full max-w-md mx-4">
        {/* Invite Banner */}
        {inviter && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center space-x-3 shadow-lg"
          >
            <Avatar src={inviter.photoURL} alt={inviter.displayName} className="h-12 w-12" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                <UserPlus className="h-4 w-4 mr-1 text-blue-500" /> Invited by
              </p>
              <p className="font-bold text-blue-600 dark:text-blue-400 truncate">{inviter.displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">@{inviter.username}</p>
            </div>
          </motion.div>
        )}
        <AnimatePresence mode="wait">
          {mode === 'welcome' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border border-white/50 dark:border-gray-700/50 p-8 rounded-[2.5rem] shadow-2xl text-center relative overflow-hidden"
            >
              {/* Animated logo */}
              <div className="mb-6">
                <Logo showText className="justify-center" />
              </div>

              <h2 className="text-3xl font-black bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
                Happening now
              </h2>
              <p className="mt-2 text-lg font-medium text-gray-500 dark:text-gray-400 mb-8">Join the conversation.</p>
              
              <div className="space-y-3">
                <Button 
                  onClick={handleGoogleSignIn} 
                  disabled={loading}
                  className="w-full h-13 text-base bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-all rounded-2xl font-medium group" 
                >
                  <svg className="mr-3 h-5 w-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-md px-4 text-gray-500 font-medium rounded-full">or</span>
                  </div>
                </div>

                <Button 
                  onClick={() => setMode('signup')} 
                  className="w-full h-13 text-base bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-xl shadow-purple-500/20 transition-all rounded-2xl group flex items-center justify-center font-medium"
                >
                  Create account
                  <ArrowRight className="ml-2 h-5 w-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-600 dark:text-red-400 text-sm font-medium text-center bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-xl"
                  >
                    {error}
                  </motion.div>
                )}
                
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-6 pt-3">
                  Already have an account?{' '}
                  <button onClick={() => setMode('login')} className="text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    Sign in
                  </button>
                </p>
                <Link
                  to="/install"
                  className="mt-3 inline-flex items-center justify-center rounded-full border border-blue-200/80 bg-blue-50/80 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200"
                >
                  Install SnapLink on iPhone
                </Link>
              </div>
            </motion.div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border border-white/50 dark:border-gray-700/50 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
            >
              <div className="text-center mb-8">
                <button 
                  onClick={() => { setMode('welcome'); setError(''); }} 
                  className="absolute left-6 top-6 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 rounded-full transition-all"
                >
                  ←
                </button>
                <Logo className="mx-auto h-10 w-10 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {mode === 'login' ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                  {mode === 'login' ? 'Enter your details to sign in.' : 'Fill in the details to get started.'}
                </p>
              </div>
              
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-600 dark:text-red-400 text-sm font-medium text-center bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-xl">
                    {error}
                  </motion.div>
                )}
                
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    className="w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 font-medium dark:text-white"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    className="w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 font-medium dark:text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-13 mt-4 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-500/20 transition-all rounded-xl font-medium"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Please wait...</span>
                    </div>
                  ) : mode === 'login' ? 'Sign in' : 'Sign up'}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Branding */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-600">Made by <span className="font-semibold">Ripo Team</span></p>
      </div>
    </div>
  );
}
