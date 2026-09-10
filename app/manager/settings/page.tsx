"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Mail, RotateCcw, Save, Eye, Info,
  CheckCircle2, AlertCircle, Sparkles, Code2,
  ChevronRight, Variable, Key, ShieldCheck, Link2,
  ListOrdered, Megaphone, Phone
} from "lucide-react";
import { RDV_TEMPLATE_VARIABLES } from "@/lib/email/templates/rdv-notification";

// ============================================
// TYPES
// ============================================

interface TemplateData {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  isCustomized: boolean;
  defaultSubject: string;
  defaultBodyHtml: string;
}

type BannerAudience = "ALL" | "INTERNAL" | "MANAGERS" | "CLIENTS" | "CLIENT";

const BANNER_AUDIENCE_OPTIONS: { value: BannerAudience; label: string; help: string }[] = [
  { value: "ALL", label: "Tout le monde", help: "Équipe interne et clients" },
  { value: "INTERNAL", label: "Équipe interne", help: "Managers, SDR, BD — pas les clients" },
  { value: "MANAGERS", label: "Managers uniquement", help: "Visible seulement par les managers" },
  { value: "CLIENTS", label: "Tous les clients", help: "Tous les comptes client, pas l'interne" },
  { value: "CLIENT", label: "Un client spécifique", help: "Un seul compte client" },
];

// ============================================
// TOAST
// ============================================

