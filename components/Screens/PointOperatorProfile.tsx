import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronRight, HelpCircle, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import {
  fetchPointOperatorMe,
  submitPointOperatorPhoto,
} from '../../lib/client/pointOperatorApi';
import {
  enqueuePointOperatorMutation,
  listPointOperatorQueueItems,
  removePointOperatorQueueItem,
} from '../../lib/client/pointOperatorQueue';
import type { PointOperatorMeResponse } from '../../shared/types';
import { categoryLabel } from '../../shared/verticals';
import { Screen } from '../../types';

interface Props {
  language: 'en' | 'fr';
  onLanguageChange: (language: 'en' | 'fr') => void;
  navigateTo: (screen: Screen) => void;
  onOpenDocs: () => void;
  onLogout: () => void;
}

function abbreviate(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function isRetryable(error: unknown): boolean {
  if (error && typeof error === 'object' && 'retryable' in error) {
    return Boolean((error as { retryable?: unknown }).retryable);
  }
  return true;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

const PointOperatorProfile: React.FC<Props> = ({
  language,
  onLanguageChange,
  navigateTo,
  onOpenDocs,
  onLogout,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<PointOperatorMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<'idle' | 'saving' | 'saved' | 'pending' | 'error'>('idle');
  const [photoMessage, setPhotoMessage] = useState('');
  const [hasQueuedPhoto, setHasQueuedPhoto] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [me, queue] = await Promise.all([
        fetchPointOperatorMe(),
        listPointOperatorQueueItems().catch(() => []),
      ]);
      setData(me);
      setHasQueuedPhoto(queue.some((item) => item.mutation.kind === 'photo'));
    } catch (loadError) {
      setError(messageFrom(loadError, t('Unable to load profile.', 'Impossible de charger le profil.')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return;
    setPhotoStatus('saving');
    setPhotoMessage('');

    const imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('file_read_failed'));
      reader.readAsDataURL(file);
    }).catch((readError) => {
      setPhotoStatus('error');
      setPhotoMessage(messageFrom(readError, t('Unable to read this photo.', 'Impossible de lire cette photo.')));
      return '';
    });
    if (!imageData) return;

    setPhotoPreview(imageData);
    const capturedAt = new Date().toISOString();
    let item: Awaited<ReturnType<typeof enqueuePointOperatorMutation>> | null = null;

    try {
      item = await enqueuePointOperatorMutation({ kind: 'photo', imageData, capturedAt });
      setHasQueuedPhoto(true);
      const response = await submitPointOperatorPhoto(
        { imageData, capturedAt },
        { idempotencyKey: item.idempotencyKey },
      );
      await removePointOperatorQueueItem(item.id);
      setData((current) => current ? { ...current, point: response.point } : current);
      setHasQueuedPhoto(false);
      setPhotoStatus('saved');
      setPhotoMessage(t('Photo saved', 'Photo enregistree'));
    } catch (uploadError) {
      if (item && !isRetryable(uploadError)) {
        await removePointOperatorQueueItem(item.id).catch(() => undefined);
        setHasQueuedPhoto(false);
        setPhotoStatus('error');
        setPhotoMessage(messageFrom(uploadError, t('Photo rejected. Try another image.', 'Photo refusee. Essayez une autre image.')));
        await load();
        return;
      }
      if (item) {
        setPhotoStatus('pending');
        setPhotoMessage(t('Pending sync. Keep the app online to finish the upload.', 'Synchronisation en attente. Gardez l app en ligne pour terminer.'));
        return;
      }
      setPhotoStatus('error');
      setPhotoMessage(t('Photo upload needs connectivity. Try again when online.', 'La connexion est requise pour envoyer la photo.'));
    }
  };

  const point = data?.point;
  const details = (point?.details ?? {}) as Record<string, unknown>;
  const pointName =
    typeof details.name === 'string' ? details.name
    : typeof details.siteName === 'string' ? details.siteName
    : point?.pointId ?? t('Verified point', 'Point verifie');
  const locality = typeof details.locality === 'string'
    ? details.locality
    : point
      ? `${point.location.latitude.toFixed(4)}, ${point.location.longitude.toFixed(4)}`
      : '';
  const photoUrl = photoPreview ?? point?.photoUrl;

  return (
    <div data-testid="screen-point-operator-profile" className="screen-shell bg-page">
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-[calc(var(--safe-top)+12px)] backdrop-blur">
        <p className="micro-label text-terra">{t('Point Operator', 'Operateur de point')}</p>
        <h1 className="mt-1 text-xl font-black text-navy">{t('Profile', 'Profil')}</h1>
      </div>

      <div className="space-y-4 p-4 pb-24 sm:p-6 sm:pb-24">
        {isLoading && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
            {t('Loading profile...', 'Chargement du profil...')}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-terra/30 bg-terra-wash p-4 text-sm font-semibold text-terra-dark">
            {error}
            <button type="button" onClick={() => void load()} className="btn-primary mt-3 min-h-[48px] w-full">
              {t('Retry', 'Reessayer')}
            </button>
          </div>
        )}

        {data && point && (
          <>
            <section className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-navy-wash">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black text-navy">
                      {pointName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-forest">
                    {categoryLabel(point.category, language)}
                  </div>
                  <h2 className="truncate text-base font-black text-ink">{pointName}</h2>
                  <p className="mt-1 text-xs font-medium text-gray-600">{locality}</p>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handlePhotoFile(event.currentTarget.files?.[0])}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-navy px-4 text-sm font-black text-white"
              >
                <Camera size={18} aria-hidden="true" />
                {t('Update photo', 'Mettre a jour la photo')}
              </button>
              {(photoStatus !== 'idle' || hasQueuedPhoto) && (
                <p className={`mt-3 text-xs font-semibold ${photoStatus === 'error' ? 'text-terra-dark' : 'text-gray-600'}`}>
                  {hasQueuedPhoto && photoStatus !== 'saved'
                    ? t('Pending sync', 'Synchronisation en attente')
                    : photoStatus === 'saving'
                      ? t('Syncing', 'Synchronisation')
                      : photoStatus === 'saved'
                        ? t('Saved', 'Enregistre')
                        : photoMessage}
                  {photoMessage && photoStatus !== 'error' ? ` - ${photoMessage}` : ''}
                </p>
              )}
            </section>

            <section className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-forest" />
                <div>
                  <h3 className="text-sm font-black text-ink">{t('Verified identity and location', 'Identite et position verifiees')}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">
                    {t('ADL manages verified identity and location for this point.', 'ADL gere l identite et la position verifiees de ce point.')}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-bold uppercase text-gray-400">{t('Point ID', 'ID point')}</dt>
                  <dd className="mt-1 font-black text-ink">{abbreviate(point.pointId)}</dd>
                </div>
                <div>
                  <dt className="font-bold uppercase text-gray-400">{t('Locality', 'Localite')}</dt>
                  <dd className="mt-1 font-black text-ink">{locality}</dd>
                </div>
              </dl>
            </section>

            <section className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 px-4 py-3">
                <div className="micro-label text-gray-400">{t('Language', 'Langue')}</div>
              </div>
              {(['en', 'fr'] as const).map((nextLanguage) => (
                <button
                  key={nextLanguage}
                  type="button"
                  onClick={() => onLanguageChange(nextLanguage)}
                  className="flex min-h-[52px] w-full items-center justify-between border-b border-gray-50 px-4 text-sm font-bold text-ink last:border-b-0"
                >
                  <span>{nextLanguage === 'en' ? 'English' : 'Francais'}</span>
                  {language === nextLanguage && <Check size={18} className="text-forest" aria-hidden="true" />}
                </button>
              ))}
            </section>

            <section className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => navigateTo(Screen.POINT_OPERATOR_PASSWORD)}
                className="flex min-h-[56px] w-full items-center justify-between border-b border-gray-50 px-4 text-left"
              >
                <span className="flex items-center gap-3 text-sm font-bold text-ink">
                  <KeyRound size={18} className="text-navy" aria-hidden="true" />
                  {t('Change password', 'Changer le mot de passe')}
                </span>
                <ChevronRight size={18} className="text-gray-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onOpenDocs}
                className="flex min-h-[56px] w-full items-center justify-between border-b border-gray-50 px-4 text-left"
              >
                <span className="flex items-center gap-3 text-sm font-bold text-ink">
                  <HelpCircle size={18} className="text-navy" aria-hidden="true" />
                  {t('Help and privacy', 'Aide et confidentialite')}
                </span>
                <ChevronRight size={18} className="text-gray-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left text-sm font-bold text-terra-dark"
              >
                <LogOut size={18} aria-hidden="true" />
                {t('Sign out', 'Se deconnecter')}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default PointOperatorProfile;
