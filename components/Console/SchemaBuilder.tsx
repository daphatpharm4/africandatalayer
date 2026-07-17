import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { ChevronLeft, Minus, Plus, Trash2 } from 'lucide-react';
import {
  builderReducer,
  emptyRecordType,
  type ConsoleRoute,
} from '../../lib/client/consoleState';
import { validateSchemaDefinition, type SchemaValidationIssue } from '../../shared/platformSchema';
import type {
  PlatformFieldDefinition,
  PlatformFieldType,
  PlatformSchemaDefinition,
  PlatformSchemaVersion,
} from '../../shared/platformTypes';
import { getSchemaRequest, publishSchemaRequest, saveSchemaDraftRequest, PlatformApiError } from '../../lib/client/platformApi';

export interface SchemaBuilderProps {
  projectId: string;
  language: 'en' | 'fr';
  onNavigate: (route: ConsoleRoute) => void;
}

const FIELD_TYPES: PlatformFieldType[] = ['text', 'number', 'select', 'multi_select', 'date', 'boolean', 'photo', 'gps'];

/**
 * Same error-copy convention as OnboardingWizard/Task 13: server body.error
 * (via PlatformApiError.message) for 4xx, generic bilingual fallback for 5xx.
 */
function describeError(error: unknown, t: (en: string, fr: string) => string): string {
  if (error instanceof PlatformApiError) {
    if (error.status >= 500) {
      return t('Something went wrong. Please try again.', 'Une erreur est survenue. Veuillez réessayer.');
    }
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : t('Something went wrong. Please try again.', "Une erreur s'est produite. Veuillez réessayer.");
}

function fieldTypeLabel(type: PlatformFieldType, t: (en: string, fr: string) => string): string {
  switch (type) {
    case 'text':
      return t('Text', 'Texte');
    case 'number':
      return t('Number', 'Nombre');
    case 'select':
      return t('Select (one)', 'Choix (unique)');
    case 'multi_select':
      return t('Select (multiple)', 'Choix (multiple)');
    case 'date':
      return t('Date', 'Date');
    case 'boolean':
      return t('Yes/No', 'Oui/Non');
    case 'photo':
      return t('Photo', 'Photo');
    case 'gps':
      return t('GPS location', 'Position GPS');
    default:
      return type;
  }
}

function formatDate(iso: string, language: 'en' | 'fr'): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium' });
}

/** Replaces an existing entry with the same id (or prepends), newest version first. */
function mergeVersion(versions: PlatformSchemaVersion[], next: PlatformSchemaVersion): PlatformSchemaVersion[] {
  const filtered = versions.filter((version) => version.id !== next.id);
  return [next, ...filtered].sort((a, b) => b.version - a.version);
}

const inputClass =
  'h-10 w-full rounded-lg border border-gray-100 bg-white px-2 text-sm text-ink shadow-sm transition-all focus:border-navy focus:outline-none';

// ---------------------------------------------------------------------------
// Loader shell — fetches draft/published/versions once, then hands off to the
// editor. The editor owns a useReducer whose initial value must be fixed at
// mount, so it only mounts once the fetch resolves (key={projectId} forces a
// clean remount if the user navigates between projects).
// ---------------------------------------------------------------------------

const SchemaBuilder: React.FC<SchemaBuilderProps> = ({ projectId, language, onNavigate }) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);

  const [schemaData, setSchemaData] = useState<{
    draft: PlatformSchemaVersion | null;
    published: PlatformSchemaVersion | null;
    versions: PlatformSchemaVersion[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSchemaData(null);
    setLoadError(null);
    void getSchemaRequest(projectId)
      .then((data) => {
        if (cancelled) return;
        setSchemaData(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(describeError(error, t));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey, t]);

  const backButton = (
    <button
      type="button"
      onClick={() => onNavigate({ screen: 'PROJECTS' })}
      className="micro-label flex items-center gap-1 text-ink-muted hover:text-navy"
    >
      <ChevronLeft size={14} /> {t('Projects', 'Projets')}
    </button>
  );

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        {backButton}
        <div className="card p-6 text-center">
          <p className="text-sm text-danger" role="alert">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="btn-ghost mt-4 flex w-full items-center justify-center"
          >
            {t('Try again', 'Réessayer')}
          </button>
        </div>
      </div>
    );
  }

  if (!schemaData) {
    return (
      <div className="flex flex-col gap-4">
        {backButton}
        <p className="micro-label text-ink-muted">{t('Loading schema…', 'Chargement du schéma…')}</p>
      </div>
    );
  }

  return (
    <SchemaBuilderEditor
      key={projectId}
      projectId={projectId}
      language={language}
      onNavigate={onNavigate}
      initialDraft={schemaData.draft}
      initialPublished={schemaData.published}
      initialVersions={schemaData.versions}
    />
  );
};

