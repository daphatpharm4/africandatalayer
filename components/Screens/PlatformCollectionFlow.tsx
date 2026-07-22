import React, { useMemo, useState } from 'react';
import { ArrowLeft, Building2, Camera, CheckCircle, Crosshair, MapPin, RefreshCw, Send, X } from 'lucide-react';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { createPlatformRecordRequest, nearbyPlatformPointsRequest, PlatformApiError } from '../../lib/client/platformApi';
import {
  collectablePlatformProjects,
  type PlatformFieldContext,
} from '../../lib/client/platformFieldContext';
import { isNative } from '../../lib/client/native';
import { validatePlatformRecord } from '../../shared/platformRecord';
import { readPlatformPhotoAsset } from '../../lib/client/platformPhoto';
import { formatDistanceMeters, pointStaleness, stalenessLabel } from '../../lib/client/platformPointUi';
import type {
  PlatformFieldDefinition,
  PlatformNearbyPoint,
  PlatformRecordEvidence,
  PlatformRecordGps,
} from '../../shared/platformTypes';

interface Props {
  context: PlatformFieldContext | null;
  isLoading: boolean;
  loadError: string;
  language: 'en' | 'fr';
  onBack: () => void;
  onComplete: () => void;
  onRetry: () => void;
  initialTarget?: {
    choiceKey: string;
    point: PlatformNearbyPoint;
  } | null;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `platform-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function labelFor(label: { en: string; fr: string }, language: 'en' | 'fr'): string {
  return label[language] || label.en;
}

async function captureGps(): Promise<PlatformRecordGps> {
  if (isNative()) {
    const permission = await CapGeolocation.requestPermissions();
    if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
      throw new Error('GPS_DENIED');
    }
    const position = await CapGeolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000 });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    };
  }
  if (!navigator.geolocation) throw new Error('GPS_UNAVAILABLE');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      }),
      () => reject(new Error('GPS_DENIED')),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

const inputClass = 'min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none focus:border-navy focus:ring-2 focus:ring-navy/10';

const PlatformCollectionFlow: React.FC<Props> = ({
  context,
  isLoading,
  loadError,
  language,
  onBack,
  onComplete,
  onRetry,
  initialTarget = null,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const suspendedOrganization = context?.organizations.find((entry) => entry.organization.accessStatus === 'suspended') ?? null;
  const collectable = useMemo(() => collectablePlatformProjects(context), [context]);
  const recordChoices = useMemo(() => collectable.flatMap((entry) => entry.publishedSchema.definition.recordTypes.map((recordType) => ({
    ...entry,
    recordType,
    key: `${entry.project.id}:${recordType.key}`,
  }))), [collectable]);
  const [selectedKey, setSelectedKey] = useState(initialTarget?.choiceKey ?? '');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [gpsEvidence, setGpsEvidence] = useState<PlatformRecordGps | undefined>();
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [extraPhotoMetadata, setExtraPhotoMetadata] = useState<NonNullable<PlatformRecordEvidence['photoMetadata']>>([]);
  const [fieldPhotoMetadata, setFieldPhotoMetadata] = useState<Record<string, NonNullable<PlatformRecordEvidence['photoMetadata']>[number]>>({});
  const [notes, setNotes] = useState('');
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedLabel, setSubmittedLabel] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [captureStartedAt, setCaptureStartedAt] = useState(() => new Date().toISOString());
  const [attachedPoint, setAttachedPoint] = useState<PlatformNearbyPoint | null>(initialTarget?.point ?? null);
  const [nearbyPoints, setNearbyPoints] = useState<PlatformNearbyPoint[] | null>(null);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState('');

  const selected = selectedKey
    ? recordChoices.find((choice) => choice.key === selectedKey) ?? null
    : recordChoices[0] ?? null;
  const selectedRecordType = selected?.recordType ?? null;

  const chooseRecordType = (key: string) => {
    setSelectedKey(key);
    setValues({});
    setGpsEvidence(undefined);
    setExtraPhotos([]);
    setExtraPhotoMetadata([]);
    setFieldPhotoMetadata({});
    setNotes('');
    setErrorMessage('');
    setSubmittedLabel('');
    setIdempotencyKey(createIdempotencyKey());
    setCaptureStartedAt(new Date().toISOString());
    setAttachedPoint(null);
    setNearbyPoints(null);
    setIsLoadingNearby(false);
    setNearbyError('');
  };

  const loadNearbyPoints = async () => {
    if (!selected) return;
    setIsLoadingNearby(true);
    setNearbyError('');
    try {
      let gps = gpsEvidence;
      if (!gps) {
        gps = await captureGps();
        setGpsEvidence(gps);
      }
      const points = await nearbyPlatformPointsRequest({
        projectId: selected.project.id,
        latitude: gps.latitude,
        longitude: gps.longitude,
      });
      setNearbyPoints(points);
    } catch {
      setNearbyError(t('Could not load nearby points', 'Impossible de charger les points à proximité'));
    } finally {
      setIsLoadingNearby(false);
    }
  };

  const setValue = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrorMessage('');
  };

  const capturePosition = async (fieldKey?: string) => {
    setIsCapturingGps(true);
    setErrorMessage('');
    try {
      const gps = await captureGps();
      setGpsEvidence(gps);
      if (fieldKey) setValue(fieldKey, gps);
    } catch {
      setErrorMessage(t(
        'Location could not be captured. Allow precise location access and try again.',
        'La position n’a pas pu être capturée. Autorisez la localisation précise et réessayez.',
      ));
    } finally {
      setIsCapturingGps(false);
    }
  };

  const addPhoto = async (file: File | undefined, fieldKey?: string) => {
    if (!file) return;
    setErrorMessage('');
    try {
      const asset = await readPlatformPhotoAsset(file);
      if (fieldKey) {
        setValue(fieldKey, asset.dataUrl);
        setFieldPhotoMetadata((current) => ({ ...current, [fieldKey]: asset.metadata }));
      } else {
        setExtraPhotos((current) => [...current, asset.dataUrl].slice(0, 10));
        setExtraPhotoMetadata((current) => [...current, asset.metadata].slice(0, 10));
      }
    } catch {
      setErrorMessage(t(
        'This photo could not be prepared for upload. Take another photo and try again.',
        'Cette photo n’a pas pu être préparée. Prenez une autre photo et réessayez.',
      ));
    }
  };

  const photoFieldValues = selectedRecordType?.fields
    .filter((field) => field.type === 'photo')
    .map((field) => values[field.key])
    .filter((value): value is string => typeof value === 'string') ?? [];
  const evidence: PlatformRecordEvidence = {
    gps: gpsEvidence,
    photos: [...photoFieldValues, ...extraPhotos],
    notes: notes.trim() || undefined,
    capturedAt: captureStartedAt,
    device: typeof navigator === 'undefined' ? undefined : {
      platform: navigator.platform || undefined,
      userAgent: navigator.userAgent,
      language: navigator.language,
    },
    photoMetadata: [
      ...(selectedRecordType?.fields
        .filter((field) => field.type === 'photo' && typeof values[field.key] === 'string')
        .map((field) => fieldPhotoMetadata[field.key])
        .filter((value): value is NonNullable<PlatformRecordEvidence['photoMetadata']>[number] => Boolean(value)) ?? []),
      ...extraPhotoMetadata,
    ],
  };

  // Defensive: loadNearbyPoints always captures GPS before a point can be attached,
  // but the server rejects pointId-without-gps, so keep the client-side guard.
  const pointNeedsGps = Boolean(attachedPoint) && !gpsEvidence;

  const handleSubmit = async () => {
    if (!selected || !selectedRecordType) return;
    const issues = validatePlatformRecord(selectedRecordType, values, evidence);
    if (issues.length > 0) {
      setErrorMessage(t(
        `Complete the required evidence: ${issues[0].message}.`,
        'Complétez tous les champs et justificatifs obligatoires.',
      ));
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErrorMessage(t(
        'Company submissions need a connection for now. Keep this screen open and submit when you are online.',
        'Les envois entreprise nécessitent actuellement une connexion. Gardez cet écran ouvert et envoyez dès que vous êtes en ligne.',
      ));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await createPlatformRecordRequest({
        projectId: selected.project.id,
        schemaVersionId: selected.publishedSchema.id,
        recordTypeKey: selectedRecordType.key,
        data: values,
        evidence,
        idempotencyKey,
        pointId: attachedPoint?.pointId,
      });
      setSubmittedLabel(labelFor(selectedRecordType.label, language));
      setAttachedPoint(null);
      setNearbyPoints(null);
    } catch (error) {
      if (error instanceof PlatformApiError && error.code === 'platform_schema_stale') {
        setErrorMessage(t(
          'Your company updated this form. Reload it before submitting.',
          'Votre entreprise a mis à jour ce formulaire. Rechargez-le avant l’envoi.',
        ));
      } else if (error instanceof PlatformApiError && error.code === 'platform_enrich_too_far') {
        setErrorMessage(t(
          'You are too far from this point. Move closer and retry.',
          'Vous êtes trop loin de ce point. Rapprochez-vous et réessayez.',
        ));
      } else if (error instanceof PlatformApiError && error.code === 'platform_enrich_cooldown') {
        setErrorMessage(t(
          'You already submitted for this point. Try again later.',
          'Vous avez déjà soumis pour ce point. Réessayez plus tard.',
        ));
      } else if (error instanceof PlatformApiError && error.code === 'platform_point_not_found') {
        setErrorMessage(t(
          'This point no longer exists. Detach and submit as a new record.',
          'Ce point n’existe plus. Détachez-le et soumettez un nouveau relevé.',
        ));
      } else {
        setErrorMessage(error instanceof Error && error.message
          ? error.message
          : t('The record could not be submitted.', 'L’enregistrement n’a pas pu être envoyé.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: PlatformFieldDefinition) => {
    const label = labelFor(field.label, language);
    const value = values[field.key];
    const fieldId = `platform-field-${field.key}`;
    const required = field.required ? <span className="text-terra" aria-hidden="true"> *</span> : null;

    if (field.type === 'boolean') {
      return (
        <fieldset key={field.key} className="space-y-2">
          <legend className="text-sm font-semibold text-gray-800">{label}{required}</legend>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((option) => (
              <button key={String(option)} type="button" onClick={() => setValue(field.key, option)}
                className={`min-h-12 rounded-xl border text-sm font-semibold ${value === option ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
                {option ? t('Yes', 'Oui') : t('No', 'Non')}
              </button>
            ))}
          </div>
        </fieldset>
      );
    }
    if (field.type === 'select') {
      return (
        <label key={field.key} htmlFor={fieldId} className="block space-y-2 text-sm font-semibold text-gray-800">
          <span>{label}{required}</span>
          <select id={fieldId} aria-required={field.required} className={inputClass} value={typeof value === 'string' ? value : ''} onChange={(event) => setValue(field.key, event.target.value)}>
            <option value="">{t('Select an option', 'Choisir une option')}</option>
            {field.options?.map((option) => <option key={option.value} value={option.value}>{labelFor(option.label, language)}</option>)}
          </select>
        </label>
      );
    }
    if (field.type === 'multi_select') {
      const selectedValues = Array.isArray(value) ? value as string[] : [];
      return (
        <fieldset key={field.key} className="space-y-2">
          <legend className="text-sm font-semibold text-gray-800">{label}{required}</legend>
          <div className="space-y-2">
            {field.options?.map((option) => {
              const checked = selectedValues.includes(option.value);
              return <label key={option.value} className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-navy" checked={checked} onChange={() => setValue(field.key, checked ? selectedValues.filter((item) => item !== option.value) : [...selectedValues, option.value])} />
                <span>{labelFor(option.label, language)}</span>
              </label>;
            })}
          </div>
        </fieldset>
      );
    }
    if (field.type === 'photo') {
      return (
        <div key={field.key} className="space-y-2">
          <div className="text-sm font-semibold text-gray-800">{label}{required}</div>
          <label className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${typeof value === 'string' ? 'border-forest bg-forest-wash text-forest-dark' : 'border-dashed border-navy bg-navy-wash text-navy'}`}>
            {typeof value === 'string' ? <CheckCircle size={18} /> : <Camera size={18} />}
            {typeof value === 'string' ? t('Photo captured', 'Photo capturée') : t('Take photo', 'Prendre une photo')}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void addPhoto(event.target.files?.[0], field.key)} />
          </label>
        </div>
      );
    }
    if (field.type === 'gps') {
      const gps = value as PlatformRecordGps | undefined;
      return (
        <div key={field.key} className="space-y-2">
          <div className="text-sm font-semibold text-gray-800">{label}{required}</div>
          <button type="button" onClick={() => void capturePosition(field.key)} disabled={isCapturingGps}
            className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${gps ? 'border-forest bg-forest-wash text-forest-dark' : 'border-navy bg-navy-wash text-navy'}`}>
            {gps ? <CheckCircle size={18} /> : <Crosshair size={18} />}
            {gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : t('Capture GPS', 'Capturer le GPS')}
          </button>
        </div>
      );
    }

    return (
      <label key={field.key} htmlFor={fieldId} className="block space-y-2 text-sm font-semibold text-gray-800">
        <span>{label}{required}</span>
        <input id={fieldId} aria-required={field.required} className={inputClass} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          min={field.min} max={field.max} value={typeof value === 'string' || typeof value === 'number' ? value : ''}
          onChange={(event) => setValue(field.key, field.type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} />
      </label>
    );
  };

  if (isLoading) {
    return <div className="screen-shell bg-page p-5"><div className="card flex min-h-40 items-center justify-center gap-3 p-5 text-sm text-gray-600"><RefreshCw className="animate-spin text-navy" size={18} />{t('Loading your company forms…', 'Chargement des formulaires de votre entreprise…')}</div></div>;
  }

  return (
    <div data-testid="screen-platform-collection" className="flex h-full flex-col overflow-hidden bg-page">
      <header className="shrink-0 border-b border-gray-100 bg-white px-4 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-12 w-12 items-center justify-center rounded-xl text-gray-600" aria-label={t('Back', 'Retour')}><ArrowLeft size={22} /></button>
          <div className="min-w-0 flex-1">
            <div className="micro-label text-forest">{t('Company collection', 'Collecte entreprise')}</div>
            <h1 className="truncate text-lg font-bold text-navy">{selected?.organization.name ?? context?.organizations[0]?.organization.name ?? t('Company workspace', 'Espace entreprise')}</h1>
          </div>
          {selected?.organization.logoUrl ? <img src={selected.organization.logoUrl} alt="" className="h-11 w-11 rounded-xl border border-gray-100 object-contain" /> : <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-wash text-navy"><Building2 size={20} /></div>}
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-8">
        {loadError && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <div>{t('Your company workspace could not be loaded.', 'Votre espace entreprise n’a pas pu être chargé.')}</div>
            <button type="button" onClick={onRetry} className="mt-2 min-h-11 font-bold underline">{t('Try again', 'Réessayer')}</button>
          </div>
        )}

        {!loadError && suspendedOrganization && recordChoices.length === 0 && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center" role="alert">
            <Building2 className="mx-auto text-amber-800" size={30} />
            <h2 className="mt-3 text-lg font-bold text-amber-950">{t('Company access suspended', 'Accès entreprise suspendu')}</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              {suspendedOrganization.organization.suspensionReason
                ?? t('Contact your company administrator or ADL support.', 'Contactez votre administrateur ou le support ADL.')}
            </p>
          </section>
        )}

        {!loadError && !suspendedOrganization && recordChoices.length === 0 && (
          <section className="card p-5 text-center">
            <Building2 className="mx-auto text-navy" size={30} />
            <h2 className="mt-3 text-lg font-bold text-gray-900">{t('No company form is ready yet', 'Aucun formulaire entreprise n’est encore prêt')}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{t(
              'Your membership is active, but a manager must publish a project form in the console before you can collect company data.',
              'Votre accès est actif, mais un responsable doit publier un formulaire de projet dans la console avant la collecte.',
            )}</p>
            <button type="button" onClick={onRetry} className="mt-4 min-h-12 rounded-xl bg-navy px-5 text-sm font-bold text-white">{t('Refresh company forms', 'Actualiser les formulaires')}</button>
          </section>
        )}

        {recordChoices.length > 0 && (
          <>
            <section className="card space-y-3 p-4">
              <div>
                <div className="micro-label text-gray-400">{t('What are you collecting?', 'Que collectez-vous ?')}</div>
                <p className="mt-1 text-xs text-gray-500">{t('These are your company’s published data types.', 'Voici les types de données publiés par votre entreprise.')}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recordChoices.map((choice) => {
                  const active = choice.key === selected?.key;
                  return <button key={choice.key} type="button" onClick={() => chooseRecordType(choice.key)}
                    className={`min-h-16 rounded-xl border p-3 text-left ${active ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-900'}`}>
                    <span className="block text-sm font-bold">{labelFor(choice.recordType.label, language)}</span>
                    <span className={`mt-1 block text-xs ${active ? 'text-white/70' : 'text-gray-500'}`}>{choice.project.name} · v{choice.publishedSchema.version}</span>
                  </button>;
                })}
              </div>
            </section>

            {submittedLabel ? (
              <section className="card p-6 text-center">
                <CheckCircle className="mx-auto text-forest" size={44} />
                <h2 className="mt-3 text-xl font-bold text-gray-900">{t('Company record sent', 'Donnée entreprise envoyée')}</h2>
                <p className="mt-2 text-sm text-gray-600">{submittedLabel} · {selected?.project.name}</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => chooseRecordType(selected?.key ?? '')} className="min-h-12 rounded-xl bg-navy px-4 text-sm font-bold text-white">{t('Collect another', 'Collecter à nouveau')}</button>
                  <button type="button" onClick={onComplete} className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800">{t('Done', 'Terminer')}</button>
                </div>
              </section>
            ) : selectedRecordType && (
              <>
                <section className="card-soft space-y-3 p-4">
                  <div>
                    <div className="micro-label text-gray-400">{t('Existing point', 'Point existant')}</div>
                    <p className="mt-1 text-xs text-gray-500">{t('Attach this record to a point your company already tracks.', 'Associez ce relevé à un point déjà suivi par votre entreprise.')}</p>
                  </div>

                  {attachedPoint ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-forest bg-forest-wash px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate text-sm font-bold text-forest-dark">
                          <MapPin size={16} className="shrink-0" />
                          <span className="truncate">{attachedPoint.name ?? attachedPoint.category}</span>
                        </div>
                        <div className="mt-1 text-xs text-forest-dark/80">{stalenessLabel(attachedPoint.updatedAt, new Date(), language)}</div>
                      </div>
                      <button type="button" onClick={() => setAttachedPoint(null)}
                        aria-label={t('Remove attached point', 'Retirer le point associé')}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-forest-dark active:scale-95 transition-all">
                        <X size={18} />
                      </button>
                    </div>
                  ) : nearbyPoints === null ? (
                    <button type="button" onClick={() => void loadNearbyPoints()} disabled={isLoadingNearby}
                      className="btn-ghost flex w-full items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
                      {isLoadingNearby ? <RefreshCw className="animate-spin" size={16} /> : <MapPin size={16} />}
                      {isLoadingNearby ? t('Looking for nearby points…', 'Recherche de points à proximité…') : t('Attach to existing point', 'Associer à un point existant')}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {nearbyError && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-700">{nearbyError}</div>}
                      {nearbyPoints.length === 0 ? (
                        <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">{t('No points nearby', 'Aucun point à proximité')}</p>
                      ) : (
                        nearbyPoints.map((point) => {
                          const staleness = pointStaleness(point.updatedAt, new Date());
                          return (
                            <button key={point.pointId} type="button"
                              onClick={() => { setAttachedPoint(point); setNearbyPoints(null); }}
                              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left active:scale-95 transition-all">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-gray-900">{point.name ?? point.category}</div>
                                <div className="micro-label mt-0.5 text-gray-400">{point.category}</div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-xs font-semibold text-gray-600">{formatDistanceMeters(point.distanceMeters, language)}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${staleness.stale ? 'bg-amber-wash text-amber' : 'bg-gray-100 text-gray-500'}`}>
                                  {stalenessLabel(point.updatedAt, new Date(), language)}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                      <button type="button" onClick={() => void loadNearbyPoints()} disabled={isLoadingNearby}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-navy disabled:opacity-60">
                        <RefreshCw size={14} className={isLoadingNearby ? 'animate-spin' : ''} />
                        {t('Refresh', 'Actualiser')}
                      </button>
                    </div>
                  )}
                </section>

                <section className="card space-y-4 p-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{labelFor(selectedRecordType.label, language)}</h2>
                    <p className="mt-1 text-xs text-gray-500">{selected?.project.name} · {selected?.organization.name}</p>
                  </div>
                  {selectedRecordType.fields.map(renderField)}
                </section>

                {(selectedRecordType.evidence.gpsRequired || selectedRecordType.evidence.minPhotos > 0 || selectedRecordType.evidence.notesRequired || attachedPoint) && (
                  <section className="card space-y-4 p-4">
                    <div>
                      <div className="micro-label text-terra">{t('Required evidence', 'Justificatifs requis')}</div>
                      <p className="mt-1 text-xs text-gray-500">{t('Evidence helps reviewers verify your work.', 'Les justificatifs aident les réviseurs à vérifier votre travail.')}</p>
                    </div>
                    {(selectedRecordType.evidence.gpsRequired || attachedPoint) && (
                      <button type="button" onClick={() => void capturePosition()} disabled={isCapturingGps}
                        className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${gpsEvidence ? 'border-forest bg-forest-wash text-forest-dark' : 'border-navy bg-navy-wash text-navy'}`}>
                        {gpsEvidence ? <CheckCircle size={18} /> : <Crosshair size={18} />}
                        {gpsEvidence
                          ? `${t('GPS captured', 'GPS capturé')} · ±${Math.round(gpsEvidence.accuracyMeters ?? 0)}m`
                          : attachedPoint
                            ? t('Capture current location', 'Capturer la position actuelle')
                            : t('Capture precise GPS', 'Capturer le GPS précis')}
                      </button>
                    )}
                    {selectedRecordType.evidence.minPhotos > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-gray-800">{t('Photo evidence', 'Preuves photo')} ({evidence.photos.length}/{selectedRecordType.evidence.minPhotos})</div>
                        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-navy bg-navy-wash px-4 text-sm font-semibold text-navy">
                          <Camera size={18} />{t('Add evidence photo', 'Ajouter une photo justificative')}
                          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void addPhoto(event.target.files?.[0])} />
                        </label>
                      </div>
                    )}
                    {selectedRecordType.evidence.notesRequired && (
                      <label className="block space-y-2 text-sm font-semibold text-gray-800">
                        <span>{t('Field notes', 'Notes de terrain')} <span className="text-terra">*</span></span>
                        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={2000} className={`${inputClass} py-3`} />
                      </label>
                    )}
                  </section>
                )}

                {errorMessage && <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{errorMessage}</div>}
                {pointNeedsGps && <p className="text-xs font-semibold text-amber">{t('Capture GPS to attach a point', 'Capturez le GPS pour associer un point')}</p>}
                <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || pointNeedsGps}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-bold text-white shadow-lg disabled:opacity-60">
                  {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                  {isSubmitting ? t('Sending securely…', 'Envoi sécurisé…') : t('Submit to company', 'Envoyer à l’entreprise')}
                </button>
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default PlatformCollectionFlow;
