
import React, { useState } from 'react';
import { ChevronLeft, Layers, Mail, Lock, Eye, ArrowRight, ShieldCheck } from 'lucide-react';

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

const Auth: React.FC<Props> = ({ onBack, onComplete }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] p-8 overflow-y-auto no-scrollbar">
      <button onClick={onBack} className="p-2 -ml-4 self-start text-gray-700"><ChevronLeft size={24} /></button>

      <div className="flex-1 flex flex-col justify-center max-w-[320px] mx-auto w-full">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-100 mx-auto">
          <Layers className="text-white" size={32} />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{mode === 'signin' ? 'Welcome Back' : 'Join the Network'}</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            {mode === 'signin' 
              ? 'Access the African Data Layer portal for infrastructure and pricing.'
              : 'Create an account to contribute data and earn EXP rewards.'}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Email Address</label>
            <div className="relative group">
               <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
               <input 
                 type="email" 
                 placeholder="name@email.com"
                 className="w-full h-14 bg-white border border-gray-100 rounded-xl pl-12 pr-4 text-sm focus:border-blue-600 focus:outline-none transition-all shadow-sm"
               />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
               {mode === 'signin' && <button className="text-[10px] font-bold text-blue-600 uppercase">Forgot?</button>}
            </div>
            <div className="relative group">
               <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
               <input 
                 type="password" 
                 placeholder="Min. 8 characters"
                 className="w-full h-14 bg-white border border-gray-100 rounded-xl pl-12 pr-12 text-sm focus:border-blue-600 focus:outline-none transition-all shadow-sm"
               />
               <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><Eye size={18} /></button>
            </div>
          </div>

          <button
            onClick={onComplete}
            className="w-full h-14 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="mt-8 text-center flex flex-col space-y-6 items-center">
          <div className="flex items-center space-x-2 text-gray-400">
             <ShieldCheck size={12} />
             <span className="text-[10px] font-bold uppercase tracking-widest">Secure Encrypted Login</span>
          </div>
          
          <p className="text-xs text-gray-500">
            {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-blue-600 font-bold hover:underline"
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
