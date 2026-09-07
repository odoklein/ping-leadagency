import {
  LayoutDashboard,
  Building2,
  Target,
  FileText,
  List,
  BarChart3,
  Bell,
  Users,
  FolderKanban,
  CalendarDays,
  CalendarClock,
  Phone,
  Briefcase,
  Settings,
  UserPlus,
  Mail,
  Inbox,
  MessageSquare,
  Receipt,
  History,
  HelpCircle,
  LucideIcon,
  Database,
  Activity,
  Key,
  Brain,
  BookOpen,
  Send,
  LifeBuoy,
} from "lucide-react";
import { UserRole } from "@prisma/client";

// ============================================
// NAVIGATION ITEM TYPES
// ============================================

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Short explanation shown in a hover tooltip next to the label (what this page is for). */
  description?: string;
  permission?: string;
  roles?: UserRole[];
  badge?: string;
  badgeDetail?: string;
  badgeVariant?: "default" | "rappels" | "comms" | "cockpit" | "pulse";
  pulse?: boolean;
  pulseLabel?: string;
  tooltipDetail?: string;
  children?: NavItem[];
  openInNewTab?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
  dividerBefore?: boolean;
}

// ============================================
// MANAGER NAVIGATION
// ============================================

// Manager navigation follows the operating sequence: communicate, pilot sales,
// Goals: collapse 18 flat items → 7 semantic groups; fix label/URL/permission drift;
// surface orphaned routes (campaigns, notifications, sdrs); defer inbox consolidation
// to Phase 1 (canonical = /manager/email).
export const MANAGER_NAV: NavSection[] = [
  {
    items: [
      {
        href: "/manager/dashboard",
        icon: LayoutDashboard,
        label: "Tableau de bord",
        description: "Vue d'ensemble : KPIs de l'équipe, pipeline et alertes du jour.",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Communication",
    dividerBefore: true,
    items: [
      {
        href: "/manager/comms",
        icon: MessageSquare,
        label: "Messagerie",
        description: "Discussions internes avec l'équipe et le support.",
        permission: "pages.dashboard",
      },
      {
        href: "/manager/email",
        icon: Mail,
        label: "Email",
        description: "Pilotage des emails envoyés par les SDR et des boîtes mail connectées.",
        permission: "pages.email",
        children: [
          {
            href: "/manager/email/overview",
            icon: LayoutDashboard,
            label: "Cockpit email",
            description: "Vue d'ensemble de l'activité email de l'équipe.",
            permission: "pages.email",
          },
          {
            href: "/manager/email/sent",
            icon: Send,
            label: "Envois équipe",
            description: "Historique des emails envoyés par les SDR.",
            permission: "pages.email",
          },
          {
            href: "/manager/email/mailboxes",
            icon: Inbox,
            label: "Boîtes mail",
            description: "Connexion et gestion des boîtes mail de l'équipe.",
            permission: "pages.email",
          },
        ],
      },
    ],
  },
  {
    title: "Pilotage commercial",
    items: [
      {
        href: "/manager/prospection",
        icon: Activity,
        label: "Cockpit",
        description: "Suivi en temps réel de la prospection : appels, résultats, avancement des campagnes.",
        permission: "pages.missions",
      },
      {
        href: "/manager/clients",
        icon: Building2,
        label: "Clients",
        description: "Portefeuille clients et fiches détaillées.",
        permission: "pages.clients",
      },
      {
        href: "/manager/missions",
        icon: Target,
        label: "Missions",
        description: "Création et suivi des missions confiées à l'équipe.",
        permission: "pages.missions",
      },
      {
        href: "/manager/lists",
        icon: Database,
        label: "Listes",
        description: "Listes de prospects importées, à assigner aux campagnes.",
        permission: "pages.lists",
      },
      {
        href: "/manager/analytics",
        icon: BarChart3,
        label: "Performance",
        description: "Statistiques et indicateurs de performance de l'équipe.",
        permission: "pages.analytics",
        children: [
          {
            href: "/manager/analyse-ia",
            icon: Brain,
            label: "Analyse IA",
            description: "Analyse automatique des appels et emails par l'IA.",
            permission: "pages.analytics",
          },
        ],
      },
    ],
  },
  {
    title: "Opérations SDR",
    items: [
      {
        href: "/manager/planning",
        icon: CalendarDays,
        label: "Planning équipe",
        description: "Planning des SDR : disponibilités et créneaux d'appel.",
        permission: "pages.planning",
      },
      {
        href: "/manager/utilisateurs",
        icon: Users,
        label: "Collaborateurs",
        description: "Gestion de l'équipe SDR : évaluations et fiches collaborateurs.",
        permission: "pages.sdrs",
        children: [
          {
            href: "/manager/sdr-feedback",
            icon: MessageSquare,
            label: "Évaluations",
            description: "Retours et évaluations de performance des SDR.",
            permission: "pages.sdrs",
          },
          {
            href: "/manager/sdrs",
            icon: UserPlus,
            label: "SDRs",
            description: "Liste des SDR, comptes et accès.",
            permission: "pages.sdrs",
          },
        ],
      },
      {
        href: "/manager/rdv",
        icon: CalendarClock,
        label: "Rendez-vous",
        description: "Rendez-vous obtenus par l'équipe, à confirmer ou suivre.",
        permission: "pages.analytics",
      },
    ],
  },
  {
    title: "Livraison",
    items: [
      {
        href: "/manager/projects",
        icon: FolderKanban,
        label: "Projets",
        description: "Suivi des projets clients en cours de livraison.",
        permission: "pages.projects",
        children: [
          {
            href: "/manager/tasks",
            icon: List,
            label: "Tâches",
            description: "Liste des tâches à réaliser sur les projets.",
            permission: "pages.projects",
          },
          {
            href: "/calendar",
            icon: CalendarClock,
            label: "Calendrier projet",
            description: "Calendrier partagé des échéances projet.",
            permission: "pages.projects",
            openInNewTab: true,
          },
          {
            href: "/admin/intake",
            icon: LifeBuoy,
            label: "Intake technique",
            description: "Formulaire de prise en charge technique d'un nouveau projet.",
            permission: "pages.projects",
          },
        ],
      },
    ],
  },
  {
    title: "",
    dividerBefore: true,
    items: [
      {
        href: "/manager/settings",
        icon: Settings,
        label: "Paramètres",
        description: "Configuration générale du CRM : intégrations, emails, téléphonie.",
        permission: "pages.settings",
      },
      {
        href: "/manager/billing",
        icon: Receipt,
        label: "Facturation",
        description: "Factures et abonnement de l'agence.",
        permission: "pages.billing",
      },
      {
        href: "/manager/files",
        icon: FileText,
        label: "Fichiers",
        description: "Documents partagés et fichiers de l'équipe.",
        permission: "pages.files",
      },
      {
        href: "/manager/notifications",
        icon: Bell,
        label: "Notifications",
        description: "Centre de notifications et alertes.",
        permission: "pages.dashboard",
      },
      {
        href: "/manager/api",
        icon: Key,
        label: "API & Intégrations",
        description: "Clés API et intégrations tierces.",
        permission: "pages.settings",
      },
    ],
  },
];

// ============================================
// SDR NAVIGATION
// ============================================

export const SDR_NAV: NavSection[] = [
  {
    items: [
      {
        href: "/sdr",
        icon: LayoutDashboard,
        label: "Accueil",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Mon travail",
    items: [
      {
        href: "/sdr/action",
        icon: Phone,
        label: "Appeler",
        permission: "pages.action",
      },
      {
        href: "/sdr/callbacks",
        icon: CalendarClock,
        label: "Rappels",
        permission: "pages.action",
      },
    ],
  },
  {
    title: "Résultats",
    items: [
      {
        href: "/sdr/meetings",
        icon: Briefcase,
        label: "Mes RDV",
        permission: "pages.opportunities",
      },
      {
        href: "/sdr/history",
        icon: History,
        label: "Historique",
        permission: "pages.action",
      },
      {
        href: "/sdr/calendar",
        icon: CalendarDays,
        label: "Calendrier",
        permission: "pages.action",
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        href: "/sdr/comms",
        icon: MessageSquare,
        label: "Messagerie",
        permission: "pages.dashboard",
      },
      {
        href: "/sdr/email",
        icon: Mail,
        label: "Email",
        permission: "pages.email",
        children: [
          {
            href: "/sdr/emails/sent",
            icon: Send,
            label: "Mes envois",
            permission: "pages.email",
          },
        ],
      },
    ],
  },
  {
    title: "Organisation",
    items: [
      {
        href: "/sdr/projects",
        icon: FolderKanban,
        label: "Projets",
        permission: "pages.projects",
      },
      {
        href: "/calendar",
        icon: CalendarClock,
        label: "Calendrier projet",
        permission: "pages.projects",
        openInNewTab: true,
      },
      {
        href: "/sdr/planning",
        icon: CalendarDays,
        label: "Planning",
        permission: "pages.planning",
      },
    ],
  },
];

// ============================================
// BOOKER NAVIGATION
// ============================================

export const BOOKER_NAV: NavSection[] = [
  {
    items: [
      {
        href: "/sdr",
        icon: LayoutDashboard,
        label: "Accueil",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Mes appels",
    items: [
      {
        href: "/sdr/lists",
        icon: Database,
        label: "Listes",
        permission: "pages.action",
      },
      {
        href: "/sdr/action",
        icon: Phone,
        label: "Appeler",
        permission: "pages.action",
      },
    ],
  },
  {
    title: "Mon suivi",
    items: [
      {
        href: "/sdr/callbacks",
        icon: CalendarClock,
        label: "Rappels",
        permission: "pages.action",
      },
      {
        href: "/sdr/history",
        icon: History,
        label: "Historique",
        permission: "pages.action",
      },
      {
        href: "/sdr/meetings",
        icon: Briefcase,
        label: "Mes RDV",
        permission: "pages.opportunities",
      },
    ],
  },
];

// ============================================
// BUSINESS DEVELOPER NAVIGATION
// ============================================

export const BD_NAV: NavSection[] = [
  {
    items: [
      {
        href: "/bd/dashboard",
        icon: LayoutDashboard,
        label: "Accueil",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Portefeuille",
    items: [
      {
        href: "/bd/clients",
        icon: Building2,
        label: "Mes clients",
        permission: "pages.portfolio",
      },
      {
        href: "/bd/missions",
        icon: Target,
        label: "Missions",
        permission: "pages.missions",
      },
      {
        href: "/sdr/opportunities",
        icon: Briefcase,
        label: "Opportunités",
        permission: "pages.opportunities",
      },
      {
        href: "/bd/clients/new",
        icon: UserPlus,
        label: "Nouveau client",
        permission: "pages.onboarding",
      },
    ],
  },
  {
    title: "Actions",
    items: [
      {
        href: "/sdr/action",
        icon: Phone,
        label: "Appeler",
        permission: "pages.action",
      },
      {
        href: "/sdr/callbacks",
        icon: CalendarClock,
        label: "Rappels",
        permission: "pages.action",
      },
      {
        href: "/sdr/history",
        icon: History,
        label: "Historique",
        permission: "pages.action",
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        href: "/bd/comms",
        icon: MessageSquare,
        label: "Messagerie",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Compte",
    items: [
      {
        href: "/bd/settings",
        icon: Settings,
        label: "Mon profil",
        permission: "pages.settings",
      },
    ],
  },
];

// ============================================
// DEVELOPER NAVIGATION
// ============================================

export const DEVELOPER_NAV: NavSection[] = [
  {
    items: [
      {
        href: "/developer/dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Travail",
    items: [
      {
        href: "/developer/projects",
        icon: FolderKanban,
        label: "Projets",
        permission: "pages.projects",
      },
      {
        href: "/developer/tasks",
        icon: List,
        label: "Tâches",
        permission: "pages.projects",
      },
      {
        href: "/calendar",
        icon: CalendarClock,
        label: "Calendrier projet",
        permission: "pages.projects",
        openInNewTab: true,
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        href: "/developer/comms",
        icon: MessageSquare,
        label: "Messagerie",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Compte",
    items: [
      {
        href: "/developer/integrations",
        icon: Key,
        label: "Intégrations",
        permission: "pages.settings",
      },
      {
        href: "/developer/settings",
        icon: Settings,
        label: "Paramètres",
        permission: "pages.settings",
      },
    ],
  },
];

// ============================================
// CLIENT NAVIGATION
// ============================================

export const CLIENT_NAV: NavSection[] = [
  {
    items: [
      {
        href: "/client/portal",
        icon: LayoutDashboard,
        label: "Accueil",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Mon suivi",
    items: [
      {
        href: "/client/portal/meetings",
        icon: CalendarClock,
        label: "Mes RDV",
        permission: "pages.dashboard",
      },
      {
        href: "/client/portal/reporting",
        icon: BarChart3,
        label: "Rapports",
        permission: "pages.dashboard",
      },
      {
        href: "/client/portal/activite",
        icon: Activity,
        label: "Activité",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Ressources",
    items: [
      {
        href: "/client/portal/email",
        icon: Mail,
        label: "Email",
        permission: "pages.dashboard",
      },
      {
        href: "/client/portal/database",
        icon: Database,
        label: "Contacts",
        permission: "pages.dashboard",
      },
      {
        href: "/client/portal/files",
        icon: FileText,
        label: "Fichiers",
        permission: "pages.dashboard",
      },
      {
        href: "/client/portal/sales-playbook",
        icon: BookOpen,
        label: "Argumentaire",
        permission: "pages.dashboard",
      },
    ],
  },
  {
    title: "Compte",
    items: [
      {
        href: "/client/portal/settings",
        icon: Settings,
        label: "Paramètres",
        permission: "pages.dashboard",
      },
      {
        href: "/client/portal/aide",
        icon: HelpCircle,
        label: "Aide",
        permission: "pages.dashboard",
      },
    ],
  },
];

// ============================================
// COMMERCIAL NAVIGATION
// ============================================

export const COMMERCIAL_NAV: NavSection[] = [
  {
    items: [
      {
        href: "/commercial/portal",
        icon: LayoutDashboard,
        label: "Accueil",
      },
    ],
  },
  {
    title: "Suivi",
    items: [
      {
        href: "/commercial/portal/meetings",
        icon: CalendarClock,
        label: "Mes RDV",
      },
      {
        href: "/commercial/portal/contacts",
        icon: Users,
        label: "Contacts",
      },
    ],
  },
  {
    title: "Compte",
    items: [
      {
        href: "/commercial/portal/settings",
        icon: Settings,
        label: "Paramètres",
      },
    ],
  },
];

// ============================================
// GET NAVIGATION BY ROLE
// ============================================

export function getNavByRole(role: UserRole): NavSection[] {
  switch (role) {
    case "MANAGER":
      return MANAGER_NAV;
    case "SDR":
      return SDR_NAV;
    case "BOOKER":
      return BOOKER_NAV;
    case "BUSINESS_DEVELOPER":
      return BD_NAV;
    case "DEVELOPER":
      return DEVELOPER_NAV;
    case "CLIENT":
      return CLIENT_NAV;
    case "COMMERCIAL":
      return COMMERCIAL_NAV;
    default:
      return [];
  }
}

// ============================================
// ROLE DISPLAY CONFIG
// ============================================

export interface RoleConfig {
  label: string;
  color: string;
  gradient: string;
  defaultPath: string;
}

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  MANAGER: {
    label: "Manager",
    color: "amber",
    gradient: "from-[#0c3b38] to-[#25745f]",
    defaultPath: "/manager/dashboard",
  },
  SDR: {
    label: "Sales",
    color: "amber",
    gradient: "from-[#0c3b38] to-[#25745f]",
    defaultPath: "/sdr/action",
  },
  BOOKER: {
    label: "Booker",
    color: "amber",
    gradient: "from-[#0c3b38] to-[#25745f]",
    defaultPath: "/sdr/action",
  },
  BUSINESS_DEVELOPER: {
    label: "BD",
    color: "emerald",
    gradient: "from-[#25745f] to-[#0c3b38]",
    defaultPath: "/bd/dashboard",
  },
  DEVELOPER: {
    label: "Dev",
    color: "amber",
    gradient: "from-[#ff9e1b] to-[#e07c00]",
    defaultPath: "/developer/dashboard",
  },
  CLIENT: {
    label: "Client",
    color: "amber",
    gradient: "from-[#0c3b38] to-[#25745f]",
    defaultPath: "/client/portal",
  },
  COMMERCIAL: {
    label: "Commercial",
    color: "emerald",
    gradient: "from-[#25745f] to-[#0c3b38]",
    defaultPath: "/commercial/portal",
  },
};
