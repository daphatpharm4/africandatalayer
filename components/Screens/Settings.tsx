
import React from 'react';
import { ArrowLeft, User, Shield, WifiOff, BarChart, Bell, Globe, Moon, LogOut, ChevronRight } from 'lucide-react';

interface Props {
  onBack: () => void;
  onLogout: () => void;
}

const Settings: React.FC<Props> = ({ onBack, onLogout }) => {
  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">Settings</h3>
        <div className="w-8"></div>
      </div>

      <div className="p-6 space-y-8">
        {/* Account Settings */}
        <div className="space-y-4">
           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">Account Settings</h4>
           <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={20} /></div>
                    <span className="text-sm font-bold text-gray-900">Profile Information</span>
                 </div>
                 <ChevronRight size={18} className="text-gray-300" />
              </button>
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Shield size={20} /></div>
                    <span className="text-sm font-bold text-gray-900">Security & Password</span>
                 </div>
                 <ChevronRight size={18} className="text-gray-300" />
              </button>
           </div>
        </div>

        {/* Data & Connectivity */}
        <div className="space-y-4">
           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">Data & Connectivity</h4>
           <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><WifiOff size={20} /></div>
                    <div className="flex flex-col">
                       <span className="text-sm font-bold text-gray-900">Offline Sync Settings</span>
                       <span className="text-[10px] text-gray-400 font-medium">Last synced: 2m ago</span>
                    </div>
                 </div>
                 <ChevronRight size={18} className="text-gray-300" />
              </button>
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><BarChart size={20} /></div>
                    <span className="text-sm font-bold text-gray-900">Data Usage & Limits</span>
                 </div>
                 <ChevronRight size={18} className="text-gray-300" />
              </button>
           </div>
        </div>

        {/* Preferences */}
        <div className="space-y-4">
           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">Preferences</h4>
           <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Bell size={20} /></div>
                    <span className="text-sm font-bold text-gray-900">Notifications</span>
                 </div>
                 <ChevronRight size={18} className="text-gray-300" />
              </button>
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Globe size={20} /></div>
                    <span className="text-sm font-bold text-gray-900">App Language</span>
                 </div>
                 <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400 font-medium">English</span>
                    <ChevronRight size={18} className="text-gray-300" />
                 </div>
              </button>
              <div className="w-full flex items-center justify-between p-4">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Moon size={20} /></div>
                    <span className="text-sm font-bold text-gray-900">Dark Appearance</span>
                 </div>
                 <div className="w-10 h-6 bg-gray-200 rounded-full relative shadow-inner">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"></div>
                 </div>
              </div>
           </div>
        </div>

        {/* Logout */}
        <div className="pt-4 flex flex-col items-center space-y-6">
           <button 
             onClick={onLogout}
             className="w-full h-14 bg-white text-red-600 border border-red-100 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-sm hover:bg-red-50 transition-all flex items-center justify-center space-x-2"
           >
              <span>Sign Out</span>
           </button>
           <div className="text-center">
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">African Data Layer v2.4.0 (Build 892)</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
