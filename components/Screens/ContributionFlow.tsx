
import React, { useState, useRef } from 'react';
import { ChevronLeft, Info, Check, Image as ImageIcon, Camera, ArrowRight, ShieldCheck, Mic, MicOff } from 'lucide-react';
import { transcribeAudio } from '../../lib/gemini';

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

const ContributionFlow: React.FC<Props> = ({ onBack, onComplete }) => {
  const [step, setStep] = useState(1);
  const [price, setPrice] = useState('840');
  const [status, setStatus] = useState<'Available' | 'StockOut'>('Available');
  const [description, setDescription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const totalSteps = 3;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsTranscribing(true);
          try {
            const text = await transcribeAudio(base64Audio);
            setDescription(prev => prev + (prev ? ' ' : '') + text);
          } catch (err) {
            console.error(err);
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center space-x-2">
               <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center">
                 <ShieldCheck size={12} className="mr-1" /> +5 XP • DOUALA LAYER
               </span>
             </div>
             
             <div className="space-y-2">
               <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Current Price of Petrol</h2>
               <p className="text-sm text-gray-500">Enter the pump price per liter (Super) in Douala.</p>
             </div>

             <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Price per Liter</label>
                <div className="relative group">
                  <input 
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full h-20 bg-white border-2 border-gray-100 rounded-2xl px-6 text-3xl font-bold text-gray-900 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300 uppercase">XAF</span>
                </div>
                <p className="text-[10px] text-gray-400 italic px-1">Standard rate: ~840 XAF</p>
             </div>

             <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Station Status</label>
                <div className="grid grid-cols-2 gap-4">
                   <button 
                    onClick={() => setStatus('Available')}
                    className={`h-16 rounded-xl flex items-center justify-center space-x-2 border-2 transition-all ${status === 'Available' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-gray-100 text-gray-400'}`}
                   >
                     <div className={`w-5 h-5 rounded-full flex items-center justify-center ${status === 'Available' ? 'bg-blue-600 text-white' : 'border-2 border-gray-200'}`}>
                        {status === 'Available' && <Check size={12} />}
                     </div>
                     <span className="text-sm font-bold uppercase tracking-wide">Available</span>
                   </button>
                   <button 
                    onClick={() => setStatus('StockOut')}
                    className={`h-16 rounded-xl flex items-center justify-center space-x-2 border-2 transition-all ${status === 'StockOut' ? 'bg-gray-100 border-gray-600 text-gray-700' : 'bg-white border-gray-100 text-gray-400'}`}
                   >
                     <div className={`w-5 h-5 rounded-full flex items-center justify-center ${status === 'StockOut' ? 'bg-gray-600 text-white' : 'border-2 border-gray-200'}`}>
                        {status === 'StockOut' && <Check size={12} />}
                     </div>
                     <span className="text-sm font-bold uppercase tracking-wide">Stock Out</span>
                   </button>
                </div>
             </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
             <div className="flex items-center space-x-2">
               <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center">
                 <ImageIcon size={12} className="mr-1" /> +10 XP • OPTIONAL PHOTO
               </span>
             </div>
             
             <div className="space-y-2 text-center pt-8">
               <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Photo Verification</h2>
               <p className="text-sm text-gray-500 px-8">Ensure the price board is clearly visible and legible for a data reliability bonus.</p>
             </div>

             <div className="aspect-square w-full rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden">
               <Camera size={48} className="mb-4 opacity-30" />
               <p className="text-xs font-bold uppercase tracking-widest opacity-60">Frame Price Board</p>
             </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
             <div className="flex items-center space-x-2">
               <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center">
                 <ShieldCheck size={12} className="mr-1" /> FINAL STEP • +50 XP BONUS
               </span>
             </div>
             
             <div className="space-y-2">
               <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Voice Report</h2>
               <p className="text-sm text-gray-500">Describe any issues or observations. Tap the mic to record.</p>
             </div>

             <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Observations</h4>
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                  >
                    {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                </div>
                
                <div className="relative">
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="E.g. Long queues at the diesel pump, payment system offline..."
                    className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-all resize-none"
                  />
                  {isTranscribing && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-xl">
                      <div className="flex items-center space-x-2 text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Transcribing...</span>
                      </div>
                    </div>
                  )}
                </div>
             </div>

             <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Queue Status</h4>
               <div className="flex p-1 bg-gray-50 rounded-xl">
                  {['Empty', 'Moderate', 'Crowded'].map(q => (
                    <button key={q} className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${q === 'Moderate' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>
                      {q}
                    </button>
                  ))}
               </div>
             </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]">
      {/* Top Progress Bar */}
      <div className="pt-6 px-8">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-500"><ChevronLeft size={24} /></button>
          <span className="text-xs font-bold text-gray-900 uppercase tracking-[0.2em]">{step === 1 ? 'Quick' : step === 2 ? 'Verification' : 'Detailed'} Contribution</span>
          <span className="text-[10px] font-bold text-gray-400">Step {step} of {totalSteps}</span>
        </div>
        <div className="h-1 flex space-x-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
        {renderStep()}
      </div>

      {/* Footer CTA */}
      <div className="p-6 pt-2 space-y-3">
        <button
          onClick={() => {
            if (step < totalSteps) setStep(step + 1);
            else onComplete();
          }}
          className="w-full h-14 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-blue-700 active:scale-95 transition-all"
        >
          <span>{step === totalSteps ? 'Finalize Submission' : 'Save & Continue'}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default ContributionFlow;
