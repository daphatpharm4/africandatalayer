import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Code, Eye, FileText, Heading2, Italic, Link2, List, Loader2, Mail, MessageSquare, Send, Trash2, Wand2, X } from 'lucide-react';
import { apiJson } from '../../lib/client/api';

type Channel = 'email' | 'sms' | 'templates' | 'history';

interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  subjectEn: string;
  subjectFr: string;
  htmlEn: string;
  htmlFr: string;
  textEn: string;
  textFr: string;
  variables: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplatesListResponse {
  templates: TemplateRow[];
}

const KNOWN_VARS = ['firstName', 'name', 'city', 'role', 'trustTier', 'language'] as const;

interface AudienceFilter {
  roles?: Array<'agent' | 'admin' | 'client'>;
  trustTiers?: Array<'new' | 'standard' | 'trusted' | 'elite' | 'restricted'>;
  mapScopes?: string[];
  requireEmailOptIn?: boolean;
  lastActiveDays?: number;
}

interface AudiencePreviewResponse {
  recipientCount: number;
  totalCount: number;
  suppressedCount: number;
  maxRecipients: number;
}

interface CampaignRow {
  id: string;
  subject: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface SmsCampaignRow extends Omit<CampaignRow, 'subject'> {
  message: string;
}

interface CampaignsListResponse {
  campaigns: CampaignRow[];
  maxRecipients: number;
}

interface SmsCampaignsListResponse {
  campaigns: SmsCampaignRow[];
  maxRecipients: number;
}

interface CreateCampaignResponse {
  id: string;
  status: string;
  recipientCount: number;
  suppressedCount?: number;
  capped: boolean;
  segmentsPerRecipient?: number;
  estimatedCostUnits?: number | null;
}

interface Props {
  language: 'en' | 'fr';
}

const ROLE_OPTIONS: Array<NonNullable<AudienceFilter['roles']>[number]> = ['agent', 'admin', 'client'];
const TRUST_TIER_OPTIONS: Array<NonNullable<AudienceFilter['trustTiers']>[number]> = [
  'new', 'standard', 'trusted', 'elite', 'restricted',
];

function deriveTextFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>(?:\s*)/gi, "\n")
    .replace(/<\/(p|div|h[1-4]|li|tr|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapSelection(value: string, start: number, end: number, before: string, after: string): { value: string; cursor: number } {
  const selected = value.slice(start, end) || "text";
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  return { value: next, cursor: start + before.length + selected.length };
}

function gsmSegmentCount(message: string): number {
  if (!message) return 0;
  let isAscii = true;
  for (let i = 0; i < message.length; i += 1) {
    const code = message.charCodeAt(i);
    if (code === 0x0a || code === 0x0d) continue;
    if (code < 0x20 || code > 0x7e) { isAscii = false; break; }
  }
  const limit = isAscii ? 160 : 70;
  return Math.max(1, Math.ceil(message.length / limit));
}

const CommunicationsPanel: React.FC<Props> = ({ language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const [channel, setChannel] = useState<Channel>('email');
  const [audience, setAudience] = useState<AudienceFilter>({ requireEmailOptIn: true });
  const [preview, setPreview] = useState<AudiencePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [emailSubject, setEmailSubject] = useState('');
  const [emailHtml, setEmailHtml] = useState('');
  const [emailText, setEmailText] = useState('');
  const [emailLanguage, setEmailLanguage] = useState<'en' | 'fr'>(language);

  const [smsMessage, setSmsMessage] = useState('');
  const [smsLanguage, setSmsLanguage] = useState<'en' | 'fr'>(language);
  const [acknowledgeCost, setAcknowledgeCost] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const htmlAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const [emailCampaigns, setEmailCampaigns] = useState<CampaignRow[]>([]);
  const [smsCampaigns, setSmsCampaigns] = useState<SmsCampaignRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [tplDraft, setTplDraft] = useState({
    slug: '', name: '',
    subjectEn: '', subjectFr: '',
    htmlEn: '', htmlFr: '',
    textEn: '', textFr: '',
  });

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const params = new URLSearchParams({ view: 'audience-preview', audience: JSON.stringify(audience) });
      const data = await apiJson<AudiencePreviewResponse>(`/api/privacy?${params.toString()}`);
      setPreview(data);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'preview_failed');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [audience]);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [emailResult, smsResult] = await Promise.all([
        apiJson<CampaignsListResponse>('/api/privacy?view=campaigns'),
        apiJson<SmsCampaignsListResponse>('/api/privacy?view=sms-campaigns'),
      ]);
      setEmailCampaigns(emailResult.campaigns ?? []);
      setSmsCampaigns(smsResult.campaigns ?? []);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'history_failed');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (channel === 'history') void refreshHistory();
  }, [channel, refreshHistory]);

  const refreshTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const data = await apiJson<TemplatesListResponse>('/api/privacy?view=email-templates');
      setTemplates(data.templates ?? []);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'templates_failed');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (channel === 'templates') void refreshTemplates();
  }, [channel, refreshTemplates]);

  const startEditTemplate = (template: TemplateRow | null) => {
    setEditingTemplate(template);
    setTplDraft(
      template
        ? {
            slug: template.slug,
            name: template.name,
            subjectEn: template.subjectEn,
            subjectFr: template.subjectFr,
            htmlEn: template.htmlEn,
            htmlFr: template.htmlFr,
            textEn: template.textEn,
            textFr: template.textFr,
          }
        : {
            slug: '', name: '',
            subjectEn: '', subjectFr: '',
            htmlEn: '', htmlFr: '',
            textEn: '', textFr: '',
          },
    );
  };

  const saveTemplate = async () => {
    setActionMessage('');
    setActionError('');
    try {
      const body = editingTemplate ? { id: editingTemplate.id, ...tplDraft } : tplDraft;
      await apiJson('/api/privacy?view=email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setActionMessage(t('Template saved.', 'Modèle enregistré.'));
      setEditingTemplate(null);
      await refreshTemplates();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'save_failed');
    }
  };

  const archiveTemplateRow = async (id: string) => {
    setActionMessage('');
    setActionError('');
    try {
      await apiJson('/api/privacy?view=email-templates:archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setActionMessage(t('Template archived.', 'Modèle archivé.'));
      await refreshTemplates();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'archive_failed');
    }
  };

  const loadTemplateIntoComposer = (template: TemplateRow) => {
    const useFr = emailLanguage === 'fr';
    setEmailSubject(useFr ? template.subjectFr : template.subjectEn);
    setEmailHtml(useFr ? template.htmlFr : template.htmlEn);
    setEmailText(useFr ? template.textFr : template.textEn);
    setChannel('email');
    setActionMessage(t(`Loaded template "${template.name}"`, `Modèle "${template.name}" chargé`));
  };

  const insertVariable = (target: 'subject' | 'html' | 'text', name: string) => {
    const placeholder = `{${name}}`;
    if (target === 'subject') setEmailSubject((prev) => prev + placeholder);
    if (target === 'html') setEmailHtml((prev) => prev + placeholder);
    if (target === 'text') setEmailText((prev) => prev + placeholder);
  };

  const applyFormatting = (before: string, after: string) => {
    const area = htmlAreaRef.current;
    if (!area) return;
    const start = area.selectionStart ?? area.value.length;
    const end = area.selectionEnd ?? area.value.length;
    const result = wrapSelection(area.value, start, end, before, after);
    setEmailHtml(result.value);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(result.cursor, result.cursor);
    });
  };

  const insertLink = () => {
    const href = window.prompt(t('Link URL', 'URL du lien') ?? '', 'https://');
    if (!href) return;
    applyFormatting(`<a href="${href}">`, '</a>');
  };

  const deriveTextFromHtmlBody = () => {
    setEmailText(deriveTextFromHtml(emailHtml));
  };

  const toggleRole = (role: NonNullable<AudienceFilter['roles']>[number]) => {
    setAudience((prev) => {
      const set = new Set(prev.roles ?? []);
      if (set.has(role)) set.delete(role);
      else set.add(role);
      return { ...prev, roles: set.size > 0 ? Array.from(set) : undefined };
    });
  };

  const toggleTier = (tier: NonNullable<AudienceFilter['trustTiers']>[number]) => {
    setAudience((prev) => {
      const set = new Set(prev.trustTiers ?? []);
      if (set.has(tier)) set.delete(tier);
      else set.add(tier);
      return { ...prev, trustTiers: set.size > 0 ? Array.from(set) : undefined };
    });
  };

  const segmentCount = useMemo(() => gsmSegmentCount(smsMessage), [smsMessage]);
  const totalSmsSegments = segmentCount * (preview?.recipientCount ?? 0);

  const canSendEmail =
    !submitting &&
    emailSubject.trim().length > 0 &&
    emailHtml.trim().length > 0 &&
    emailText.trim().length > 0 &&
    (preview?.recipientCount ?? 0) > 0;

  const canSendSms =
    !submitting &&
    smsMessage.trim().length > 0 &&
    smsMessage.length <= 459 &&
    (preview?.recipientCount ?? 0) > 0 &&
    acknowledgeCost;

  const scheduledAtIso = useMemo(() => {
    if (!scheduledAtLocal) return null;
    const t = new Date(scheduledAtLocal).getTime();
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }, [scheduledAtLocal]);

  const sendEmail = async (dryRun: boolean) => {
    setActionMessage('');
    setActionError('');
    setSubmitting(true);
    try {
      const body = {
        subject: emailSubject,
        htmlBody: emailHtml,
        textBody: emailText,
        language: emailLanguage,
        audience,
        dryRun,
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      };
      const result = await apiJson<CreateCampaignResponse>('/api/privacy?view=campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setActionMessage(
        dryRun
          ? t(`Dry-run created (${result.recipientCount} recipients)`, `Test créé (${result.recipientCount} destinataires)`)
          : t(`Campaign sent to ${result.recipientCount} recipients.`, `Campagne envoyée à ${result.recipientCount} destinataires.`),
      );
      await refreshHistory();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'send_failed');
    } finally {
      setSubmitting(false);
    }
  };

  const sendSms = async (dryRun: boolean) => {
    setActionMessage('');
    setActionError('');
    setSubmitting(true);
    try {
      const body = {
        message: smsMessage,
        language: smsLanguage,
        audience,
        dryRun,
        acknowledgeCost,
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      };
      const result = await apiJson<CreateCampaignResponse>('/api/privacy?view=sms-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setActionMessage(
        dryRun
          ? t(`Dry-run: ${result.recipientCount} recipients × ${result.segmentsPerRecipient ?? 1} segments`, `Test : ${result.recipientCount} destinataires × ${result.segmentsPerRecipient ?? 1} segments`)
          : t(`SMS sent to ${result.recipientCount} recipients.`, `SMS envoyés à ${result.recipientCount} destinataires.`),
      );
      await refreshHistory();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'send_failed');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelCampaign = async (id: string, kind: 'email' | 'sms') => {
    setActionMessage('');
    setActionError('');
    try {
      const view = kind === 'email' ? 'campaigns:cancel' : 'sms-campaigns:cancel';
      await apiJson(`/api/privacy?view=${view}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setActionMessage(t('Campaign cancelled.', 'Campagne annulée.'));
      await refreshHistory();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'cancel_failed');
    }
  };

  const channelTabs: Array<[Channel, string, React.ReactNode]> = [
    ['email', t('Email', 'E-mail'), <Mail key="i" size={14} />],
    ['sms', t('SMS', 'SMS'), <MessageSquare key="i" size={14} />],
    ['templates', t('Templates', 'Modèles'), <FileText key="i" size={14} />],
    ['history', t('History', 'Historique'), <Loader2 key="i" size={14} />],
  ];

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-1">
        <div className="micro-label-wide text-navy">{t('Communications', 'Communications')}</div>
        <div className="text-lg font-bold text-ink-dark">
          {t('Email + SMS broadcaster', 'Diffusion e-mail + SMS')}
        </div>
        <div className="text-xs text-gray-500">
          {t(
            'Compose and send to filtered audiences. Dry-run before send. Suppression and opt-out enforced server-side.',
            'Composez et envoyez à des audiences filtrées. Test avant envoi. Désinscription appliquée côté serveur.',
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {channelTabs.map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={channel === key}
            onClick={() => setChannel(key)}
            className={`flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-bold uppercase tracking-wider ${
              channel === key ? 'bg-navy text-white' : 'bg-page text-gray-600 border border-gray-100'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {channel !== 'history' && channel !== 'templates' && (
        <div className="rounded-2xl border border-gray-100 bg-page p-3 space-y-3">
          <div className="micro-label text-gray-500">{t('Audience', 'Audience')}</div>

          <div>
            <div className="micro-label text-gray-400 mb-1">{t('Roles', 'Rôles')}</div>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_OPTIONS.map((role) => {
                const active = (audience.roles ?? []).includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`h-8 rounded-full px-3 text-[11px] font-semibold ${
                      active ? 'bg-navy text-white' : 'border border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="micro-label text-gray-400 mb-1">{t('Trust tier', 'Niveau de confiance')}</div>
            <div className="flex flex-wrap gap-1.5">
              {TRUST_TIER_OPTIONS.map((tier) => {
                const active = (audience.trustTiers ?? []).includes(tier);
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => toggleTier(tier)}
                    className={`h-8 rounded-full px-3 text-[11px] font-semibold ${
                      active ? 'bg-forest text-white' : 'border border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {tier}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span>{t('Active in last (days)', 'Actif dans les (jours)')}</span>
              <input
                type="number"
                min={1}
                value={audience.lastActiveDays ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setAudience((prev) => ({
                    ...prev,
                    lastActiveDays: value ? Math.max(1, Math.floor(Number(value))) : undefined,
                  }));
                }}
                className="h-9 w-20 rounded-xl border border-gray-200 bg-white px-2 text-sm"
              />
            </label>
            {channel === 'email' && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={audience.requireEmailOptIn !== false}
                  onChange={(e) =>
                    setAudience((prev) => ({ ...prev, requireEmailOptIn: e.target.checked }))
                  }
                />
                {t('Require email opt-in', "Exiger l'opt-in e-mail")}
              </label>
            )}
            <button
              type="button"
              onClick={refreshPreview}
              disabled={previewLoading}
              className="ml-auto h-9 rounded-full border border-gray-200 bg-white px-3 text-[11px] font-semibold text-gray-700"
            >
              {previewLoading ? t('Refreshing…', 'Actualisation…') : t('Refresh preview', 'Actualiser')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-600">
            <span className="micro-label text-gray-400">{t('Schedule send', 'Planifier')}</span>
            <input
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-page px-2 text-xs"
            />
            {scheduledAtLocal && (
              <button
                type="button"
                onClick={() => setScheduledAtLocal('')}
                className="text-[11px] text-gray-500 underline"
              >
                {t('Clear', 'Effacer')}
              </button>
            )}
            <span className="ml-auto text-[10px] text-gray-400">
              {scheduledAtIso
                ? t('Will send via cron drain when due', "S'enverra via le cron à l'heure prévue")
                : t('Empty = send now', "Vide = envoyer maintenant")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white border border-gray-100 px-3 py-2 text-xs text-gray-600">
            {previewError ? (
              <span className="text-red-600">{previewError}</span>
            ) : preview ? (
              <>
                <span>
                  <strong className="text-navy">{preview.recipientCount}</strong>
                  {' '}{t('matched', 'correspondants')}
                </span>
                <span>· {preview.suppressedCount} {t('suppressed', 'supprimés')}</span>
                <span>· {t('cap', 'limite')} {preview.maxRecipients}</span>
              </>
            ) : (
              <span>{t('No preview yet.', 'Aucun aperçu.')}</span>
            )}
          </div>
        </div>
      )}

      {channel === 'email' && (
        <div className="space-y-3">
          {templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2">
              <span className="micro-label text-gray-500">{t('Load template', 'Charger un modèle')}</span>
              {templates.slice(0, 6).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => loadTemplateIntoComposer(tpl)}
                  className="h-7 rounded-full border border-gray-200 bg-page px-2 text-[11px] font-semibold text-navy hover:bg-navy-wash"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 bg-white px-3 py-2">
            <span className="micro-label text-gray-500">{t('Insert variable', 'Insérer variable')}</span>
            {KNOWN_VARS.map((name) => (
              <div key={name} className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => insertVariable('subject', name)}
                  title={t('Insert into subject', 'Insérer dans le sujet')}
                  className="h-7 rounded-l-full border border-r-0 border-gray-200 bg-page px-2 text-[10px] font-mono text-gray-600 hover:bg-navy-wash"
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('html', name)}
                  title={t('Insert into HTML body', 'Insérer dans le corps HTML')}
                  className="h-7 border border-r-0 border-gray-200 bg-page px-2 text-[11px] font-mono text-gray-700 hover:bg-navy-wash"
                >
                  {`{${name}}`}
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('text', name)}
                  title={t('Insert into text body', 'Insérer dans le texte')}
                  className="h-7 rounded-r-full border border-gray-200 bg-page px-2 text-[10px] font-mono text-gray-600 hover:bg-navy-wash"
                >
                  T
                </button>
              </div>
            ))}
          </div>

          <input
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder={t('Subject', 'Sujet')}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
          />
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 bg-white px-2 py-1.5">
            <button
              type="button"
              onClick={() => applyFormatting('<strong>', '</strong>')}
              title="Bold"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-page text-gray-700 hover:bg-navy-wash"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('<em>', '</em>')}
              title="Italic"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-page text-gray-700 hover:bg-navy-wash"
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('<h2>', '</h2>')}
              title="Heading"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-page text-gray-700 hover:bg-navy-wash"
            >
              <Heading2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('<ul>\n  <li>', '</li>\n</ul>')}
              title="List"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-page text-gray-700 hover:bg-navy-wash"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={insertLink}
              title="Link"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-page text-gray-700 hover:bg-navy-wash"
            >
              <Link2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('<code>', '</code>')}
              title="Inline code"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-page text-gray-700 hover:bg-navy-wash"
            >
              <Code size={14} />
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              title={t('Toggle preview', 'Afficher/masquer aperçu')}
              className={`ml-auto flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold ${
                showPreview ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-page text-gray-700'
              }`}
            >
              <Eye size={12} />
              {showPreview ? t('Preview on', 'Aperçu') : t('Preview off', 'Aperçu')}
            </button>
          </div>

          <div className={showPreview ? 'grid grid-cols-1 gap-3 lg:grid-cols-2' : 'space-y-3'}>
            <textarea
              ref={htmlAreaRef}
              value={emailHtml}
              onChange={(e) => setEmailHtml(e.target.value)}
              placeholder={t('HTML body', 'Corps HTML')}
              rows={showPreview ? 14 : 6}
              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm font-mono"
            />
            {showPreview && (
              <iframe
                title={t('Email preview', 'Aperçu e-mail')}
                sandbox=""
                srcDoc={emailHtml}
                className="h-full min-h-[280px] w-full rounded-xl border border-gray-200 bg-white"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder={t('Plain-text body (required)', 'Corps texte brut (obligatoire)')}
              rows={4}
              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm"
            />
            <button
              type="button"
              onClick={deriveTextFromHtmlBody}
              title={t('Derive text from HTML', 'Dériver le texte du HTML')}
              className="flex h-9 shrink-0 items-center gap-1 self-start rounded-full border border-gray-200 bg-page px-2 text-[11px] font-semibold text-gray-700"
            >
              <Wand2 size={12} />
              {t('From HTML', 'Depuis HTML')}
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <label className="flex items-center gap-2">
              <span>{t('Language', 'Langue')}</span>
              <select
                value={emailLanguage}
                onChange={(e) => setEmailLanguage(e.target.value as 'en' | 'fr')}
                className="h-8 rounded-lg border border-gray-200 bg-white px-2"
              >
                <option value="en">EN</option>
                <option value="fr">FR</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!canSendEmail}
              onClick={() => sendEmail(true)}
              className="ml-auto h-9 rounded-full border border-gray-200 bg-white px-3 text-[11px] font-semibold text-gray-700 disabled:opacity-50"
            >
              {t('Dry-run', 'Test')}
            </button>
            <button
              type="button"
              disabled={!canSendEmail}
              onClick={() => sendEmail(false)}
              className="flex h-9 items-center gap-1 rounded-full bg-navy px-3 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              <Send size={12} />
              {t('Send', 'Envoyer')}
            </button>
          </div>
        </div>
      )}

      {channel === 'sms' && (
        <div className="space-y-3">
          <textarea
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            placeholder={t('SMS message (max 459 chars)', 'Message SMS (max 459 caractères)')}
            rows={4}
            className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm"
          />
          <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-3">
            <span>{smsMessage.length} / 459 chars</span>
            <span>· {segmentCount} {t('segment(s) per recipient', 'segment(s) par destinataire')}</span>
            {preview && (
              <span>· {totalSmsSegments} {t('total segments', 'segments totaux')}</span>
            )}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
            <input
              type="checkbox"
              checked={acknowledgeCost}
              onChange={(e) => setAcknowledgeCost(e.target.checked)}
            />
            <span>
              {t(
                `I confirm sending ~${totalSmsSegments} SMS segments. SMS retries cost real money.`,
                `Je confirme l'envoi d'environ ${totalSmsSegments} segments SMS. Les SMS coûtent.`,
              )}
            </span>
          </label>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <label className="flex items-center gap-2">
              <span>{t('Language', 'Langue')}</span>
              <select
                value={smsLanguage}
                onChange={(e) => setSmsLanguage(e.target.value as 'en' | 'fr')}
                className="h-8 rounded-lg border border-gray-200 bg-white px-2"
              >
                <option value="en">EN</option>
                <option value="fr">FR</option>
              </select>
            </label>
            <button
              type="button"
              disabled={submitting || smsMessage.trim().length === 0}
              onClick={() => sendSms(true)}
              className="ml-auto h-9 rounded-full border border-gray-200 bg-white px-3 text-[11px] font-semibold text-gray-700 disabled:opacity-50"
            >
              {t('Dry-run', 'Test')}
            </button>
            <button
              type="button"
              disabled={!canSendSms}
              onClick={() => sendSms(false)}
              className="flex h-9 items-center gap-1 rounded-full bg-terra px-3 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              <Send size={12} />
              {t('Send', 'Envoyer')}
            </button>
          </div>
        </div>
      )}

      {channel === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="micro-label text-gray-500">
              {t('Saved templates', 'Modèles enregistrés')}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshTemplates}
                disabled={templatesLoading}
                className="h-8 rounded-full border border-gray-200 bg-white px-3 text-[11px] font-semibold text-gray-700"
              >
                {templatesLoading ? t('Loading…', 'Chargement…') : t('Refresh', 'Actualiser')}
              </button>
              <button
                type="button"
                onClick={() => startEditTemplate(null)}
                className="h-8 rounded-full bg-navy px-3 text-[11px] font-bold text-white"
              >
                + {t('New template', 'Nouveau modèle')}
              </button>
            </div>
          </div>

          {!editingTemplate && (
            <div className="space-y-2">
              {templates.length === 0 && (
                <div className="text-xs text-gray-400">{t('No templates yet.', 'Aucun modèle.')}</div>
              )}
              {templates.map((tpl) => (
                <div key={tpl.id} className="rounded-xl border border-gray-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-ink">{tpl.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-gray-500">{tpl.slug}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadTemplateIntoComposer(tpl)}
                        className="h-7 rounded-full bg-forest-wash px-2 text-[10px] font-bold uppercase tracking-widest text-forest"
                      >
                        {t('Use', 'Utiliser')}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditTemplate(tpl)}
                        className="h-7 rounded-full border border-gray-200 bg-page px-2 text-[10px] font-bold uppercase tracking-widest text-gray-700"
                      >
                        {t('Edit', 'Modifier')}
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveTemplateRow(tpl.id)}
                        className="h-7 rounded-full border border-red-100 bg-red-50 px-2 text-red-700"
                        aria-label={t('Archive', 'Archiver')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {tpl.variables.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tpl.variables.map((v) => (
                        <span
                          key={v}
                          className="rounded-full bg-page px-2 py-0.5 font-mono text-[10px] text-gray-600"
                        >
                          {`{${v}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {editingTemplate !== null || tplDraft.slug !== '' || tplDraft.name !== '' ? (
            <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="micro-label text-navy">
                  {editingTemplate ? t('Edit template', 'Modifier le modèle') : t('New template', 'Nouveau modèle')}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplate(null);
                    setTplDraft({ slug: '', name: '', subjectEn: '', subjectFr: '', htmlEn: '', htmlFr: '', textEn: '', textFr: '' });
                  }}
                  className="text-[11px] text-gray-500 underline"
                >
                  {t('Cancel', 'Annuler')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={tplDraft.slug}
                  onChange={(e) => setTplDraft((p) => ({ ...p, slug: e.target.value }))}
                  placeholder={t('slug (lowercase, hyphens)', 'slug (minuscules, tirets)')}
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm font-mono"
                />
                <input
                  value={tplDraft.name}
                  onChange={(e) => setTplDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder={t('Display name', "Nom d'affichage")}
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={tplDraft.subjectEn}
                  onChange={(e) => setTplDraft((p) => ({ ...p, subjectEn: e.target.value }))}
                  placeholder="Subject (EN)"
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
                />
                <input
                  value={tplDraft.subjectFr}
                  onChange={(e) => setTplDraft((p) => ({ ...p, subjectFr: e.target.value }))}
                  placeholder="Sujet (FR)"
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <textarea
                  value={tplDraft.htmlEn}
                  onChange={(e) => setTplDraft((p) => ({ ...p, htmlEn: e.target.value }))}
                  placeholder="HTML body (EN)"
                  rows={5}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-xs font-mono"
                />
                <textarea
                  value={tplDraft.htmlFr}
                  onChange={(e) => setTplDraft((p) => ({ ...p, htmlFr: e.target.value }))}
                  placeholder="Corps HTML (FR)"
                  rows={5}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <textarea
                  value={tplDraft.textEn}
                  onChange={(e) => setTplDraft((p) => ({ ...p, textEn: e.target.value }))}
                  placeholder="Plain-text (EN)"
                  rows={3}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-xs"
                />
                <textarea
                  value={tplDraft.textFr}
                  onChange={(e) => setTplDraft((p) => ({ ...p, textFr: e.target.value }))}
                  placeholder="Texte brut (FR)"
                  rows={3}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveTemplate}
                  className="h-9 rounded-full bg-navy px-4 text-[11px] font-bold uppercase tracking-widest text-white"
                >
                  {t('Save template', 'Enregistrer')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {channel === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="micro-label text-gray-500">
              {t('Recent campaigns', 'Campagnes récentes')}
            </div>
            <button
              type="button"
              onClick={refreshHistory}
              disabled={historyLoading}
              className="h-8 rounded-full border border-gray-200 bg-white px-3 text-[11px] font-semibold text-gray-700"
            >
              {historyLoading ? t('Loading…', 'Chargement…') : t('Refresh', 'Actualiser')}
            </button>
          </div>

          <div className="space-y-2">
            <div className="micro-label-wide text-navy">{t('Email', 'E-mail')}</div>
            {emailCampaigns.length === 0 && (
              <div className="text-xs text-gray-400">{t('No campaigns yet.', 'Aucune campagne.')}</div>
            )}
            {emailCampaigns.map((row) => (
              <CampaignRowView
                key={row.id}
                title={row.subject}
                row={row}
                onCancel={() => cancelCampaign(row.id, 'email')}
                language={language}
              />
            ))}
          </div>

          <div className="space-y-2">
            <div className="micro-label-wide text-navy">{t('SMS', 'SMS')}</div>
            {smsCampaigns.length === 0 && (
              <div className="text-xs text-gray-400">{t('No campaigns yet.', 'Aucune campagne.')}</div>
            )}
            {smsCampaigns.map((row) => (
              <CampaignRowView
                key={row.id}
                title={row.message.length > 80 ? `${row.message.slice(0, 80)}…` : row.message}
                row={row}
                onCancel={() => cancelCampaign(row.id, 'sms')}
                language={language}
              />
            ))}
          </div>
        </div>
      )}

      {(actionMessage || actionError) && (
        <div
          role={actionError ? 'alert' : 'status'}
          className={`rounded-xl px-3 py-2 text-[12px] ${
            actionError
              ? 'border border-red-100 bg-red-50 text-red-700'
              : 'border border-forest-wash bg-forest-wash text-forest'
          }`}
        >
          {actionError || actionMessage}
        </div>
      )}
    </div>
  );
};

interface CampaignRowViewProps {
  title: string;
  row: { id: string; status: string; recipientCount: number; sentCount: number; failedCount: number; suppressedCount: number; createdAt: string };
  onCancel: () => void;
  language: 'en' | 'fr';
}

const CampaignRowView: React.FC<CampaignRowViewProps> = ({ title, row, onCancel, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const created = new Date(row.createdAt);
  const canCancel = row.status === 'draft' || row.status === 'sending';
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-700">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-ink truncate">{title || '(no subject)'}</div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
            row.status === 'completed'
              ? 'bg-forest-wash text-forest'
              : row.status === 'cancelled' || row.status === 'failed'
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-800'
          }`}
        >
          {row.status}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-500">
        <span>{row.recipientCount} {t('recipients', 'destinataires')}</span>
        <span>· {row.sentCount} {t('sent', 'envoyés')}</span>
        <span>· {row.failedCount} {t('failed', 'échecs')}</span>
        <span>· {row.suppressedCount} {t('suppressed', 'supprimés')}</span>
        <span>· {created.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</span>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"
          >
            <X size={10} />
            {t('Cancel', 'Annuler')}
          </button>
        )}
      </div>
    </div>
  );
};

export default CommunicationsPanel;
