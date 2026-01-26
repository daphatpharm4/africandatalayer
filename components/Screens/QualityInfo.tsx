
import React from 'react';
import { ArrowLeft, ShieldCheck, CheckCircle2, UserCheck, Search, Database } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const QualityInfo: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">Data Quality & Trust</h3>
        <div className="w-8"></div>
      </div>

      <div className="p-6 space-y-8">
        <div className="space-y-4 text-center">
           <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck size={32} />
           </div>
           <h2 className="text-2xl font-bold text-gray-900 tracking-tight">How we ensure reliability</h2>
           <p className="text-sm text-gray-500 leading-relaxed px-4">
             Every data point on African Data Layer undergoes a multi-layered validation process to maintain institutional standards.
           </p>
        </div>

        <div className="space-y-4">
           {[
             { title: 'Community Verification', desc: 'New submissions are cross-referenced by nearby contributors in real-time.', icon: <Users size={20} /> },
             { title: 'Automated Integrity Checks', desc: 'AI-driven systems detect statistical outliers and potential fraud patterns.', icon: <Search size={20} /> },
             { title: 'Reputation Scoring', desc: 'Contributors build a history of trust. High-trust users carry more weight.', icon: <UserCheck size={20} /> },
             { title: 'Ground Truth Audits', desc: 'Random physical inspections by Senior Contributors ensure absolute accuracy.', icon: <Database size={20} /> }
           ].map((step, i) => (
             <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                   {step.icon}
                </div>
                <div className="flex flex-col space-y-1">
                   <h4 className="text-sm font-bold text-gray-900">{step.title}</h4>
                   <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
             </div>
           ))}
        </div>

        <div className="bg-blue-600 rounded-2xl p-6 text-white space-y-4 shadow-xl shadow-blue-100">
           <h4 className="text-xs font-bold uppercase tracking-widest">Our Sovereignty Principle</h4>
           <p className="text-sm leading-relaxed opacity-90">
             African data, stored and governed locally. We believe infrastructure intelligence should serve the people who build it.
           </p>
           <button className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30 transition-colors">
              Read Governance Framework
           </button>
        </div>

        <div className="h-24"></div>
      </div>
    </div>
  );
};

const Users = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

export default QualityInfo;