function Toast({ saved, error }: { saved: boolean; error: string | null }) {
  if (!saved && !error) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium backdrop-blur-sm transition-all duration-300 ${
        error
          ? "bg-red-50/90 border border-red-200 text-red-700"
          : "bg-emerald-50/90 border border-emerald-200 text-emerald-700"
      }`}
      style={{ animation: "slideUp 0.3s ease" }}
    >
      {error ? (
        <><AlertCircle className="w-4 h-4 shrink-0" />{error}</>
      ) : (
        <><CheckCircle2 className="w-4 h-4 shrink-0" />Template sauvegardé avec succès</>
      )}
    </div>
  );
}

// ============================================
// VAR CHIP
// ============================================

function VarChip({
  variable,
  onClick,
}: {
  variable: { name: string; description: string };
  onClick: (name: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title={variable.description}
      onClick={() => {
        onClick(variable.name);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="group relative flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all duration-200"
      style={{
        background: copied ? "#eef2ff" : "#f8fafc",
        borderColor: copied ? "#a5b4fc" : "#e2e8f0",
        color: copied ? "#4338ca" : "#475569",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: copied ? "#0c3b38" : "#94a3b8",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      />
      {variable.name}
      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {variable.description}
      </span>
    </button>
  );
}

// ============================================
// SECTION
// ============================================

function Section({
  label,
  icon: Icon,
  badge,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        </div>
        {badge}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ============================================
// PAGE
// ============================================

export default function ManagerSettingsPage() {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Master password state
  const [masterPasswordEnabled, setMasterPasswordEnabled] = useState<boolean | null>(null);
  const [masterPasswordValue, setMasterPasswordValue] = useState("");
  const [masterPasswordSaving, setMasterPasswordSaving] = useState(false);
  const [masterPasswordError, setMasterPasswordError] = useState<string | null>(null);
  const [masterPasswordSaved, setMasterPasswordSaved] = useState(false);
  const [transactionalEmailFrom, setTransactionalEmailFrom] = useState("");
  const [transactionalEmailSource, setTransactionalEmailSource] = useState<"settings" | "env" | "none" | null>(null);
  const [transactionalEmailSaving, setTransactionalEmailSaving] = useState(false);
  const [transactionalEmailError, setTransactionalEmailError] = useState<string | null>(null);
  const [transactionalEmailSaved, setTransactionalEmailSaved] = useState(false);

  // VoIP config state
  const [voipStatus, setVoipStatus] = useState<any>(null);
  const [voipAlloKey, setVoipAlloKey] = useState("");
  const [voipAlloNumbers, setVoipAlloNumbers] = useState("");
  const [voipOnoffKey, setVoipOnoffKey] = useState("");
  const [voipOnoffNumbers, setVoipOnoffNumbers] = useState("");
  const [voipRingoverKey, setVoipRingoverKey] = useState("");
  const [voipRingoverSecret, setVoipRingoverSecret] = useState("");
  const [voipSaving, setVoipSaving] = useState(false);
  const [voipError, setVoipError] = useState<string | null>(null);
  const [voipSaved, setVoipSaved] = useState(false);

  // Update banner (shown at the top of everyone's sidebar)
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerDetails, setBannerDetails] = useState("");
  const [bannerAudience, setBannerAudience] = useState<BannerAudience>("ALL");
  const [bannerClientId, setBannerClientId] = useState("");
  const [bannerClients, setBannerClients] = useState<{ id: string; name: string }[]>([]);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSaved, setBannerSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/system-templates/rdv_notification").then((r) => r.json()),
      fetch("/api/system-config/master-password").then((r) => r.json()),
      fetch("/api/system-config/leexi").then((r) => r.json()),
      fetch("/api/system-config/transactional-email").then((r) => r.json()),
      fetch("/api/system-config/voip").then((r) => r.json()),
      fetch("/api/system-config/announcement-banner").then((r) => r.json()),
      fetch("/api/clients?limit=100").then((r) => r.json()).catch(() => null),
    ]).then(([tplRes, mpRes, leexiRes, transactionalEmailRes, voipRes, bannerRes, clientsRes]) => {
      if (bannerRes?.success) {
        setBannerActive(!!bannerRes.data.active);
        setBannerMessage(bannerRes.data.message || "");
        setBannerDetails(bannerRes.data.details || "");
        setBannerAudience((bannerRes.data.audience as BannerAudience) || "ALL");
        setBannerClientId(bannerRes.data.clientId || "");
      }
      if (clientsRes?.success && Array.isArray(clientsRes.data)) {
        setBannerClients(
          clientsRes.data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
        );
      }
      if (tplRes.success) {
        setTemplate(tplRes.data);
        setSubject(tplRes.data.subject);
        setBodyHtml(tplRes.data.bodyHtml);
      }
      if (mpRes.success) {
        setMasterPasswordEnabled(mpRes.data.enabled);
      }
      // We only care if Leexi is enabled; keys never leave the server
      if (leexiRes.success) {
        setLeexiEnabled(leexiRes.data.enabled);
        setLeexiSource(leexiRes.data.source);
      }
      if (transactionalEmailRes.success) {
        setTransactionalEmailFrom(transactionalEmailRes.data.from || "");
        setTransactionalEmailSource(transactionalEmailRes.data.source);
      }
      if (voipRes.success) {
        setVoipStatus(voipRes.data);
        setVoipAlloNumbers(voipRes.data.allo?.numbers || "");
        setVoipOnoffNumbers(voipRes.data.onoff?.numbers || "");
      }
    }).finally(() => setLoading(false));
  }, []);

  // Leexi config state
  const [leexiEnabled, setLeexiEnabled] = useState<boolean | null>(null);
  const [leexiSource, setLeexiSource] = useState<"settings" | "env" | "none" | null>(null);
  const [leexiKeyId, setLeexiKeyId] = useState("");
  const [leexiKeySecret, setLeexiKeySecret] = useState("");
  const [leexiSaving, setLeexiSaving] = useState(false);
  const [leexiError, setLeexiError] = useState<string | null>(null);
  const [leexiSaved, setLeexiSaved] = useState(false);

  async function handleSaveBanner(nextActive?: boolean) {
    const active = nextActive ?? bannerActive;
    setBannerSaving(true);
    setBannerError(null);
    setBannerSaved(false);
    try {
      const res = await fetch("/api/system-config/announcement-banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active,
          message: bannerMessage.trim(),
          details: bannerDetails.trim(),
          audience: bannerAudience,
          clientId: bannerAudience === "CLIENT" ? bannerClientId : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBannerActive(active);
        setBannerSaved(true);
        setTimeout(() => setBannerSaved(false), 2500);
      } else {
        setBannerError(json.error || "Impossible d'enregistrer la bannière");
      }
    } catch {
      setBannerError("Erreur de connexion");
    } finally {
      setBannerSaving(false);
    }
  }

  async function handleSaveLeexiConfig() {
    if (!leexiKeyId || !leexiKeySecret) {
      setLeexiError("Renseignez l'identifiant et le secret API Leexi");
      return;
    }
    setLeexiSaving(true);
    setLeexiError(null);
    setLeexiSaved(false);
    try {
      const res = await fetch("/api/system-config/leexi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: leexiKeyId, keySecret: leexiKeySecret }),
      });
      const json = await res.json();
      if (json.success) {
        setLeexiEnabled(true);
        setLeexiSource("settings");
        setLeexiKeyId("");
        setLeexiKeySecret("");
        setLeexiSaved(true);
        setTimeout(() => setLeexiSaved(false), 3000);
      } else {
        setLeexiError(json.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      setLeexiError("Erreur de connexion");
    } finally {
      setLeexiSaving(false);
    }
  }

  async function handleSaveVoipConfig() {
    setVoipSaving(true);
    setVoipError(null);
    setVoipSaved(false);
    try {
      const payload: Record<string, string> = {};
      if (voipAlloKey.trim()) payload.alloApiKey = voipAlloKey.trim();
      if (voipAlloNumbers !== undefined) payload.alloNumbers = voipAlloNumbers.trim();
      if (voipOnoffKey.trim()) payload.onoffApiKey = voipOnoffKey.trim();
      if (voipOnoffNumbers !== undefined) payload.onoffNumbers = voipOnoffNumbers.trim();
      if (voipRingoverKey.trim()) payload.ringoverApiKey = voipRingoverKey.trim();
      if (voipRingoverSecret.trim()) payload.ringoverWebhookSecret = voipRingoverSecret.trim();

      const res = await fetch("/api/system-config/voip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setVoipSaved(true);
        setVoipAlloKey("");
        setVoipOnoffKey("");
        setVoipRingoverKey("");
        setVoipRingoverSecret("");
        const refreshed = await fetch("/api/system-config/voip").then((r) => r.json());
        if (refreshed.success) setVoipStatus(refreshed.data);
        setTimeout(() => setVoipSaved(false), 3000);
      } else {
        setVoipError(json.error || "Erreur de sauvegarde");
      }
    } catch {
      setVoipError("Erreur réseau");
    } finally {
      setVoipSaving(false);
    }
  }

  async function handleDisableLeexiConfig() {
    if (!window.confirm("Désactiver la connexion Leexi ? Les imports de sessions ne fonctionneront plus.")) return;
    setLeexiSaving(true);
    setLeexiError(null);
    try {
      const res = await fetch("/api/system-config/leexi", { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setLeexiEnabled(json.data.enabled);
        setLeexiSource(json.data.source);
        setLeexiSaved(true);
        setTimeout(() => setLeexiSaved(false), 3000);
      } else {
        setLeexiError(json.error || "Erreur");
      }
    } catch {
      setLeexiError("Erreur de connexion");
    } finally {
      setLeexiSaving(false);
    }
  }

  async function handleSetMasterPassword() {
    if (!masterPasswordValue || masterPasswordValue.length < 6) {
      setMasterPasswordError("Le mot de passe doit faire au moins 6 caractères");
      return;
    }
    setMasterPasswordSaving(true);
    setMasterPasswordError(null);
    setMasterPasswordSaved(false);
    try {
      const res = await fetch("/api/system-config/master-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: masterPasswordValue }),
      });
      const json = await res.json();
      if (json.success) {
        setMasterPasswordEnabled(true);
        setMasterPasswordValue("");
        setMasterPasswordSaved(true);
        setTimeout(() => setMasterPasswordSaved(false), 3000);
      } else {
        setMasterPasswordError(json.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      setMasterPasswordError("Erreur de connexion");
    } finally {
      setMasterPasswordSaving(false);
    }
  }

  async function handleDisableMasterPassword() {
    if (!window.confirm("Désactiver le mot de passe maître ? Vous ne pourrez plus vous connecter avec celui-ci.")) return;
    setMasterPasswordSaving(true);
    setMasterPasswordError(null);
    try {
      const res = await fetch("/api/system-config/master-password", { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setMasterPasswordEnabled(false);
        setMasterPasswordSaved(true);
        setTimeout(() => setMasterPasswordSaved(false), 3000);
      } else {
        setMasterPasswordError(json.error || "Erreur");
      }
    } catch {
      setMasterPasswordError("Erreur de connexion");
    } finally {
      setMasterPasswordSaving(false);
    }
  }

  async function handleSaveTransactionalEmailFrom() {
    if (!transactionalEmailFrom.trim()) {
      setTransactionalEmailError("Renseignez une adresse expéditeur");
      return;
    }
    setTransactionalEmailSaving(true);
    setTransactionalEmailError(null);
    setTransactionalEmailSaved(false);
    try {
      const res = await fetch("/api/system-config/transactional-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: transactionalEmailFrom }),
      });
      const json = await res.json();
      if (json.success) {
        setTransactionalEmailSource("settings");
        setTransactionalEmailFrom(json.data.from || transactionalEmailFrom);
        setTransactionalEmailSaved(true);
        setTimeout(() => setTransactionalEmailSaved(false), 3000);
      } else {
        setTransactionalEmailError(json.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      setTransactionalEmailError("Erreur de connexion");
    } finally {
      setTransactionalEmailSaving(false);
    }
  }

  async function handleResetTransactionalEmailFrom() {
    if (!window.confirm("Réinitialiser l'expéditeur personnalisé et revenir à la variable d'environnement ?")) return;
    setTransactionalEmailSaving(true);
    setTransactionalEmailError(null);
    setTransactionalEmailSaved(false);
    try {
      const res = await fetch("/api/system-config/transactional-email", { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setTransactionalEmailSource(json.data.source);
        setTransactionalEmailFrom(json.data.from || "");
        setTransactionalEmailSaved(true);
        setTimeout(() => setTransactionalEmailSaved(false), 3000);
      } else {
        setTransactionalEmailError(json.error || "Erreur");
      }
    } catch {
      setTransactionalEmailError("Erreur de connexion");
    } finally {
      setTransactionalEmailSaving(false);
    }
  }

  const previewHtml = bodyHtml
    .replaceAll("{{contactName}}", "Marie Dupont")
    .replaceAll("{{companyName}}", "Acme Corp")
    .replaceAll("{{missionName}}", "Mission Prospection Q2")
    .replaceAll("{{meetingDate}}", "lundi 10 mars 2026")
    .replaceAll("{{meetingTime}}", "14:30 (Paris)")
    .replaceAll("{{meetingTypeLabel}}", "Visioconférence")
    .replaceAll("{{meetingJoinUrl}}", "https://meet.google.com/abc-defg-hij")
    .replaceAll("{{meetingAddress}}", "12 Rue de la Paix, 75001 Paris")
    .replaceAll("{{meetingPhone}}", "+33 6 12 34 56 78")
    .replaceAll("{{portalUrl}}", "#");

  const previewSubject = subject
    .replaceAll("{{contactName}}", "Marie Dupont")
    .replaceAll("{{companyName}}", "Acme Corp");

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/system-templates/rdv_notification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyHtml }),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTemplate((prev) => (prev ? { ...prev, isCustomized: true } : prev));
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 3000);
      } else {
        setSaveError(json.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      setSaveError("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!template) return;
    if (!window.confirm("Remettre le template par défaut ? Vos modifications seront perdues.")) return;
    setResetting(true);
    try {
      await fetch("/api/system-templates/rdv_notification", { method: "DELETE" });
      setSubject(template.defaultSubject);
      setBodyHtml(template.defaultBodyHtml);
      setTemplate((prev) => (prev ? { ...prev, isCustomized: false } : prev));
    } finally {
      setResetting(false);
    }
  }

  function insertVariable(v: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setBodyHtml((prev) => prev + v);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setBodyHtml(bodyHtml.slice(0, start) + v + bodyHtml.slice(end));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + v.length, start + v.length);
    }, 0);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-slate-400 font-medium">Chargement du template…</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .tab-active { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.10); color: #1e293b; }
        .tab-inactive { color: #64748b; }
        .tab-inactive:hover { color: #1e293b; }
        textarea.code { caret-color: #818cf8; }
        textarea.code::selection { background: rgba(99,102,241,0.25); }
      `}</style>

      <div className="mx-auto w-full max-w-5xl space-y-8 pb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Général</h1>
          <p className="mt-1 text-sm text-slate-500">
            Annonces, sécurité, intégrations et templates d&apos;email de la plateforme.
          </p>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Annonces &amp; communication</h2>
            <p className="mt-0.5 text-xs text-slate-400">Message affiché en haut de la sidebar des utilisateurs.</p>
          </div>
          <div className="space-y-4">
          {/* Update banner */}
          <Section
            label="Bannière de mise à jour (haut de la sidebar)"
            icon={Megaphone}
            badge={
              bannerActive ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full">
                  <Megaphone className="w-3 h-3" />
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full">
                  Désactivée
                </span>
              )
            }
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Affiche un bandeau en haut de la sidebar. Le message court est visible en permanence ;
                au survol, le détail explique ce qui se passe réellement (mise à jour, incident, nouveauté).
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Message court <span className="text-slate-400">({bannerMessage.length}/120)</span>
                </label>
                <input
                  type="text"
                  value={bannerMessage}
                  maxLength={120}
                  onChange={(e) => {
                    setBannerMessage(e.target.value);
                    setBannerError(null);
                  }}
                  placeholder="Ex : Nouvelle version — drawer de prospection amélioré"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Détail au survol <span className="text-slate-400">({bannerDetails.length}/2000)</span>
                </label>
                <textarea
                  value={bannerDetails}
                  maxLength={2000}
                  rows={3}
                  onChange={(e) => {
                    setBannerDetails(e.target.value);
                    setBannerError(null);
                  }}
                  placeholder="Expliquez la vraie raison : ce qui change, pourquoi, et ce que l'équipe doit faire."
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Destinataires</label>
                  <select
                    value={bannerAudience}
                    onChange={(e) => {
                      setBannerAudience(e.target.value as BannerAudience);
                      setBannerError(null);
                    }}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  >
                    {BANNER_AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">
                    {BANNER_AUDIENCE_OPTIONS.find((o) => o.value === bannerAudience)?.help}
                  </p>
                </div>

                {bannerAudience === "CLIENT" && (
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Client</label>
                    <select
                      value={bannerClientId}
                      onChange={(e) => {
                        setBannerClientId(e.target.value);
                        setBannerError(null);
                      }}
                      className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    >
                      <option value="">Sélectionner un client…</option>
                      {bannerClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Live preview of the sidebar bar */}
              {bannerMessage.trim() && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Aperçu</p>
                  <div className="rounded-xl bg-[#0f172a] p-3 max-w-xs">
                    <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-amber-200">
                      <Megaphone className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate text-[11px] font-semibold leading-tight">
                        {bannerMessage}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleSaveBanner(true)}
                  disabled={bannerSaving || !bannerMessage.trim()}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors"
                >
                  {bannerSaving ? "Enregistrement…" : bannerActive ? "Mettre à jour" : "Activer la bannière"}
                </button>
                <button
                  onClick={() => handleSaveBanner(false)}
                  disabled={bannerSaving || !bannerActive}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-red-600 border border-slate-200 rounded-xl hover:border-red-200 disabled:opacity-50 transition-colors"
                >
                  Désactiver
                </button>
              </div>

              {(bannerError || bannerSaved) && (
                <p className={`text-sm ${bannerError ? "text-red-600" : "text-emerald-600"}`}>
                  {bannerError || "Bannière enregistrée"}
                </p>
              )}
            </div>
          </Section>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Sécurité &amp; accès</h2>
            <p className="mt-0.5 text-xs text-slate-400">Contrôle des accès à la plateforme.</p>
          </div>
          <div className="space-y-4">
          {/* Master Password */}
          <Section
            label="Mot de passe maître"
            icon={Key}
            badge={
              masterPasswordEnabled === true ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200/80 rounded-full">
                  <ShieldCheck className="w-3 h-3" />
                  Activé
                </span>
              ) : masterPasswordEnabled === false ? (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full">
                  Désactivé
                </span>
              ) : null
            }
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Un mot de passe maître permet de se connecter à n&apos;importe quel compte en utilisant son email et ce mot de passe. Utilisation interne uniquement.
              </p>
              {masterPasswordEnabled ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px] max-w-md">
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Changer le mot de passe</label>
                    <input
                      type="password"
                      value={masterPasswordValue}
                      onChange={(e) => {
                        setMasterPasswordValue(e.target.value);
                        setMasterPasswordError(null);
                      }}
                      placeholder="Nouveau mot de passe (6+ caractères)"
                      className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={handleSetMasterPassword}
                      disabled={masterPasswordSaving || !masterPasswordValue || masterPasswordValue.length < 6}
                      className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors"
                    >
                      {masterPasswordSaving ? "Enregistrement…" : "Mettre à jour"}
                    </button>
                    <button
                      onClick={handleDisableMasterPassword}
                      disabled={masterPasswordSaving}
                      className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-red-600 border border-slate-200 rounded-xl hover:border-red-200 disabled:opacity-50 transition-colors"
                    >
                      Désactiver
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px] max-w-md">
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Mot de passe maître</label>
                    <input
                      type="password"
                      value={masterPasswordValue}
                      onChange={(e) => {
                        setMasterPasswordValue(e.target.value);
                        setMasterPasswordError(null);
                      }}
                      placeholder="6 caractères minimum"
                      className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={handleSetMasterPassword}
                    disabled={masterPasswordSaving || !masterPasswordValue || masterPasswordValue.length < 6}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors"
                  >
                    {masterPasswordSaving ? "Activation…" : "Activer"}
                  </button>
                </div>
              )}
              {(masterPasswordError || masterPasswordSaved) && (
                <p className={`text-sm ${masterPasswordError ? "text-red-600" : "text-emerald-600"}`}>
                  {masterPasswordError || "Paramètre enregistré"}
                </p>
              )}
            </div>
          </Section>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Intégrations &amp; téléphonie</h2>
            <p className="mt-0.5 text-xs text-slate-400">Services externes connectés à la plateforme.</p>
          </div>
          <div className="space-y-4">
          {/* Leexi API */}
          <Section
            label="Intégration Leexi (CR & sessions)"
            icon={Link2}
            badge={
              leexiEnabled === true ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200/80 rounded-full">
                  <ShieldCheck className="w-3 h-3" />
                  Active
                </span>
              ) : leexiEnabled === false ? (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full">
                  Inactive
                </span>
              ) : null
            }
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Configurez la connexion à Leexi pour créer des sessions et compte-rendus directement depuis les transcriptions.
                Les clés sont stockées côté serveur dans la configuration système, pas dans le navigateur.
              </p>

              {leexiSource === "env" && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-start gap-2">
                  <span className="mt-0.5">⚠️</span>
                  <div>
                    <p className="font-medium">Leexi est actuellement configuré via les variables d&apos;environnement.</p>
                    <p>Vous pouvez surcharger cette configuration en enregistrant des clés ici.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_auto] gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Identifiant API Leexi (KEY_ID)
                  </label>
                  <input
                    type="text"
                    value={leexiKeyId}
                    onChange={(e) => {
                      setLeexiKeyId(e.target.value);
                      setLeexiError(null);
                    }}
                    placeholder="leexi_xxx..."
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Secret API Leexi (KEY_SECRET)
                  </label>
                  <input
                    type="password"
                    value={leexiKeySecret}
                    onChange={(e) => {
                      setLeexiKeySecret(e.target.value);
                      setLeexiError(null);
                    }}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSaveLeexiConfig}
                    disabled={leexiSaving || !leexiKeyId || !leexiKeySecret}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors"
                  >
                    {leexiSaving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button
                    onClick={handleDisableLeexiConfig}
                    disabled={leexiSaving}
                    className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-red-600 border border-slate-200 rounded-xl hover:border-red-200 disabled:opacity-50 transition-colors"
                  >
                    Désactiver
                  </button>
                </div>
              </div>

              {(leexiError || leexiSaved) && (
                <p className={`text-sm ${leexiError ? "text-red-600" : "text-emerald-600"}`}>
                  {leexiError || "Paramètres Leexi enregistrés"}
                </p>
              )}
            </div>
          </Section>

          {/* Transactional email sender */}
          <Section
            label="Expéditeur emails transactionnels (RDV confirmé)"
            icon={Mail}
            badge={
              transactionalEmailSource === "settings" ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200/80 rounded-full">
                  Personnalisé
                </span>
              ) : transactionalEmailSource === "env" ? (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full">
                  Via ENV
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full">
                  Non configuré
                </span>
              )
            }
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Adresse utilisée dans le champ <span className="font-mono">From</span> des emails transactionnels, dont l&apos;email de RDV confirmé.
                Si vide, la plateforme utilise <span className="font-mono">SYSTEM_SMTP_FROM</span>.
              </p>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[260px] max-w-xl">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Adresse expéditeur</label>
                  <input
                    type="text"
                    value={transactionalEmailFrom}
                    onChange={(e) => {
                      setTransactionalEmailFrom(e.target.value);
                      setTransactionalEmailError(null);
                    }}
                    placeholder='Ex: "Prospecto" <notifications@captainprospect.fr>'
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                </div>

                <button
                  onClick={handleSaveTransactionalEmailFrom}
                  disabled={transactionalEmailSaving || !transactionalEmailFrom.trim()}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors"
                >
                  {transactionalEmailSaving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  onClick={handleResetTransactionalEmailFrom}
                  disabled={transactionalEmailSaving || transactionalEmailSource !== "settings"}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-red-600 border border-slate-200 rounded-xl hover:border-red-200 disabled:opacity-50 transition-colors"
                >
                  Réinitialiser
                </button>
              </div>

              {(transactionalEmailError || transactionalEmailSaved) && (
                <p className={`text-sm ${transactionalEmailError ? "text-red-600" : "text-emerald-600"}`}>
                  {transactionalEmailError || "Expéditeur enregistré"}
                </p>
              )}
            </div>
          </Section>

          {/* Global VoIP & Telephony System */}
          <Section
            label="Téléphonie & VoIP Globale (WithAllo, Onoff Business, Ringover)"
            icon={Phone}
            badge={
              voipStatus?.allo?.configured || voipStatus?.onoff?.configured || voipStatus?.ringover?.configured ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200/80 rounded-full">
                  <ShieldCheck className="w-3 h-3" />
                  Configuré
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full">
                  Non configuré
                </span>
              )
            }
          >
            <div className="space-y-6">
              <p className="text-sm text-slate-500">
                Configurez ici les clés API globales de téléphonie de l&apos;agence. Tous les SDR et Bookers utiliseront ces paramètres par défaut pour synchroniser leurs appels, durées et enregistrements RDV.
              </p>

              {/* WithAllo */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">WithAllo (Allo)</span>
                    {voipStatus?.allo?.configured && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {voipStatus.allo.source === "database" ? "En base de données" : "Via ENV"}
                      </span>
                    )}
                  </div>
                  {voipStatus?.allo?.maskedKey && (
                    <span className="text-xs font-mono text-slate-400">{voipStatus.allo.maskedKey}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Clé API WithAllo</label>
                    <input
                      type="password"
                      value={voipAlloKey}
                      onChange={(e) => setVoipAlloKey(e.target.value)}
                      placeholder="Entrez une nouvelle clé API…"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Numéros de ligne Allo (séparés par virgule)</label>
                    <input
                      type="text"
                      value={voipAlloNumbers}
                      onChange={(e) => setVoipAlloNumbers(e.target.value)}
                      placeholder="+33123456789, +33987654321"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Onoff Business */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">Onoff Business</span>
                    {voipStatus?.onoff?.configured && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {voipStatus.onoff.source === "database" ? "En base de données" : "Via ENV"}
                      </span>
                    )}
                  </div>
                  {voipStatus?.onoff?.maskedKey && (
                    <span className="text-xs font-mono text-slate-400">{voipStatus.onoff.maskedKey}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Clé API Onoff Business</label>
                    <input
                      type="password"
                      value={voipOnoffKey}
                      onChange={(e) => setVoipOnoffKey(e.target.value)}
                      placeholder="Entrez une nouvelle clé API Onoff…"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Numéros Onoff (séparés par virgule)</label>
                    <input
                      type="text"
                      value={voipOnoffNumbers}
                      onChange={(e) => setVoipOnoffNumbers(e.target.value)}
                      placeholder="+33123456789, +33987654321"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Ringover */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">Ringover</span>
                    {voipStatus?.ringover?.configured && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {voipStatus.ringover.source === "database" ? "En base de données" : "Via ENV"}
                      </span>
                    )}
                  </div>
                  {voipStatus?.ringover?.maskedKey && (
                    <span className="text-xs font-mono text-slate-400">{voipStatus.ringover.maskedKey}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Clé API Ringover</label>
                    <input
                      type="password"
                      value={voipRingoverKey}
                      onChange={(e) => setVoipRingoverKey(e.target.value)}
                      placeholder="Entrez une nouvelle clé Ringover…"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Secret Webhook Ringover</label>
                    <input
                      type="password"
                      value={voipRingoverSecret}
                      onChange={(e) => setVoipRingoverSecret(e.target.value)}
                      placeholder="Secret de signature webhook…"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveVoipConfig}
                  disabled={voipSaving}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors shadow-sm"
                >
                  {voipSaving ? "Enregistrement…" : "Enregistrer la configuration VoIP globale"}
                </button>
              </div>

              {(voipError || voipSaved) && (
                <p className={`text-sm font-medium ${voipError ? "text-red-600" : "text-emerald-600"}`}>
                  {voipError || "Configuration VoIP enregistrée avec succès pour toute l'équipe."}
                </p>
              )}
            </div>
          </Section>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Template d&apos;email RDV</h2>
              <p className="mt-0.5 text-xs text-slate-400 max-w-xl">
                Email envoyé automatiquement à vos clients à chaque nouveau rendez-vous confirmé.
              </p>
            </div>
            <div className="shrink-0">
              {template?.isCustomized ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200/80 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Personnalisé
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full">
                  Par défaut
                </span>
              )}
            </div>
          </div>
          <div className="space-y-4">
          {/* Subject */}
          <Section label="Objet de l'email" icon={Mail}>
            <div className="space-y-3">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent font-mono bg-slate-50 text-slate-800 transition-all placeholder:text-slate-400"
                placeholder="Ex: Votre RDV avec {{companyName}}…"
              />
              <div className="flex items-start gap-2 px-1">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Aperçu avec données réelles :{" "}
                  <span className="text-slate-600 font-medium italic">{previewSubject || "Aucun objet"}</span>
                </p>
              </div>
            </div>
          </Section>

          {/* Variables */}
          <Section
            label="Variables disponibles"
            icon={Variable}
            badge={
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Cliquez pour insérer
              </span>
            }
          >
            <div className="flex flex-wrap gap-2">
              {RDV_TEMPLATE_VARIABLES.map((v) => (
                <VarChip key={v.name} variable={v} onClick={insertVariable} />
              ))}
            </div>
          </Section>

          {/* Editor */}
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {[
                  { id: "editor" as const, icon: Code2, label: "Éditeur" },
                  { id: "preview" as const, icon: Eye, label: "Aperçu" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                      activeTab === tab.id ? "tab-active" : "tab-inactive"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                HTML valide
              </div>
            </div>

            {activeTab === "editor" ? (
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-0 bottom-0 w-12 bg-slate-900 text-slate-600 text-xs font-mono leading-[1.6rem] pt-3 pl-3 select-none overflow-hidden pointer-events-none"
                  style={{ fontSize: "11px" }}
                >
                  {bodyHtml.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  id="bodyHtmlTextarea"
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={22}
                  spellCheck={false}
                  className="code w-full pl-14 pr-4 py-3 text-[12.5px] font-mono text-slate-200 bg-slate-900 focus:outline-none resize-none leading-[1.6rem]"
                  style={{ minHeight: 380, letterSpacing: "0.01em" }}
                />
              </div>
            ) : (
              <div className="flex flex-col" style={{ minHeight: 380 }}>
                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">De :</span>
                  <span>notifications@votreapp.fr</span>
                  <ChevronRight className="w-3 h-3 text-slate-300 mx-1" />
                  <span className="font-medium text-slate-600">Objet :</span>
                  <span className="font-medium text-slate-700 italic truncate">{previewSubject}</span>
                </div>
                <iframe
                  srcDoc={previewHtml}
                  title="Aperçu email"
                  className="flex-1 w-full border-0"
                  sandbox="allow-same-origin"
                  style={{ minHeight: 380, background: "#f1f5f9" }}
                />
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-4 pt-1 pb-6">
            <div>
              {template?.isCustomized && (
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-500 font-medium transition-colors disabled:opacity-40 group"
                >
                  <RotateCcw
                    className="w-3.5 h-3.5 transition-transform group-hover:rotate-[-45deg] duration-300"
                  />
                  {resetting ? "Réinitialisation…" : "Restaurer le template par défaut"}
                </button>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all duration-200 disabled:opacity-60 overflow-hidden"
              style={{
                background: saving
                  ? "#25745f"
                  : "linear-gradient(135deg, #0c3b38 0%, #114b46 100%)",
                boxShadow: saving ? "none" : "0 4px 14px rgba(12,59,56,0.35)",
              }}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Sauvegarde…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Sauvegarder
                </>
              )}
            </button>
          </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Autres pages de configuration</h2>
            <p className="mt-0.5 text-xs text-slate-400">Réglages qui vivent sur leur propre page.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
          {/* Quick link: Statuts et catégories */}
          <Link
            href="/manager/settings/statuses"
            className="group flex items-center gap-4 rounded-[12px] border border-slate-200 bg-white p-4 transition-colors hover:border-[#AFC5BF] hover:bg-[#F7F9F8]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EEF3F1] transition-colors group-hover:bg-[#E2ECE9]">
              <ListOrdered className="w-5 h-5 text-[#1F4D47]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 group-hover:text-[#1F4D47]">Statuts et catégories de résultat</p>
              <p className="text-sm text-slate-500 line-clamp-2">Gérer les catégories (RDV, Rappel, Intéressé…) et associer chaque statut d&apos;action à une catégorie pour les rapports et l&apos;Activité client.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#1F4D47] shrink-0" />
          </Link>

          {/* Quick link: Campagne email plateforme */}
          <Link
            href="/manager/settings/security-email"
            className="group flex items-center gap-4 rounded-[12px] border border-slate-200 bg-white p-4 transition-colors hover:border-[#AFC5BF] hover:bg-[#F7F9F8]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EEF3F1] transition-colors group-hover:bg-[#E2ECE9]">
              <ShieldCheck className="w-5 h-5 text-[#1F4D47]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 group-hover:text-[#1F4D47]">Templates emails sécurité</p>
              <p className="text-sm text-slate-500 line-clamp-2">Configurez les templates de recuperation de mot de passe (lien) et OTP.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#1F4D47] shrink-0" />
          </Link>

          <Link
            href="/manager/settings/task-reminders"
            className="group flex items-center gap-4 rounded-[12px] border border-slate-200 bg-white p-4 transition-colors hover:border-[#AFC5BF] hover:bg-[#F7F9F8]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EEF3F1] transition-colors group-hover:bg-[#E2ECE9]">
              <Mail className="w-5 h-5 text-[#1F4D47]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 group-hover:text-[#1F4D47]">Rappels email des tâches</p>
              <p className="text-sm text-slate-500 line-clamp-2">Personnalisez le récapitulatif envoyé aux utilisateurs pour leurs tâches à venir et en retard.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#1F4D47] shrink-0" />
          </Link>

          <Link
            href="/manager/settings/broadcast"
            className="group flex items-center gap-4 rounded-[12px] border border-slate-200 bg-white p-4 transition-colors hover:border-[#AFC5BF] hover:bg-[#F7F9F8]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EEF3F1] transition-colors group-hover:bg-[#E2ECE9]">
              <Megaphone className="w-5 h-5 text-[#1F4D47]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 group-hover:text-[#1F4D47]">Campagne email plateforme</p>
              <p className="text-sm text-slate-500 line-clamp-2">Envoyez un email HTML à tous les clients, tous les commerciaux ou une sélection manuelle. Historique des campagnes inclus.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#1F4D47] shrink-0" />
          </Link>
          </div>
        </section>
      </div>

      <Toast saved={saved} error={saveError} />
    </>
  );
}
