import React from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Flag,
  MapPin
} from 'lucide-react';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

const AdminQueue: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const queue = [
    {
      id: 1,
      user: 'Jean-Paul E.',
      type: t('Fuel', 'Carburant'),
      loc: 'Shell Akwa',
      val: `840 XAF`,
      trust: 92,
      status: t('match', 'correspondance'),
      img: 'https://picsum.photos/seed/a1/300/200',
      exif: '4.0511°N, 9.7012°E',
      device: '4.0510°N, 9.7015°E'
    },
    {
      id: 2,
      user: 'Kofi M.',
      type: t('Kiosk', 'Kiosque'),
      loc: 'MTN Bonapriso',
      val: t('Cash Available', 'Especes disponibles'),
      trust: 45,
      status: t('mismatch', 'non-correspondance'),
      img: 'https://picsum.photos/seed/a2/300/200',
      exif: '4.0472°N, 9.7208°E',
      device: '4.0589°N, 9.7121°E'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-[#1f2933] text-white px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 hover:text-[#c86b4a] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">{t('Validator Queue', 'File de validation')}</h3>
        <ShieldCheck size={18} className="text-[#c86b4a]" />
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start space-x-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={18} />
          <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider leading-relaxed">
            {t('Demo validator view • compare EXIF GPS vs device location before approval.', 'Vue demo validateur • comparer GPS EXIF vs GPS appareil avant approbation.')}
          </p>
        </div>

        <div className="space-y-4">
          {queue.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="relative h-32 bg-gray-200">
                <img src={item.img} className="w-full h-full object-cover opacity-80" alt={t('submission', 'soumission')} />
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur rounded-xl text-[8px] font-bold text-white uppercase tracking-widest">
                  {t('Live Capture: Verified', 'Capture live : verifiee')}
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{item.loc}</h4>
                    <p className="text-[10px] text-gray-400 font-medium uppercase">{item.user} • {item.type}</p>
                  </div>
                  <span className="text-sm font-bold text-[#0f2b46]">{item.val}</span>
                </div>

                <div className="bg-[#f9fafb] border border-gray-100 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-gray-400">{t('Photo GPS', 'Photo GPS')}</span>
                    <span className="text-gray-700">{item.exif}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-gray-400">{t('Device GPS', 'GPS appareil')}</span>
                    <span className="text-gray-700">{item.device}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-gray-400">{t('Match Status', 'Etat correspondance')}</span>
                    <span className={item.status === t('match', 'correspondance') ? 'text-[#4c7c59]' : 'text-[#c86b4a]'}>
                      {item.status === t('match', 'correspondance') ? t('Match', 'OK') : t('Mismatch', 'Ecart')}
                    </span>
                  </div>
                </div>

                <div className="bg-[#e7eef4] rounded-2xl p-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
                  <span>{t('Map Comparison', 'Comparaison carte')}</span>
                  <MapPin size={14} />
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-gray-400">{t('Trust Score', 'Score de confiance')}</span>
                  <span className={item.trust > 80 ? 'text-[#4c7c59]' : 'text-[#c86b4a]'}>{item.trust}%</span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button className="h-10 border border-red-100 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-red-50">
                    <XCircle size={14} />
                    <span>{t('Reject', 'Rejeter')}</span>
                  </button>
                  <button className="h-10 border border-amber-100 text-[#c86b4a] rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-[#f7e8e1]">
                    <Flag size={14} />
                    <span>{t('Flag', 'Signaler')}</span>
                  </button>
                  <button className="h-10 bg-[#4c7c59] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-[#3f6a4d]">
                    <CheckCircle size={14} />
                    <span>{t('Approve', 'Approuver')}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center py-12">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{t('Sample Admin UI • Demonstration Only', 'Interface admin exemple • demonstration')}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminQueue;
