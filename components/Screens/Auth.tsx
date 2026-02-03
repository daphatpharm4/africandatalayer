import React, { useState } from 'react';
import { ChevronLeft, Layers, Mail, Lock, Eye, ArrowRight, ShieldCheck } from 'lucide-react';
import { getSession, registerWithCredentials, signInWithCredentials, signInWithGoogle } from '../../lib/client/auth';

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

const Auth: React.FC<Props> = ({ onBack, onComplete }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (mode === 'signup') {
        await registerWithCredentials(normalizedEmail, password);
      }
      await signInWithCredentials(normalizedEmail, password);
      const session = await getSession();
      if (!session?.user) {
        throw new Error('Unable to start a session.');
      }
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      setErrorMessage(message.replace(/^Error:\s*/, ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] p-8 overflow-y-auto no-scrollbar">
      <button onClick={onBack} className="p-2 -ml-4 self-start text-gray-700"><ChevronLeft size={24} /></button>

      <div className="flex-1 flex flex-col justify-center max-w-[320px] mx-auto w-full">
        <div className="w-16 h-16 bg-[#0f2b46] rounded-2xl flex items-center justify-center mb-8 shadow-lg mx-auto">
          <Layers className="text-white" size={32} />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{mode === 'signin' ? 'Welcome Back' : 'Join the Network'}</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            {mode === 'signin'
              ? 'Access the African Data Layer portal for infrastructure and pricing.'
              : 'Create an account to contribute data and earn XP rewards.'}
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={() => signInWithGoogle()}
            className="w-full h-12 bg-white border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest text-[#0f2b46] shadow-sm hover:bg-gray-50 transition-all"
          >
            Continue with Google
          </button>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Email Address</label>
            <div className="relative group">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0f2b46] transition-colors" />
              <input
                type="email"
                placeholder="name@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full h-14 bg-white border border-gray-100 rounded-xl pl-12 pr-4 text-sm focus:border-[#0f2b46] focus:outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
              {mode === 'signin' && <button className="text-[10px] font-bold text-[#0f2b46] uppercase">Forgot?</button>}
            </div>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0f2b46] transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full h-14 bg-white border border-gray-100 rounded-xl pl-12 pr-12 text-sm focus:border-[#0f2b46] focus:outline-none transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <Eye size={18} />
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-14 bg-[#0f2b46] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-[#0b2236] active:scale-95 transition-all disabled:opacity-70"
          >
            <span>{isSubmitting ? 'Working...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight size={18} />
          </button>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-[10px] font-semibold uppercase tracking-widest text-red-600 text-center">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="mt-8 text-center flex flex-col space-y-6 items-center">
          <div className="flex items-center space-x-2 text-gray-400">
            <ShieldCheck size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Secure Encrypted Login</span>
          </div>

          <p className="text-xs text-gray-500">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setErrorMessage('');
              }}
              className="text-[#0f2b46] font-bold hover:underline"
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in instead'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
