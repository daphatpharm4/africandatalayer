import React from 'react';
import { ArrowRight, Building2, ClipboardCheck, FolderKanban, MapPin, Users } from 'lucide-react';
import type { ConsoleRoute } from '../../lib/client/consoleState';
import type { PlatformOrganization, PlatformRole } from '../../shared/platformTypes';

interface RoleWorkspaceScreenProps {
  organization: PlatformOrganization & { role: PlatformRole };
  language: 'en' | 'fr';
  onNavigate: (route: ConsoleRoute) => void;
}

const RoleWorkspaceScreen: React.FC<RoleWorkspaceScreenProps> = ({ organization, language, onNavigate }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const role = organization.role;
  const copy: Record<PlatformRole, { title: string; description: string }> = {
    viewer: {
      title: t('Data viewer workspace', 'Espace de consultation des données'),
      description: t('Follow project coverage and published collection structures without changing operations.', 'Suivez la couverture des projets et les structures de collecte publiées sans modifier les opérations.'),
    },
    reviewer: {
      title: t('Review workspace', 'Espace de révision'),
      description: t('Verify incoming company records and make clear approval decisions.', 'Vérifiez les données entrantes de l’entreprise et prenez des décisions de validation claires.'),
    },
    manager: {
      title: t('Operations workspace', 'Espace des opérations'),
      description: t('Run projects, supervise the review queue, and coordinate the company team.', 'Pilotez les projets, supervisez la file de révision et coordonnez l’équipe de l’entreprise.'),
    },
    owner: {
      title: t('Company administration', 'Administration de l’entreprise'),
      description: t('Control company settings, projects, review operations, and member access.', 'Gérez les paramètres de l’entreprise, les projets, les révisions et les accès des membres.'),
    },
    collector: {
      title: t('Field collection workspace', 'Espace de collecte terrain'),
      description: t('Use the field app to collect company-specific records and consult your active projects here.', 'Utilisez l’application terrain pour collecter les données propres à l’entreprise et consultez vos projets actifs ici.'),
    },
  };

  const actions: Array<{ key: string; title: string; description: string; icon: React.ReactNode; route?: ConsoleRoute; href?: string }> = [];
  if (role === 'collector') {
    actions.push({
      key: 'field',
      title: t('Open field collection', 'Ouvrir la collecte terrain'),
      description: t('Capture records with your company forms and coverage.', 'Collectez avec les formulaires et la couverture de votre entreprise.'),
      icon: <MapPin size={20} />,
      href: '/',
    });
  }
  if (role === 'reviewer' || role === 'manager' || role === 'owner') {
    actions.push({
      key: 'review',
      title: t('Review incoming records', 'Réviser les données entrantes'),
      description: t('Inspect evidence and approve or reject pending records.', 'Examinez les justificatifs et approuvez ou rejetez les données en attente.'),
      icon: <ClipboardCheck size={20} />,
      route: { screen: 'REVIEW' },
    });
  }
  if (role === 'viewer') {
    actions.push({
      key: 'data',
      title: t('Browse approved data', 'Consulter les données approuvées'),
      description: t('Inspect the company records that passed review.', 'Consultez les données de l’entreprise qui ont été approuvées.'),
      icon: <ClipboardCheck size={20} />,
      route: { screen: 'DATA' },
    });
  }
  actions.push({
    key: 'projects',
    title: role === 'viewer' || role === 'reviewer' || role === 'collector'
      ? t('View projects', 'Voir les projets')
      : t('Manage projects', 'Gérer les projets'),
    description: t('See project coverage and company record types.', 'Consultez la couverture des projets et les types de données de l’entreprise.'),
    icon: <FolderKanban size={20} />,
    route: { screen: 'PROJECTS' },
  });
  if (role === 'manager' || role === 'owner') {
    actions.push({
      key: 'members',
      title: t('Coordinate the team', 'Coordonner l’équipe'),
      description: t('Invite, remove, and assign operational roles.', 'Invitez, retirez et attribuez les rôles opérationnels.'),
      icon: <Users size={20} />,
      route: { screen: 'MEMBERS' },
    });
  }
  if (role === 'owner') {
    actions.push({
      key: 'settings',
      title: t('Company settings', 'Paramètres de l’entreprise'),
      description: t('Manage the client name, logo, and visual identity.', 'Gérez le nom du client, son logo et son identité visuelle.'),
      icon: <Building2 size={20} />,
      route: { screen: 'SETTINGS' },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl bg-navy p-6 text-white sm:p-8">
        <p className="micro-label text-white/70">{organization.name}</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{copy[role].title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{copy[role].description}</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {actions.map((action) => {
          const content = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-wash text-navy">{action.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">{action.title}</span>
                <span className="mt-1 block text-sm leading-5 text-ink-muted">{action.description}</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-ink-muted" />
            </>
          );
          return action.href ? (
            <a key={action.key} href={action.href} className="card flex min-h-32 items-center gap-4 p-5 text-left transition-colors hover:border-navy">{content}</a>
          ) : (
            <button key={action.key} type="button" onClick={() => action.route && onNavigate(action.route)} className="card flex min-h-32 items-center gap-4 p-5 text-left transition-colors hover:border-navy">{content}</button>
          );
        })}
      </div>
    </div>
  );
};

export default RoleWorkspaceScreen;
