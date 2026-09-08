"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Badge, Input } from "@/components/ui";
import {
    ShieldCheck,
    X,
    Plus,
    User,
    Mail,
    Key,
    Send,
    CheckCircle2,
    XCircle,
    Copy,
    Clock,
    Hash,
    MapPin,
    PenLine,
    RefreshCw,
    AlertCircle,
    Trash2,
    Briefcase,
    Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Client,
    PortalUser,
    ClientInterlocuteur,
    generateRandomPassword,
} from "../../types";

interface ManageAccessDialogProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    interlocuteurs: ClientInterlocuteur[];
    onRefreshClient: () => Promise<void>;
    showToast: {
        success: (title: string, message?: string) => void;
        error: (title: string, message?: string) => void;
    };
    onDeleteUser: (user: { id: string; name: string }) => void;
}

export function ManageAccessDialog({
    isOpen,
    onClose,
    client,
    interlocuteurs,
    onRefreshClient,
    showToast,
    onDeleteUser,
}: ManageAccessDialogProps) {
    const [mode, setMode] = useState<"view" | "new">("view");
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserType, setSelectedUserType] = useState<"CLIENT_USER" | "COMMERCIAL" | null>(null);

    // Profile edit form
    const [profileForm, setProfileForm] = useState({ name: "", email: "" });
    const [newAccessForm, setNewAccessForm] = useState({ name: "", email: "", password: "" });

    // Status / Details
    const [userDetails, setUserDetails] = useState<PortalUser | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Actions loading
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isCreatingAccess, setIsCreatingAccess] = useState(false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

    // Password reset state
    const [customNewPassword, setCustomNewPassword] = useState("");
    const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
    const [newAccessResult, setNewAccessResult] = useState<{ email: string; password: string } | null>(null);

    // Filter tab in sidebar
    const [sidebarTab, setSidebarTab] = useState<"all" | "clients" | "commercials">("all");

    const clientUsers = (client?.users || []).filter((u) => u.role === "CLIENT");
    const commercialUsers = interlocuteurs.filter((i) => i.portalUser);

    const loadUserDetails = async (userId: string) => {
        setIsLoadingDetails(true);
        try {
            const res = await fetch(`/api/users/${userId}`);
            const json = await res.json();
            if (json.success && json.data) {
                setUserDetails(json.data);
                setProfileForm({ name: json.data.name || "", email: json.data.email || "" });
            } else {
                // Fallback to client users list
                const fallback = client?.users?.find((u) => u.id === userId) || null;
                if (fallback) {
                    setUserDetails(fallback);
                    setProfileForm({ name: fallback.name || "", email: fallback.email || "" });
                }
            }
        } catch {
            const fallback = client?.users?.find((u) => u.id === userId) || null;
            if (fallback) {
                setUserDetails(fallback);
                setProfileForm({ name: fallback.name || "", email: fallback.email || "" });
            }
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // Auto-select first user on open
    useEffect(() => {
        if (isOpen) {
            setResetResult(null);
            setNewAccessResult(null);
            setCustomNewPassword("");
            const first = clientUsers[0] || (commercialUsers[0]?.portalUser ? commercialUsers[0].portalUser : null);
            if (first) {
                setMode("view");
                setSelectedUserId(first.id);
                setSelectedUserType(first.role === "COMMERCIAL" ? "COMMERCIAL" : "CLIENT_USER");
                loadUserDetails(first.id);
            } else {
                setMode("new");
                setSelectedUserId(null);
                setSelectedUserType(null);
                setNewAccessForm({ name: "", email: "", password: "" });
            }
        }
    }, [isOpen]);

    const handleSelectUser = (userId: string, type: "CLIENT_USER" | "COMMERCIAL") => {
        setMode("view");
        setSelectedUserId(userId);
        setSelectedUserType(type);
        setResetResult(null);
        setCustomNewPassword("");
        loadUserDetails(userId);
    };

    const handleStartNew = () => {
        setMode("new");
        setSelectedUserId(null);
        setSelectedUserType(null);
        setUserDetails(null);
        setResetResult(null);
        setNewAccessResult(null);
        setNewAccessForm({ name: "", email: "", password: "" });
    };

    // 1. Create client portal user
    const handleCreateAccessUser = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!client) return;
        if (!newAccessForm.name.trim() || !newAccessForm.email.trim()) {
            showToast.error("Erreur", "Le nom et l'email sont requis");
            return;
        }

        setIsCreatingAccess(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newAccessForm.name.trim(),
                    email: newAccessForm.email.trim(),
                    password: newAccessForm.password.trim() || undefined,
                    role: "CLIENT",
                    clientId: client.id,
                }),
            });
            const json = await res.json();
            if (json.success) {
                const generatedPwd = json.generatedPassword || newAccessForm.password.trim();
                setNewAccessResult({ email: newAccessForm.email.trim(), password: generatedPwd });
                showToast.success("Accès créé", "Le compte portail client a été généré avec succès.");
                await onRefreshClient();
                if (json.data?.id) {
                    setSelectedUserId(json.data.id);
                    setSelectedUserType("CLIENT_USER");
                    loadUserDetails(json.data.id);
                }
            } else {
                showToast.error("Erreur", json.error || "Impossible de créer l'accès");
            }
        } catch {
            showToast.error("Erreur", "Une erreur est survenue lors de la création");
        } finally {
            setIsCreatingAccess(false);
        }
    };

    // 2. Toggle user active status
    const handleToggleStatus = async () => {
        if (!selectedUserId || !userDetails) return;
        const nextActive = !(userDetails.isActive ?? true);
        setIsTogglingStatus(true);
        try {
            const res = await fetch(`/api/users/${selectedUserId}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: nextActive }),
            });
            const json = await res.json();
            if (json.success) {
                showToast.success(nextActive ? "Accès réactivé" : "Accès révoqué", json.data?.message || "");
                await onRefreshClient();
                await loadUserDetails(selectedUserId);
            } else {
                showToast.error("Erreur", json.error || "Impossible de mettre à jour le statut");
            }
        } catch {
            showToast.error("Erreur", "Une erreur est survenue");
        } finally {
            setIsTogglingStatus(false);
        }
    };

    // 3. Save profile details
    const handleSaveProfile = async () => {
        if (!selectedUserId) return;
        if (!profileForm.name.trim() || !profileForm.email.trim()) {
            showToast.error("Erreur", "Le nom et l'email sont obligatoires");
            return;
        }

        setIsSavingProfile(true);
        try {
            const res = await fetch(`/api/users/${selectedUserId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: profileForm.name.trim(),
                    email: profileForm.email.trim(),
                }),
            });
            const json = await res.json();
            if (json.success) {
                showToast.success("Profil mis à jour", "Les coordonnées ont été enregistrées");
                await onRefreshClient();
                await loadUserDetails(selectedUserId);
            } else {
                showToast.error("Erreur", json.error || "Impossible d'enregistrer le profil");
            }
        } catch {
            showToast.error("Erreur", "Une erreur est survenue");
        } finally {
            setIsSavingProfile(false);
        }
    };

    // 4. Reset password
    const handleResetPassword = async () => {
        if (!selectedUserId || !userDetails) return;
        if (customNewPassword && customNewPassword.length < 6) {
            showToast.error("Erreur", "Le mot de passe doit faire au moins 6 caractères");
            return;
        }

        const passwordToSet = customNewPassword.trim() || generateRandomPassword();
        setIsResettingPassword(true);
        try {
            const res = await fetch(`/api/users/${selectedUserId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: passwordToSet }),
            });
            const json = await res.json();
            if (json.success) {
                showToast.success("Mot de passe réinitialisé", "Communiquez le mot de passe généré au client");
                setResetResult({ email: userDetails.email, password: passwordToSet });
                setCustomNewPassword("");
            } else {
                showToast.error("Erreur", json.error || "Échec de la réinitialisation");
            }
        } catch {
            showToast.error("Erreur", "Une erreur est survenue");
        } finally {
            setIsResettingPassword(false);
        }
    };

    // 5. Send test RDV confirmation email
    const handleSendTestEmail = async () => {
        if (!client || !selectedUserId || !selectedUserType) return;
        setIsSendingTestEmail(true);
        try {
            let payload: Record<string, string> | null = null;
            if (selectedUserType === "CLIENT_USER") {
                payload = { recipientType: "CLIENT_USER", userId: selectedUserId };
            } else {
                const interlocuteur = interlocuteurs.find(
                    (i) => i.portalUser?.id === selectedUserId
                );
                if (!interlocuteur) {
                    showToast.error("Erreur", "Commercial introuvable pour cet accès");
                    return;
                }
                payload = { recipientType: "COMMERCIAL", interlocuteurId: interlocuteur.id };
            }

            const res = await fetch(`/api/clients/${client.id}/rdv-email-test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (json.success) {
                showToast.success(
                    "Email test envoyé",
                    `Le template RDV confirmé a été envoyé à ${json.data?.to || "l'adresse configurée"}`
                );
            } else {
                showToast.error("Erreur", json.error || "Impossible d'envoyer l'email test");
            }
        } catch {
            showToast.error("Erreur", "Impossible d'envoyer le test");
        } finally {
            setIsSendingTestEmail(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                if (isSavingProfile || isCreatingAccess || isResettingPassword || isTogglingStatus) return;
                onClose();
            }}
            size="xl"
            showCloseButton={false}
            className="!p-0 max-h-[90vh] overflow-hidden"
        >
            <div className="flex flex-col h-[82vh]">
                {/* ── Top Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-gradient-to-r from-[#0A1224] to-[#0B152A] text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 text-[#2890F8] flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight">
                                Centre d'accès & Portails
                            </h2>
                            <p className="text-xs text-blue-200/70">
                                {client?.name} · Gestion des droits et connexions clients & commerciaux
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Main Dual-Pane Body ── */}
                <div className="flex flex-1 min-h-0">
                    {/* ── Left Sidebar (List of users) ── */}
                    <aside className="w-72 border-r border-slate-200 bg-slate-50/50 flex flex-col">
                        {/* New access button */}
                        <div className="p-3 border-b border-slate-200/80">
                            <button
                                type="button"
                                onClick={handleStartNew}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs",
                                    mode === "new"
                                        ? "bg-[#2890F8] text-white shadow-blue-500/20"
                                        : "bg-white border border-slate-200 text-slate-700 hover:border-[#2890F8] hover:text-[#2890F8]"
                                )}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Créer un nouvel accès
                            </button>
                        </div>

                        {/* Sidebar filter tabs */}
                        <div className="flex px-3 pt-2 gap-1">
                            <button
                                type="button"
                                onClick={() => setSidebarTab("all")}
                                className={cn(
                                    "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors",
                                    sidebarTab === "all" ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                Tous ({clientUsers.length + commercialUsers.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSidebarTab("clients")}
                                className={cn(
                                    "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors",
                                    sidebarTab === "clients" ? "bg-blue-100 text-[#2890F8]" : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                Clients ({clientUsers.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSidebarTab("commercials")}
                                className={cn(
                                    "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors",
                                    sidebarTab === "commercials" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                Commerciaux ({commercialUsers.length})
                            </button>
                        </div>

                        {/* User list */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {/* Client Portal Section */}
                            {(sidebarTab === "all" || sidebarTab === "clients") && clientUsers.length > 0 && (
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                                        Portail Client
                                    </span>
                                    {clientUsers.map((u) => {
                                        const isSelected = mode === "view" && selectedUserId === u.id && selectedUserType === "CLIENT_USER";
                                        const isInactive = u.isActive === false;
                                        return (
                                            <button
                                                key={u.id}
                                                type="button"
                                                onClick={() => handleSelectUser(u.id, "CLIENT_USER")}
                                                className={cn(
                                                    "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-2 border",
                                                    isSelected
                                                        ? "bg-white border-[#2890F8] shadow-xs ring-1 ring-[#2890F8]/20"
                                                        : "bg-transparent border-transparent hover:bg-white hover:border-slate-200"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={cn(
                                                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                                        isInactive ? "bg-slate-200 text-slate-500" : "bg-blue-100 text-[#2890F8]"
                                                    )}>
                                                        {u.name ? u.name.charAt(0).toUpperCase() : "C"}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={cn("text-xs font-bold truncate", isSelected ? "text-[#2890F8]" : "text-slate-900")}>
                                                            {u.name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                                                    </div>
                                                </div>

                                                <div className="shrink-0">
                                                    {isInactive ? (
                                                        <span className="w-2 h-2 rounded-full bg-red-500 block" title="Accès révoqué" />
                                                    ) : (
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 block" title="Accès actif" />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Commercial Portal Section */}
                            {(sidebarTab === "all" || sidebarTab === "commercials") && commercialUsers.length > 0 && (
                                <div className="pt-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                                        Portail Commercial
                                    </span>
                                    {commercialUsers.map((interl) => {
                                        if (!interl.portalUser) return null;
                                        const u = interl.portalUser;
                                        const isSelected = mode === "view" && selectedUserId === u.id && selectedUserType === "COMMERCIAL";
                                        const isInactive = u.isActive === false;
                                        return (
                                            <button
                                                key={u.id}
                                                type="button"
                                                onClick={() => handleSelectUser(u.id, "COMMERCIAL")}
                                                className={cn(
                                                    "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-2 border",
                                                    isSelected
                                                        ? "bg-white border-violet-400 shadow-xs ring-1 ring-violet-400/20"
                                                        : "bg-transparent border-transparent hover:bg-white hover:border-slate-200"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={cn(
                                                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                                        isInactive ? "bg-slate-200 text-slate-500" : "bg-violet-100 text-violet-700"
                                                    )}>
                                                        {interl.firstName ? interl.firstName.charAt(0).toUpperCase() : "C"}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={cn("text-xs font-bold truncate", isSelected ? "text-violet-700" : "text-slate-900")}>
                                                            {interl.firstName} {interl.lastName}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                                                    </div>
                                                </div>

                                                <div className="shrink-0">
                                                    {isInactive ? (
                                                        <span className="w-2 h-2 rounded-full bg-red-500 block" title="Accès révoqué" />
                                                    ) : (
                                                        <span className="w-2 h-2 rounded-full bg-violet-500 block" title="Accès actif" />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {clientUsers.length === 0 && commercialUsers.length === 0 && (
                                <div className="text-center py-8 text-xs text-slate-400 italic">
                                    Aucun compte portail configuré.
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* ── Right Content Pane ── */}
                    <section className="flex-1 overflow-y-auto p-6 bg-white">
                        {mode === "new" ? (
                            /* ─── NEW ACCESS FORM ─── */
                            <div className="max-w-xl space-y-6">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        <Plus className="w-4 h-4 text-[#2890F8]" />
                                        Créer un compte d'accès client
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Ce compte permet au client de se connecter à son espace portail pour suivre l'activité et les rendez-vous pris.
                                    </p>
                                </div>

                                {!newAccessResult ? (
                                    <form onSubmit={handleCreateAccessUser} className="space-y-4">
                                        <Input
                                            label="Nom et Prénom *"
                                            placeholder="ex: Jean Dupont"
                                            value={newAccessForm.name}
                                            onChange={(e) => setNewAccessForm((p) => ({ ...p, name: e.target.value }))}
                                            required
                                            icon={<User className="w-4 h-4 text-slate-400" />}
                                        />

                                        <Input
                                            label="Adresse email *"
                                            type="email"
                                            placeholder="jean.dupont@client.com"
                                            value={newAccessForm.email}
                                            onChange={(e) => setNewAccessForm((p) => ({ ...p, email: e.target.value }))}
                                            required
                                            icon={<Mail className="w-4 h-4 text-slate-400" />}
                                        />

                                        <div className="space-y-1">
                                            <Input
                                                label="Mot de passe temporaire (optionnel)"
                                                type="password"
                                                placeholder="Laisser vide pour auto-générer"
                                                value={newAccessForm.password}
                                                onChange={(e) => setNewAccessForm((p) => ({ ...p, password: e.target.value }))}
                                                icon={<Key className="w-4 h-4 text-slate-400" />}
                                            />
                                            <p className="text-[11px] text-slate-400 pl-1">
                                                Si vide, un mot de passe sécurisé sera automatiquement créé et affiché à l'écran.
                                            </p>
                                        </div>

                                        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                                            <Button
                                                variant="primary"
                                                type="submit"
                                                isLoading={isCreatingAccess}
                                                className="bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                                            >
                                                Créer l'accès
                                            </Button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-4">
                                        <div className="flex items-center gap-2.5">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                            <h4 className="text-sm font-bold text-emerald-950">
                                                Accès créé avec succès
                                            </h4>
                                        </div>

                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                    Email
                                                </span>
                                                <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white">
                                                    <span className="text-xs font-mono font-medium text-slate-900 select-all">
                                                        {newAccessResult.email}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(newAccessResult.email);
                                                            showToast.success("Copié", "Email copié");
                                                        }}
                                                        className="text-slate-400 hover:text-slate-700 p-1"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                    Mot de passe temporaire
                                                </span>
                                                <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-300 bg-emerald-100/60">
                                                    <span className="text-xs font-mono font-bold text-emerald-950 select-all tracking-wider">
                                                        {newAccessResult.password}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(newAccessResult.password);
                                                            showToast.success("Copié", "Mot de passe copié");
                                                        }}
                                                        className="text-emerald-700 hover:text-emerald-900 text-xs font-bold flex items-center gap-1 p-1"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" /> Copier
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[11px] text-emerald-800 flex items-center gap-1.5">
                                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                            Copiez ce mot de passe dès maintenant pour le transmettre au client.
                                        </p>

                                        <div className="pt-2 flex justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setNewAccessResult(null)}
                                            >
                                                Créer un autre accès
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : selectedUserId && userDetails ? (
                            /* ─── VIEW / MANAGE EXISTING USER ─── */
                            <div className="space-y-6">
                                {/* Header Strip */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3.5">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shadow-xs",
                                            selectedUserType === "COMMERCIAL"
                                                ? "bg-violet-100 text-violet-700 border border-violet-200"
                                                : "bg-blue-100 text-[#2890F8] border border-blue-200"
                                        )}>
                                            {userDetails.name ? userDetails.name.charAt(0).toUpperCase() : "U"}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                                    {userDetails.name}
                                                </h3>
                                                {userDetails.isActive === false ? (
                                                    <Badge className="text-[10px] bg-red-100 text-red-700 border-0">
                                                        Révoqué
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">
                                                        Actif
                                                    </Badge>
                                                )}
                                                <Badge className={cn(
                                                    "text-[10px] border-0",
                                                    selectedUserType === "COMMERCIAL"
                                                        ? "bg-violet-100 text-violet-700"
                                                        : "bg-blue-100 text-[#2890F8]"
                                                )}>
                                                    {selectedUserType === "COMMERCIAL" ? "Portail Commercial" : "Portail Client"}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">{userDetails.email}</p>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleSendTestEmail}
                                            isLoading={isSendingTestEmail}
                                            className="gap-1.5 text-xs text-slate-700 bg-white hover:border-[#2890F8]"
                                        >
                                            <Send className="w-3.5 h-3.5 text-[#2890F8]" />
                                            Test email RDV
                                        </Button>

                                        <Button
                                            variant={userDetails.isActive === false ? "primary" : "outline"}
                                            size="sm"
                                            onClick={handleToggleStatus}
                                            isLoading={isTogglingStatus}
                                            className={cn(
                                                "gap-1.5 text-xs font-bold",
                                                userDetails.isActive !== false
                                                    ? "text-red-600 border-red-200 hover:bg-red-50"
                                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                            )}
                                        >
                                            {userDetails.isActive === false ? (
                                                <>
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Réactiver l'accès
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Révoquer l'accès
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* 1. Audit & Connexion Metrics */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-[#2890F8]" />
                                        Activité & Audit de connexion
                                    </h4>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                Dernière connexion
                                            </span>
                                            <p className="text-xs font-bold text-slate-900">
                                                {userDetails.lastSignInAt
                                                    ? new Date(userDetails.lastSignInAt).toLocaleDateString("fr-FR", {
                                                          day: "numeric",
                                                          month: "short",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                      })
                                                    : "Jamais connecté"}
                                            </p>
                                        </div>

                                        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                Dernière activité
                                            </span>
                                            <p className="text-xs font-bold text-slate-900">
                                                {userDetails.lastConnectedAt
                                                    ? new Date(userDetails.lastConnectedAt).toLocaleDateString("fr-FR", {
                                                          day: "numeric",
                                                          month: "short",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                      })
                                                    : "—"}
                                            </p>
                                        </div>

                                        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                Adresse IP
                                            </span>
                                            <p className="text-xs font-mono font-medium text-slate-800">
                                                {userDetails.lastSignInIp || "—"}
                                            </p>
                                        </div>

                                        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                Localisation
                                            </span>
                                            <p className="text-xs font-medium text-slate-800">
                                                {userDetails.lastSignInCountry || "—"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Reset Password Box */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Key className="w-3.5 h-3.5 text-[#2890F8]" />
                                        Réinitialiser le mot de passe
                                    </h4>

                                    {resetResult && resetResult.email === userDetails.email ? (
                                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                                            <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                Nouveau mot de passe généré :
                                            </p>
                                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-300 bg-white">
                                                <span className="text-xs font-mono font-bold text-emerald-900 select-all">
                                                    {resetResult.password}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(resetResult.password);
                                                        showToast.success("Copié", "Mot de passe copié");
                                                    }}
                                                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold flex items-center gap-1 p-1"
                                                >
                                                    <Copy className="w-3.5 h-3.5" /> Copier
                                                </button>
                                            </div>
                                            <div className="flex justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setResetResult(null)}
                                                >
                                                    Fermer
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                                            <Input
                                                label="Nouveau mot de passe personnalisé (optionnel)"
                                                type="password"
                                                placeholder="Laisser vide pour générer aléatoirement"
                                                value={customNewPassword}
                                                onChange={(e) => setCustomNewPassword(e.target.value)}
                                                icon={<Key className="w-4 h-4 text-slate-400" />}
                                            />
                                            <div className="flex items-center justify-between pt-1">
                                                <span className="text-[11px] text-slate-400">
                                                    Le mot de passe sera immédiatement actif.
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleResetPassword}
                                                    isLoading={isResettingPassword}
                                                    className="gap-1.5 text-xs text-[#2890F8] border-blue-200 bg-white hover:bg-blue-50"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                    Réinitialiser
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 3. Update Profile */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <PenLine className="w-3.5 h-3.5 text-[#2890F8]" />
                                        Modifier les coordonnées
                                    </h4>

                                    <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <Input
                                                label="Nom complet"
                                                value={profileForm.name}
                                                onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                                                icon={<User className="w-4 h-4 text-slate-400" />}
                                            />
                                            <Input
                                                label="Email de connexion"
                                                type="email"
                                                value={profileForm.email}
                                                onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                                                icon={<Mail className="w-4 h-4 text-slate-400" />}
                                            />
                                        </div>
                                        <div className="flex justify-end pt-1">
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={handleSaveProfile}
                                                isLoading={isSavingProfile}
                                                className="bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                                            >
                                                Enregistrer le profil
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Danger Zone: Delete user */}
                                <div className="pt-2 border-t border-slate-100">
                                    <div className="p-4 rounded-2xl border border-red-200/80 bg-red-50/40 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-red-950">Supprimer cet accès</p>
                                            <p className="text-[11px] text-red-700 mt-0.5">
                                                L'utilisateur ne pourra plus se connecter au portail.
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onDeleteUser({ id: userDetails.id, name: userDetails.name })}
                                            className="text-red-600 border-red-200 hover:bg-red-100 gap-1.5 shrink-0 text-xs font-bold"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Supprimer
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : isLoadingDetails ? (
                            <div className="flex items-center justify-center h-full py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-[#2890F8]" />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                                <ShieldCheck className="w-12 h-12 text-slate-200 mb-3" />
                                <p className="text-sm font-semibold text-slate-700">Sélectionnez un compte d'accès</p>
                                <p className="text-xs text-slate-400 mt-1">ou créez-en un nouveau</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </Modal>
    );
}