export default SchemaBuilder;

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

interface EditorProps {
  projectId: string;
  language: 'en' | 'fr';
  onNavigate: (route: ConsoleRoute) => void;
  initialDraft: PlatformSchemaVersion | null;
  initialPublished: PlatformSchemaVersion | null;
  initialVersions: PlatformSchemaVersion[];
}

const SchemaBuilderEditor: React.FC<EditorProps> = ({
  projectId,
  language,
  onNavigate,
  initialDraft,
  initialPublished,
  initialVersions,
}) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);

  const editorInitial: PlatformSchemaDefinition =
    initialDraft?.definition ?? initialPublished?.definition ?? { recordTypes: [emptyRecordType(0)] };
  const [definition, dispatch] = useReducer(builderReducer, editorInitial);
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0);

  const [draft, setDraft] = useState<PlatformSchemaVersion | null>(initialDraft);
  const [published, setPublished] = useState<PlatformSchemaVersion | null>(initialPublished);
  const [versions, setVersions] = useState<PlatformSchemaVersion[]>(initialVersions);
  // null sentinel = "nothing persisted yet" so a brand-new project's default
  // definition is treated as dirty (Save enabled) rather than looking
  // already-saved just because it hasn't been touched.
  const [lastSavedDefinition, setLastSavedDefinition] = useState<PlatformSchemaDefinition | null>(
    initialDraft?.definition ?? initialPublished?.definition ?? null,
  );

  const [isBusy, setIsBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const issues: SchemaValidationIssue[] = useMemo(() => {
    const result = validateSchemaDefinition(definition);
    // `=== false` (not `!result.ok` / a truthy check) — this repo's
    // tsconfig has no "strict" flag, and under non-strict mode plain
    // truthiness narrowing does not discriminate this union (the server's
    // own handleSchemaDraftSave in lib/server/platform/api.ts uses the same
    // explicit-equality pattern for the same reason).
    if (result.ok === false) {
      return result.issues;
    }
    return [];
  }, [definition]);
  const isDirty = lastSavedDefinition === null || JSON.stringify(definition) !== JSON.stringify(lastSavedDefinition);

  const maxVersion = versions.reduce((max, version) => Math.max(max, version.version), 0);
  const nextPublishVersion = draft ? draft.version : maxVersion + 1;
  const canSave = issues.length === 0 && isDirty && !isBusy;
  const canPublish = Boolean(draft) && !isDirty && issues.length === 0 && !isBusy;
  const publishedHistory = useMemo(
    () => versions.filter((version) => version.status === 'published').sort((a, b) => b.version - a.version),
    [versions],
  );

  const selectedType = definition.recordTypes[selectedTypeIndex] ?? null;

  const handleAddRecordType = () => {
    const nextIndex = definition.recordTypes.length;
    dispatch({ type: 'ADD_RECORD_TYPE' });
    setSelectedTypeIndex(nextIndex);
  };

  const handleRemoveRecordType = (removeIndex: number) => {
    dispatch({ type: 'REMOVE_RECORD_TYPE', typeIndex: removeIndex });
    setSelectedTypeIndex((current) => {
      if (removeIndex < current) return current - 1;
      if (removeIndex === current) return Math.max(0, current - 1);
      return current;
    });
  };

  const handleFieldTypeChange = (fieldIndex: number, newType: PlatformFieldType, field: PlatformFieldDefinition) => {
    const patch: Partial<PlatformFieldDefinition> = { type: newType };
    patch.options = newType === 'select' || newType === 'multi_select' ? field.options ?? [] : undefined;
    if (newType !== 'number') {
      patch.min = undefined;
      patch.max = undefined;
    }
    dispatch({ type: 'UPDATE_FIELD', typeIndex: selectedTypeIndex, fieldIndex, patch });
  };

  const handleSaveDraft = async () => {
    if (issues.length > 0 || isBusy) return;
    setSaveError(null);
    setIsBusy(true);
    try {
      const saved = await saveSchemaDraftRequest({ projectId, definition });
      setDraft(saved);
      setVersions((current) => mergeVersion(current, saved));
      setLastSavedDefinition(definition);
    } catch (error) {
      if (error instanceof PlatformApiError && error.status === 422) {
        setSaveError(t('Fix the issues listed below before saving.', 'Corrigez les problèmes ci-dessous avant d’enregistrer.'));
      } else {
        setSaveError(describeError(error, t));
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!draft || isDirty || issues.length > 0 || isBusy) return;
    const versionNumber = draft.version;
    const confirmed = window.confirm(
      t(
        `Publish version ${versionNumber}? This becomes the live schema for new submissions.`,
        `Publier la version ${versionNumber} ? Cela deviendra le schéma actif pour les nouvelles soumissions.`,
      ),
    );
    if (!confirmed) return;
    setPublishError(null);
    setIsBusy(true);
    try {
      const publishedVersion = await publishSchemaRequest(projectId);
      setPublished(publishedVersion);
      setDraft(null);
      setVersions((current) => mergeVersion(current, publishedVersion));
    } catch (error) {
      setPublishError(describeError(error, t));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'PROJECTS' })}
          className="micro-label flex items-center gap-1 text-ink-muted hover:text-navy"
        >
          <ChevronLeft size={14} /> {t('Projects', 'Projets')}
        </button>
        <h1 className="mt-2 text-xl font-semibold text-ink">{t('Schema builder', 'Générateur de schéma')}</h1>
        {published && (
          <p className="mt-1 text-sm text-ink-muted">
            {t('Live schema: version', 'Schéma actif : version')} {published.version}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <div className="card flex h-fit flex-col gap-2 p-4">
          <p className="micro-label text-ink-muted">{t('Record types', 'Types d’enregistrement')}</p>
          <div className="flex flex-col gap-1">
            {definition.recordTypes.map((recordType, index) => (
              <div
                key={index}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                  index === selectedTypeIndex ? 'bg-navy-wash text-navy' : 'text-ink-muted hover:bg-navy-wash/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTypeIndex(index)}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                >
                  {recordType.label.en || recordType.label.fr || recordType.key || t('Untitled', 'Sans titre')}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveRecordType(index)}
                  aria-label={t('Remove record type', 'Supprimer le type')}
                  className="shrink-0 text-ink-muted hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddRecordType}
            className="btn-ghost mt-2 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> {t('Add record type', 'Ajouter un type')}
          </button>
        </div>

        <div className="flex flex-col gap-6">
          {!selectedType && (
            <div className="card p-8 text-center text-sm text-ink-muted">
              {t('Add a record type to get started.', 'Ajoutez un type d’enregistrement pour commencer.')}
            </div>
          )}

          {selectedType && (
            <>
              <div className="card p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="micro-label text-ink-muted" htmlFor="rt-key">
                      {t('Key', 'Clé')}
                    </label>
                    <input
                      id="rt-key"
                      type="text"
                      value={selectedType.key}
                      onChange={(event) =>
                        dispatch({ type: 'SET_TYPE_KEY', typeIndex: selectedTypeIndex, value: event.target.value })
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="micro-label text-ink-muted" htmlFor="rt-label-en">
                      {t('Label (English)', 'Libellé (anglais)')}
                    </label>
                    <input
                      id="rt-label-en"
                      type="text"
                      value={selectedType.label.en}
                      onChange={(event) =>
                        dispatch({
                          type: 'SET_TYPE_LABEL',
                          typeIndex: selectedTypeIndex,
                          lang: 'en',
                          value: event.target.value,
                        })
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="micro-label text-ink-muted" htmlFor="rt-label-fr">
                      {t('Label (French)', 'Libellé (français)')}
                    </label>
                    <input
                      id="rt-label-fr"
                      type="text"
                      value={selectedType.label.fr}
                      onChange={(event) =>
                        dispatch({
                          type: 'SET_TYPE_LABEL',
                          typeIndex: selectedTypeIndex,
                          lang: 'fr',
                          value: event.target.value,
                        })
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <p className="micro-label text-ink-muted">{t('Fields', 'Champs')}</p>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'ADD_FIELD', typeIndex: selectedTypeIndex })}
                    className="btn-ghost flex h-9 items-center justify-center gap-2 px-3 text-xs"
                  >
                    <Plus size={14} /> {t('Add field', 'Ajouter un champ')}
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  {selectedType.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="rounded-xl border border-navy-border p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_150px_auto_auto] sm:items-end">
                        <div>
                          <span className="micro-label text-ink-muted">{t('Key', 'Clé')}</span>
                          <input
                            aria-label={t('Field key', 'Clé du champ')}
                            type="text"
                            value={field.key}
                            onChange={(event) =>
                              dispatch({
                                type: 'UPDATE_FIELD',
                                typeIndex: selectedTypeIndex,
                                fieldIndex,
                                patch: { key: event.target.value },
                              })
                            }
                            className={`mt-1 ${inputClass}`}
                          />
                        </div>
                        <div>
                          <span className="micro-label text-ink-muted">{t('Label (EN)', 'Libellé (EN)')}</span>
                          <input
                            aria-label={t('Field label (English)', 'Libellé du champ (anglais)')}
                            type="text"
                            value={field.label.en}
                            onChange={(event) =>
                              dispatch({
                                type: 'UPDATE_FIELD',
                                typeIndex: selectedTypeIndex,
                                fieldIndex,
                                patch: { label: { ...field.label, en: event.target.value } },
                              })
                            }
                            className={`mt-1 ${inputClass}`}
                          />
                        </div>
                        <div>
                          <span className="micro-label text-ink-muted">{t('Label (FR)', 'Libellé (FR)')}</span>
                          <input
                            aria-label={t('Field label (French)', 'Libellé du champ (français)')}
                            type="text"
                            value={field.label.fr}
                            onChange={(event) =>
                              dispatch({
                                type: 'UPDATE_FIELD',
                                typeIndex: selectedTypeIndex,
                                fieldIndex,
                                patch: { label: { ...field.label, fr: event.target.value } },
                              })
                            }
                            className={`mt-1 ${inputClass}`}
                          />
                        </div>
                        <div>
                          <span className="micro-label text-ink-muted">{t('Type', 'Type')}</span>
                          <select
                            aria-label={t('Field type', 'Type de champ')}
                            value={field.type}
                            onChange={(event) =>
                              handleFieldTypeChange(fieldIndex, event.target.value as PlatformFieldType, field)
                            }
                            className={`mt-1 ${inputClass}`}
                          >
                            {FIELD_TYPES.map((fieldType) => (
                              <option key={fieldType} value={fieldType}>
                                {fieldTypeLabel(fieldType, t)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex items-center gap-2 pb-2">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={() =>
                              dispatch({
                                type: 'UPDATE_FIELD',
                                typeIndex: selectedTypeIndex,
                                fieldIndex,
                                patch: { required: !field.required },
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
                          />
                          <span className="text-xs text-ink-muted">{t('Required', 'Requis')}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'REMOVE_FIELD', typeIndex: selectedTypeIndex, fieldIndex })}
                          aria-label={t('Remove field', 'Supprimer le champ')}
                          className="pb-2 text-ink-muted hover:text-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {field.type === 'number' && (
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xs">
                          <div>
                            <span className="micro-label text-ink-muted">{t('Min', 'Min')}</span>
                            <input
                              aria-label={t('Minimum value', 'Valeur minimale')}
                              type="number"
                              value={field.min ?? ''}
                              onChange={(event) =>
                                dispatch({
                                  type: 'UPDATE_FIELD',
                                  typeIndex: selectedTypeIndex,
                                  fieldIndex,
                                  patch: { min: event.target.value === '' ? undefined : Number(event.target.value) },
                                })
                              }
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <span className="micro-label text-ink-muted">{t('Max', 'Max')}</span>
                            <input
                              aria-label={t('Maximum value', 'Valeur maximale')}
                              type="number"
                              value={field.max ?? ''}
                              onChange={(event) =>
                                dispatch({
                                  type: 'UPDATE_FIELD',
                                  typeIndex: selectedTypeIndex,
                                  fieldIndex,
                                  patch: { max: event.target.value === '' ? undefined : Number(event.target.value) },
                                })
                              }
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                        </div>
                      )}

                      {(field.type === 'select' || field.type === 'multi_select') && (
                        <div className="mt-3 flex flex-col gap-2 rounded-lg bg-navy-wash/40 p-3">
                          <p className="micro-label text-ink-muted">{t('Options', 'Options')}</p>
                          {(field.options ?? []).map((option, optionIndex) => (
                            <div key={optionIndex} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                              <input
                                aria-label={t('Option value', 'Valeur de l’option')}
                                type="text"
                                placeholder={t('Value', 'Valeur')}
                                value={option.value}
                                onChange={(event) =>
                                  dispatch({
                                    type: 'UPDATE_OPTION',
                                    typeIndex: selectedTypeIndex,
                                    fieldIndex,
                                    optionIndex,
                                    patch: { value: event.target.value },
                                  })
                                }
                                className={`${inputClass} h-9`}
                              />
                              <input
                                aria-label={t('Option label (English)', 'Libellé de l’option (anglais)')}
                                type="text"
                                placeholder={t('Label (EN)', 'Libellé (EN)')}
                                value={option.label.en}
                                onChange={(event) =>
                                  dispatch({
                                    type: 'UPDATE_OPTION',
                                    typeIndex: selectedTypeIndex,
                                    fieldIndex,
                                    optionIndex,
                                    patch: { label: { ...option.label, en: event.target.value } },
                                  })
                                }
                                className={`${inputClass} h-9`}
                              />
                              <input
                                aria-label={t('Option label (French)', 'Libellé de l’option (français)')}
                                type="text"
                                placeholder={t('Label (FR)', 'Libellé (FR)')}
                                value={option.label.fr}
                                onChange={(event) =>
                                  dispatch({
                                    type: 'UPDATE_OPTION',
                                    typeIndex: selectedTypeIndex,
                                    fieldIndex,
                                    optionIndex,
                                    patch: { label: { ...option.label, fr: event.target.value } },
                                  })
                                }
                                className={`${inputClass} h-9`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  dispatch({ type: 'REMOVE_OPTION', typeIndex: selectedTypeIndex, fieldIndex, optionIndex })
                                }
                                aria-label={t('Remove option', 'Supprimer l’option')}
                                className="text-ink-muted hover:text-danger"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'ADD_OPTION', typeIndex: selectedTypeIndex, fieldIndex })}
                            className="micro-label mt-1 flex items-center gap-1 self-start text-navy hover:underline"
                          >
                            <Plus size={14} /> {t('Add option', 'Ajouter une option')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <p className="micro-label text-ink-muted">{t('Evidence requirements', 'Exigences de preuve')}</p>
                <div className="mt-4 flex flex-col gap-4">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-ink">{t('Require GPS location', 'Exiger la position GPS')}</span>
                    <input
                      type="checkbox"
                      checked={selectedType.evidence.gpsRequired}
                      onChange={() =>
                        dispatch({
                          type: 'UPDATE_EVIDENCE',
                          typeIndex: selectedTypeIndex,
                          patch: { gpsRequired: !selectedType.evidence.gpsRequired },
                        })
                      }
                      className="h-5 w-5 rounded border-gray-300 text-navy focus:ring-navy"
                    />
                  </label>
                  {selectedType.evidence.gpsRequired && (
                    <div className="max-w-xs">
                      <label className="micro-label text-ink-muted" htmlFor="rt-gps-accuracy">
                        {t('Max accuracy (meters)', 'Précision max (mètres)')}
                      </label>
                      <input
                        id="rt-gps-accuracy"
                        type="number"
                        min={1}
                        value={selectedType.evidence.gpsAccuracyMeters ?? ''}
                        placeholder={t('No limit', 'Aucune limite')}
                        onChange={(event) =>
                          dispatch({
                            type: 'UPDATE_EVIDENCE',
                            typeIndex: selectedTypeIndex,
                            patch: {
                              gpsAccuracyMeters: event.target.value === '' ? undefined : Number(event.target.value),
                            },
                          })
                        }
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink">{t('Minimum photos', 'Photos minimum')}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: 'UPDATE_EVIDENCE',
                            typeIndex: selectedTypeIndex,
                            patch: { minPhotos: Math.max(0, selectedType.evidence.minPhotos - 1) },
                          })
                        }
                        disabled={selectedType.evidence.minPhotos <= 0}
                        aria-label={t('Decrease minimum photos', 'Diminuer le nombre minimum de photos')}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-navy-border text-ink disabled:opacity-40"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-ink">
                        {selectedType.evidence.minPhotos}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: 'UPDATE_EVIDENCE',
                            typeIndex: selectedTypeIndex,
                            patch: { minPhotos: Math.min(10, selectedType.evidence.minPhotos + 1) },
                          })
                        }
                        disabled={selectedType.evidence.minPhotos >= 10}
                        aria-label={t('Increase minimum photos', 'Augmenter le nombre minimum de photos')}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-navy-border text-ink disabled:opacity-40"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-ink">{t('Require notes', 'Exiger des notes')}</span>
                    <input
                      type="checkbox"
                      checked={selectedType.evidence.notesRequired}
                      onChange={() =>
                        dispatch({
                          type: 'UPDATE_EVIDENCE',
                          typeIndex: selectedTypeIndex,
                          patch: { notesRequired: !selectedType.evidence.notesRequired },
                        })
                      }
                      className="h-5 w-5 rounded border-gray-300 text-navy focus:ring-navy"
                    />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card p-5">
        {issues.length > 0 && (
          <div className="mb-4">
            <p className="micro-label text-danger">
              {t('Issues', 'Problèmes')} ({issues.length})
            </p>
            <ul className="mt-2 space-y-1">
              {issues.map((issue, index) => (
                <li key={`${issue.path}-${index}`} className="text-xs text-danger">
                  <span className="font-mono text-[10px] text-ink-muted">{issue.path || '(root)'}</span> — {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {saveError && (
          <p className="mb-3 text-xs text-danger" role="alert">
            {saveError}
          </p>
        )}
        {publishError && (
          <p className="mb-3 text-xs text-danger" role="alert">
            {publishError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="micro-label text-ink-muted">
            {isDirty ? t('Unsaved changes', 'Modifications non enregistrées') : t('All changes saved', 'Toutes les modifications sont enregistrées')}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={!canSave}
              className="btn-ghost flex items-center justify-center px-5 disabled:opacity-50"
            >
              {isBusy ? t('Saving…', 'Enregistrement…') : t('Save draft', 'Enregistrer le brouillon')}
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={!canPublish}
              className="btn-primary flex items-center justify-center px-5 disabled:opacity-50"
            >
              {t(`Publish version ${nextPublishVersion}`, `Publier la version ${nextPublishVersion}`)}
            </button>
          </div>
        </div>
        {!draft && !isDirty && issues.length === 0 && (
          <p className="mt-2 text-xs text-ink-muted">
            {t('Nothing to publish yet — save a draft first.', 'Rien à publier pour le moment — enregistrez d’abord un brouillon.')}
          </p>
        )}
      </div>

      <div className="card p-5">
        <p className="micro-label text-ink-muted">{t('Published version history', 'Historique des versions publiées')}</p>
        {publishedHistory.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{t('No versions published yet.', 'Aucune version publiée pour le moment.')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-navy-border">
            {publishedHistory.map((version) => (
              <li key={version.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-ink">
                  {t('Version', 'Version')} {version.version}
                </span>
                <span className="text-ink-muted">{version.publishedAt ? formatDate(version.publishedAt, language) : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
