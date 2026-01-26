
import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, XCircle, CheckCircle, MapPin, Camera, AlertTriangle, Eye } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const AdminQueue: React.FC<Props> = ({ onBack }) => {
  const [queue, setQueue] = useState([
    { id: 1, user: "Jean-Paul E.", type: "Fuel", loc: "Shell Akwa", val: "840 XAF", trust: 92, status: "pending", img: "https://picsum.photos/seed/a1/300/200" },
    { id: 2, user: "Kofi M.", type: "Kiosk", loc: "MTN Bonapriso", val: "Cash Available", trust: 45, status: "flagged", img: "https://picsum.photos/seed/a2/300/200" }
  ]);

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-gray-900 text-white px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 hover:text-blue-400 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Internal Validation Queue</h3>
        <ShieldCheck size={18} className="text-blue-400" />
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start space-x-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={18} />
          <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider leading-relaxed">
            Data sovereignty notice: All metadata is strictly processed within local Cameroonian nodes.
          </p>
        </div>

        <div className="space-y-4">
          {queue.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="relative h-32 bg-gray-200">
                <img src={item.img} className="w-full h-full object-cover opacity-80" alt="submission" />
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur rounded text-[8px] font-bold text-white uppercase tracking-widest">
                  Live Capture: Verified
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{item.loc}</h4>
                    <p className="text-[10px] text-gray-400 font-medium uppercase">{item.user} • {item.type}</p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{item.val}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-gray-400">Trust Score</span>
                  <span className={item.trust > 80 ? "text-green-600" : "text-amber-600"}>{item.trust}%</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button className="h-10 border border-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-red-50">
                    <XCircle size={14} />
                    <span>Reject</span>
                  </button>
                  <button className="h-10 bg-green-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-green-700">
                    <CheckCircle size={14} />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center py-12">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Sample Admin UI • Demonstration Only</p>
        </div>
      </div>
    </div>
  );
};

export default AdminQueue;
