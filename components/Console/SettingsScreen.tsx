import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { updateOrganizationRequest, PlatformApiError } from '../../lib/client/platformApi';
import type { PlatformOrganization, PlatformRole } from '../../shared/platformTypes';

export interface SettingsScreenProps {
  organizationId: string;
  organization: PlatformOrganization & { role: PlatformRole };
  language: 'en' | 'fr';
  onOrganizationUpdated: (organization: PlatformOrganization) => void;
}

const DEFAULT_ACCENT = '#c86b4a';
const MAX_LOGO_FILE_BYTES = 1_000_000;
// Server-side cap (lib/server/platform/validation.ts MAX_LOGO_DATA_URL_LENGTH)
// on the base64 data: URL string, not the raw file — a 1MB file base64-encodes
// to ~1.37MB of characters, so this has to be checked separately from the
// raw-byte guard above.
const MAX_LOGO_DATA_URL_LENGTH = 800_000;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Same error-copy convention as ProjectsScreen/MembersScreen (Tasks 13-14):
 * server body.error (via PlatformApiError.message) for 4xx, generic bilingual
 * fallback for 5xx.
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({
  organizationId,
  organization,
  language,
  onOrganizationUpdated,
}) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);
  const isOwner = organization.role === 'owner';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(organization.name);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [colorHex, setColorHex] = useState(organization.accentColor ?? DEFAULT_ACCENT);
  const [colorBusy, setColorBusy] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);

  // Reset local edit state when the selected organization changes (e.g. the
  // sidebar org switcher), so stale edits from a previous org never leak in.
  useEffect(() => {
    setName(organization.name);
    setNameError(null);
    setLogoError(null);
    setColorHex(organization.accentColor ?? DEFAULT_ACCENT);
    setColorError(null);
  }, [organizationId]);

  const trimmedName = name.trim();
  const isNameDirty = trimmedName.length > 0 && trimmedName !== organization.name;
  const isColorValid = HEX_COLOR_PATTERN.test(colorHex.trim());
  const isColorDirty = isColorValid && colorHex.trim().toLowerCase() !== (organization.accentColor ?? DEFAULT_ACCENT).toLowerCase();

  const handleSaveName = async () => {
    if (!isOwner || !isNameDirty) return;
    setNameError(null);
    setNameBusy(true);
    try {
      const updated = await updateOrganizationRequest({ organizationId, name: trimmedName });
      onOrganizationUpdated(updated);
      setName(updated.name);
    } catch (error) {
      setNameError(describeError(error, t));
    } finally {
      setNameBusy(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    // Allow re-selecting the same file later.
    event.target.value = '';
    if (!file || !isOwner) return;

    if (file.size > MAX_LOGO_FILE_BYTES) {
      setLogoError(t('Logo must be smaller than 1 MB.', 'Le logo doit faire moins de 1 Mo.'));
      return;
    }

    setLogoError(null);
    setLogoBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
        setLogoError(t('Logo must be smaller than 1 MB.', 'Le logo doit faire moins de 1 Mo.'));
        return;
      }
      const updated = await updateOrganizationRequest({ organizationId, logoDataUrl: dataUrl });
      onOrganizationUpdated(updated);
    } catch (error) {
      setLogoError(describeError(error, t));
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!isOwner || !organization.logoUrl) return;
    setLogoError(null);
    setLogoBusy(true);
    try {
      const updated = await updateOrganizationRequest({ organizationId, clearLogo: true });
      onOrganizationUpdated(updated);
    } catch (error) {
      setLogoError(describeError(error, t));
    } finally {
      setLogoBusy(false);
    }
  };

  const handleSaveColor = async () => {
    if (!isOwner) return;
    const trimmed = colorHex.trim();
    if (!HEX_COLOR_PATTERN.test(trimmed)) {
      setColorError(t('Enter a valid hex color, e.g. #c86b4a.', 'Entrez une couleur hexadécimale valide, p. ex. #c86b4a.'));
      return;
    }
    setColorError(null);
    setColorBusy(true);
    try {
      const updated = await updateOrganizationRequest({ organizationId, accentColor: trimmed });
      onOrganizationUpdated(updated);
      setColorHex(updated.accentColor ?? trimmed);
    } catch (error) {
      setColorError(describeError(error, t));
    } finally {
      setColorBusy(false);
    }
  };

  const initial = (organization.name ?? 'A').trim().charAt(0).toUpperCase() || 'A';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('Settings', 'Paramètres')}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t(
            'Manage your workspace name, logo, and brand accent color.',
            "Gérez le nom, le logo et la couleur d'accent de votre espace de travail.",
          )}
        </p>
      </div>

      {!isOwner && (
        <div className="card border border-navy-border bg-navy-wash p-4">
          <p className="text-sm text-navy" role="status">
            {t('Only owners can change workspace settings', 'Seuls les propriétaires peuvent modifier les paramètres')}
          </p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">{t('Workspace name', "Nom de l'espace de travail")}</h2>
        <div className="mt-4 space-y-2">
          <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="workspace-name">
            {t('Name', 'Nom')}
          </label>
          <input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!isOwner || nameBusy}
            className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
          />
        </div>
        {nameError && (
          <p className="mt-3 text-xs text-danger" role="alert">
            {nameError}
          </p>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={() => void handleSaveName()}
            disabled={nameBusy || !isNameDirty}
            className="btn-primary mt-4 flex w-full items-center justify-center disabled:opacity-50"
          >
            {nameBusy ? t('Saving…', 'Enregistrement…') : t('Save name', 'Enregistrer le nom')}
          </button>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">{t('Logo', 'Logo')}</h2>
        <div className="mt-4 flex items-center gap-4">
          {organization.logoUrl ? (
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-terra text-lg font-bold text-white">
              {initial}
            </div>
          )}
          {isOwner && (
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoBusy}
                className="btn-ghost flex flex-1 items-center justify-center gap-2 disabled:opacity-50"
              >
                <ImagePlus size={16} />
                {logoBusy ? t('Uploading…', 'Téléversement…') : t('Upload logo', 'Téléverser un logo')}
              </button>
              {organization.logoUrl && (
                <button
                  type="button"
                  onClick={() => void handleRemoveLogo()}
                  disabled={logoBusy}
                  aria-label={t('Remove logo', 'Supprimer le logo')}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-navy-border text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => void handleFileChange(event)}
            className="hidden"
          />
        </div>
        {isOwner && (
          <p className="mt-3 text-xs text-ink-muted">
            {t('PNG or JPEG, up to 1 MB.', 'PNG ou JPEG, jusqu’à 1 Mo.')}
          </p>
        )}
        {logoError && (
          <p className="mt-3 text-xs text-danger" role="alert">
            {logoError}
          </p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">{t('Accent color', "Couleur d'accent")}</h2>
        <div className="mt-4 flex items-center gap-3">
          <div
            aria-hidden="true"
            className="h-14 w-14 shrink-0 rounded-2xl border border-navy-border"
            style={{ backgroundColor: isColorValid ? colorHex : '#ffffff' }}
          />
          <input
            type="color"
            aria-label={t('Pick accent color', "Choisir la couleur d'accent")}
            value={isColorValid ? colorHex : DEFAULT_ACCENT}
            onChange={(event) => setColorHex(event.target.value)}
            disabled={!isOwner || colorBusy}
            className="h-14 w-14 shrink-0 cursor-pointer rounded-2xl border border-gray-100 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <input
            type="text"
            value={colorHex}
            onChange={(event) => setColorHex(event.target.value)}
            disabled={!isOwner || colorBusy}
            placeholder="#c86b4a"
            aria-label={t('Accent color hex code', "Code hexadécimal de la couleur d'accent")}
            className="h-14 flex-1 rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
          />
        </div>
        {colorError && (
          <p className="mt-3 text-xs text-danger" role="alert">
            {colorError}
          </p>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={() => void handleSaveColor()}
            disabled={colorBusy || !isColorDirty}
            className="btn-primary mt-4 flex w-full items-center justify-center disabled:opacity-50"
          >
            {colorBusy ? t('Saving…', 'Enregistrement…') : t('Save accent color', "Enregistrer la couleur d'accent")}
          </button>
        )}
      </div>
    </div>
  );
};

export default SettingsScreen;
