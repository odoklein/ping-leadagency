"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal, Skeleton, useToast } from "@/components/ui";
import { NewMissionDialog } from "@/app/manager/missions/_components/NewMissionDialog";
import { EditMissionDialog } from "@/app/manager/missions/[id]/_components/EditMissionDialog";
import type { MissionStatusValue } from "@/lib/constants/missionStatus";
import type {
    Client,
    Mission,
    ClientInterlocuteur,
    ClientSession,
    MeetingsData,
    LeexiTranscription,
    SessionType,
} from "./types";
import { getSessionTypeLabel } from "./types";
import type { ExtractedTask } from "@/components/sessions/AITaskExtractor";

// Subcomponents
import { ClientHeader } from "./_components/ClientHeader";
import { ClientTabsNav, type ClientTabId } from "./_components/ClientTabsNav";
import { OverviewTab } from "./_components/OverviewTab/OverviewTab";
import { MissionsTab } from "./_components/MissionsTab/MissionsTab";
import { SessionsTab } from "./_components/SessionsTab/SessionsTab";
import { AnalyticsTab } from "./_components/AnalyticsTab/AnalyticsTab";

// Dialogs
import { EditClientDialog } from "./_components/dialogs/EditClientDialog";
import { PersonaDialog } from "./_components/dialogs/PersonaDialog";
import { CreatePortalUserDialog } from "./_components/dialogs/CreatePortalUserDialog";
import { PortalCredentialsDialog } from "./_components/dialogs/PortalCredentialsDialog";
import { ManageAccessDialog } from "./_components/dialogs/ManageAccessDialog";
import { InterlocuteurDialog } from "./_components/dialogs/InterlocuteurDialog";
import { NewSessionDialog } from "./_components/dialogs/NewSessionDialog";
import { EditSessionDialog } from "./_components/dialogs/EditSessionDialog";
import { SessionReportDialog } from "./_components/dialogs/SessionReportDialog";

export default function ClientDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { success, error: showError } = useToast();

    // ─── Data State ───
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [interlocuteurs, setInterlocuteurs] = useState<ClientInterlocuteur[]>([]);
    const [meetingsData, setMeetingsData] = useState<MeetingsData | null>(null);
    const [sessions, setSessions] = useState<ClientSession[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [leexiTranscriptions, setLeexiTranscriptions] = useState<LeexiTranscription[]>([]);
    const [isLoadingLeexi, setIsLoadingLeexi] = useState(false);

    // ─── Navigation ───
    const [activeTab, setActiveTab] = useState<ClientTabId>("overview");
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

    // ─── Analytics ───
    const [clientStats, setClientStats] = useState<any>(null);
    const [clientPersona, setClientPersona] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [isLoadingPersona, setIsLoadingPersona] = useState(false);
    const [statsDateRange, setStatsDateRange] = useState({ from: "", to: "" });

    // ─── Dialogs & Modals State ───
    const [showEditClientDialog, setShowEditClientDialog] = useState(false);
    const [showDeleteClientModal, setShowDeleteClientModal] = useState(false);
    const [isDeletingClient, setIsDeletingClient] = useState(false);

    const [showPersonaDialog, setShowPersonaDialog] = useState(false);
    const [showManageAccessDialog, setShowManageAccessDialog] = useState(false);
    const [showCreatePortalUserDialog, setShowCreatePortalUserDialog] = useState(false);
    const [portalCredentials, setPortalCredentials] = useState<{
        intId: string;
        email: string;
        password: string;
    } | null>(null);

    const [showIntModal, setShowIntModal] = useState(false);
    const [editingInt, setEditingInt] = useState<ClientInterlocuteur | null>(null);
    const [isSavingInt, setIsSavingInt] = useState(false);
    const [deletingIntId, setDeletingIntId] = useState<string | null>(null);
    const [activatingPortalFor, setActivatingPortalFor] = useState<string | null>(null);

    const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
    const [reportDialogSession, setReportDialogSession] = useState<ClientSession | null>(null);
    const [reportDialogTab, setReportDialogTab] = useState<"cr" | "email">("cr");
    const [editingSession, setEditingSession] = useState<ClientSession | null>(null);
    const [sessionToDelete, setSessionToDelete] = useState<ClientSession | null>(null);
    const [isDeletingSessionId, setIsDeletingSessionId] = useState<string | null>(null);
    const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

    const [showNewMissionDialog, setShowNewMissionDialog] = useState(false);
    const [editingMission, setEditingMission] = useState<Mission | null>(null);

    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [isSavingPortalSettings, setIsSavingPortalSettings] = useState(false);

    // ─── Fetch Client ───
    const fetchClient = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/clients/${resolvedParams.id}`);
            const json = await res.json();
            if (json.success && json.data) {
                setClient(json.data);
                setInterlocuteurs(
                    (json.data.interlocuteurs || []).map((i: Record<string, unknown>) => ({
                        ...i,
                        emails: Array.isArray(i.emails) ? i.emails : [],
                        phones: Array.isArray(i.phones) ? i.phones : [],
                        bookingLinks: Array.isArray(i.bookingLinks) ? i.bookingLinks : [],
                    })) as ClientInterlocuteur[]
                );
            } else {
                showError("Erreur", json.error || "Client introuvable");
                router.push("/manager/clients");
            }
        } catch {
            showError("Erreur", "Impossible de charger les données du client");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClient();
    }, [resolvedParams.id]);

    // ─── Fetch Meetings ───
    const fetchMeetings = async () => {
        try {
            const res = await fetch(`/api/clients/${resolvedParams.id}/meetings`);
            const json = await res.json();
            if (json.success) setMeetingsData(json.data);
        } catch {
            /* silent */
        }
    };

    useEffect(() => {
        if (client) fetchMeetings();
    }, [client?.id]);

    // ─── Fetch Sessions ───
    const fetchSessions = async () => {
        setIsLoadingSessions(true);
        try {
            const res = await fetch(`/api/clients/${resolvedParams.id}/sessions`);
            const json = await res.json();
            if (json.success) setSessions(json.data || []);
        } catch {
            /* silent */
        } finally {
            setIsLoadingSessions(false);
        }
    };

    useEffect(() => {
        if (client) fetchSessions();
    }, [client?.id]);

    // ─── Fetch Leexi Transcriptions ───
    const fetchLeexiTranscriptions = async () => {
        setIsLoadingLeexi(true);
        try {
            const res = await fetch(`/api/leexi/transcriptions?clientId=${resolvedParams.id}`);
            const json = await res.json();
            if (json.success) setLeexiTranscriptions(json.data || []);
        } catch {
            /* silent */
        } finally {
            setIsLoadingLeexi(false);
        }
    };

    useEffect(() => {
        if (showNewSessionDialog) fetchLeexiTranscriptions();
    }, [showNewSessionDialog]);

    // ─── Analytics Fetchers ───
    useEffect(() => {
        const to = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - 30);
        setStatsDateRange({
            from: from.toISOString().split("T")[0],
            to: to.toISOString().split("T")[0],
        });
    }, []);

    const fetchClientStats = async () => {
        if (!client?.id) return;
        setIsLoadingStats(true);
        try {
            const p = new URLSearchParams();
            p.set("from", statsDateRange.from);
            p.set("to", statsDateRange.to);
            p.append("clientIds[]", client.id);
            const res = await fetch(`/api/analytics/stats?${p}`);
            const json = await res.json();
            if (json.success) setClientStats(json.data);
        } catch {
            /* silent */
        } finally {
            setIsLoadingStats(false);
        }
    };

    const fetchClientPersona = async () => {
        if (!client?.id || !client.missions?.length) return;
        setIsLoadingPersona(true);
        try {
            const p = new URLSearchParams();
            p.set("from", statsDateRange.from);
            p.set("to", statsDateRange.to);
            client.missions.forEach((m) => p.append("missionIds[]", m.id));
            const res = await fetch(`/api/analytics/persona?${p}`);
            const json = await res.json();
            if (json.success) setClientPersona(json.data);
        } catch {
            /* silent */
        } finally {
            setIsLoadingPersona(false);
        }
    };

    useEffect(() => {
        if (activeTab === "analytics" && client?.id) {
            fetchClientStats();
            fetchClientPersona();
        }
    }, [activeTab, client?.id, statsDateRange]);

    // ─── CRUD Handlers: Client ───
    const handleUpdateClient = async (updatedData: Partial<Client>) => {
        if (!client) return;
        try {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedData),
            });
            const json = await res.json();
            if (json.success) {
                setClient((prev) => (prev ? { ...prev, ...json.data } : prev));
                success("Client mis à jour", `${updatedData.name || client.name} a été enregistré`);
            } else {
                showError("Erreur", json.error || "Impossible de mettre à jour le client");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        }
    };

    const handleDeleteClient = async () => {
        if (!client) return;
        setIsDeletingClient(true);
        try {
            const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                success("Client supprimé", `${client.name} a été définitivement supprimé.`);
                router.push("/manager/clients");
            } else {
                showError("Erreur", json.error || "Échec de la suppression");
            }
        } catch {
            showError("Erreur", "Impossible de supprimer le client");
        } finally {
            setIsDeletingClient(false);
            setShowDeleteClientModal(false);
        }
    };

    const handleSavePersona = async (icp: string) => {
        if (!client) return;
        try {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ icp }),
            });
            const json = await res.json();
            if (json.success) {
                setClient(json.data);
                success("Persona enregistré", "Le profil cible (ICP) a été mis à jour.");
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Impossible d'enregistrer le persona");
        }
    };

    const handlePortalVisibilityChange = async (
        key: "portalShowCallHistory" | "portalShowDatabase",
        value: boolean
    ) => {
        if (!client) return;
        const previous = client[key] ?? false;
        setIsSavingPortalSettings(true);
        setClient((prev) => (prev ? { ...prev, [key]: value } : prev));

        try {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [key]: value }),
            });
            const json = await res.json();
            if (json.success) {
                setClient((prev) => (prev ? { ...prev, ...json.data } : prev));
                success("Options portail", "Paramètres de visibilité mis à jour.");
            } else {
                setClient((prev) => (prev ? { ...prev, [key]: previous } : prev));
                showError("Erreur", json.error || "Impossible de sauvegarder l'option");
            }
        } catch {
            setClient((prev) => (prev ? { ...prev, [key]: previous } : prev));
            showError("Erreur", "Erreur réseau");
        } finally {
            setIsSavingPortalSettings(false);
        }
    };

    // ─── CRUD Handlers: Portal Users ───
    const handleCreatePortalUser = async (userForm: { name: string; email: string; password?: string }) => {
        if (!client) return;
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: userForm.name,
                    email: userForm.email,
                    password: userForm.password || undefined,
                    role: "CLIENT",
                    clientId: client.id,
                }),
            });
            const json = await res.json();
            if (json.success) {
                success("Accès créé", "Le compte portail client a été généré.");
                await fetchClient();
                return {
                    email: userForm.email,
                    password: json.generatedPassword || userForm.password,
                };
            } else {
                showError("Erreur", json.error || "Impossible de créer le compte");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setIsDeletingUser(true);
        try {
            const res = await fetch(`/api/users/${userToDelete.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                success("Accès révoqué", `Le compte de ${userToDelete.name} a été supprimé.`);
                await fetchClient();
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Impossible de révoquer l'accès");
        } finally {
            setIsDeletingUser(false);
            setUserToDelete(null);
        }
    };

    // ─── CRUD Handlers: Interlocuteurs ───
    const handleCreateInterlocuteur = async (data: Partial<Omit<ClientInterlocuteur, "id" | "createdAt">>) => {
        if (!client) return;
        setIsSavingInt(true);
        try {
            const res = await fetch(`/api/clients/${client.id}/interlocuteurs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (json.success) {
                setInterlocuteurs((prev) => [...prev, json.data]);
                setShowIntModal(false);
                setEditingInt(null);
                success("Commercial ajouté", `${data.firstName} ${data.lastName} a été enregistré`);
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Impossible de créer le commercial");
        } finally {
            setIsSavingInt(false);
        }
    };

    const handleUpdateInterlocuteur = async (
        iid: string,
        data: Partial<Omit<ClientInterlocuteur, "id" | "createdAt">>
    ) => {
        if (!client) return;
        setIsSavingInt(true);
        try {
            const res = await fetch(`/api/clients/${client.id}/interlocuteurs/${iid}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (json.success) {
                setInterlocuteurs((prev) => prev.map((i) => (i.id === iid ? json.data : i)));
                setShowIntModal(false);
                setEditingInt(null);
                success("Commercial mis à jour", `${json.data.firstName} a été enregistré`);
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Impossible de mettre à jour le commercial");
        } finally {
            setIsSavingInt(false);
        }
    };

    const handleDeleteInterlocuteur = async (iid: string) => {
        if (!client) return;
        setDeletingIntId(iid);
        try {
            const res = await fetch(`/api/clients/${client.id}/interlocuteurs/${iid}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                setInterlocuteurs((prev) => prev.filter((i) => i.id !== iid));
                success("Commercial supprimé", "L'interlocuteur a été retiré");
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Impossible de supprimer");
        } finally {
            setDeletingIntId(null);
        }
    };

    const handleActivatePortal = async (interl: ClientInterlocuteur) => {
        if (!client) return;
        setActivatingPortalFor(interl.id);
        try {
            const res = await fetch(`/api/clients/${client.id}/interlocuteurs/${interl.id}/activate-portal`, {
                method: "POST",
            });
            const json = await res.json();
            if (json.success) {
                if (json.data.alreadyExists) {
                    success("Portail actif", `Un compte existe déjà pour ${interl.firstName}`);
                } else {
                    setPortalCredentials({
                        intId: interl.id,
                        email: json.data.user.email,
                        password: json.data.generatedPassword,
                    });
                    setInterlocuteurs((prev) =>
                        prev.map((i) =>
                            i.id === interl.id
                                ? {
                                      ...i,
                                      portalUser: {
                                          id: json.data.user.id,
                                          email: json.data.user.email,
                                          name: json.data.user.name,
                                          isActive: true,
                                      },
                                  }
                                : i
                        )
                    );
                }
            } else {
                showError("Erreur", json.error || "Impossible d'activer le portail");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setActivatingPortalFor(null);
        }
    };

    const handleDeactivatePortal = async (interl: ClientInterlocuteur) => {
        if (!client || !interl.portalUser) return;
        setActivatingPortalFor(interl.id);
        try {
            const res = await fetch(`/api/clients/${client.id}/interlocuteurs/${interl.id}/activate-portal`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                setInterlocuteurs((prev) =>
                    prev.map((i) => (i.id === interl.id ? { ...i, portalUser: null } : i))
                );
                success("Portail désactivé", `L'accès de ${interl.firstName} a été révoqué.`);
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setActivatingPortalFor(null);
        }
    };

    // ─── CRUD Handlers: Sessions ───
    const handleSaveSession = async (payload: any) => {
        if (!client) return;
        const res = await fetch(`/api/clients/${client.id}/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
            const taskCount = payload.tasks?.length || 0;
            let msg = json.emailSent
                ? `CR sauvegardé et mail envoyé à ${client.email}`
                : "Session enregistrée.";
            if (taskCount > 0 && json.projectId) {
                msg += ` · ${taskCount} tâche${taskCount > 1 ? "s" : ""} ajoutée${taskCount > 1 ? "s" : ""} au projet.`;
            }
            success("Session enregistrée", msg);
            await fetchSessions();
        } else {
            showError("Erreur", json.error);
        }
    };

    const handleUpdateSession = async (payload: {
        type: SessionType;
        date: string;
        crMarkdown?: string;
        summaryEmail?: string;
        tasks?: ExtractedTask[];
    }) => {
        if (!client || !editingSession) return;
        const newTasks = (payload.tasks || []).filter((t) => t.label.trim().length > 0);
        const res = await fetch(`/api/clients/${client.id}/sessions/${editingSession.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: payload.type,
                date: payload.date,
                crMarkdown: payload.crMarkdown,
                summaryEmail: payload.summaryEmail,
                ...(newTasks.length > 0
                    ? {
                          tasks: newTasks.map((t) => ({
                              label: t.label.trim(),
                              assignee: t.assignee || undefined,
                              assigneeId: t.assigneeId || undefined,
                              assigneeRole: t.assigneeRole,
                              priority: t.priority,
                              dueDate: t.dueDate || undefined,
                          })),
                      }
                    : {}),
            }),
        });
        const json = await res.json();
        if (json.success) {
            success("Session mise à jour", "Les modifications ont été sauvegardées");
            setEditingSession(null);
            await fetchSessions();
        } else {
            showError("Erreur", json.error || "Impossible de mettre à jour");
        }
    };

    const handleDeleteSession = async (session: ClientSession) => {
        if (!client) return;
        setIsDeletingSessionId(session.id);
        try {
            const res = await fetch(`/api/clients/${client.id}/sessions/${session.id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                success("Session supprimée", "");
                setExpandedSessionId((prev) => (prev === session.id ? null : prev));
                await fetchSessions();
            } else {
                showError("Erreur", json.error || "Impossible de supprimer");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setIsDeletingSessionId(null);
            setSessionToDelete(null);
        }
    };

    const handleToggleTask = async (sessionId: string, taskId: string) => {
        if (!client) return;
        setTogglingTaskId(taskId);
        try {
            const res = await fetch(`/api/clients/${client.id}/sessions/${sessionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toggleTaskId: taskId }),
            });
            const json = await res.json();
            if (json.success) {
                setSessions((prev) =>
                    prev.map((s) => {
                        if (s.id !== sessionId) return s;
                        return {
                            ...s,
                            tasks: s.tasks.map((t) =>
                                t.id === taskId ? { ...t, doneAt: json.data.doneAt } : t
                            ),
                        };
                    })
                );
            }
        } catch {
            /* silent */
        } finally {
            setTogglingTaskId(null);
        }
    };

    const downloadSessionReportCsv = (session: ClientSession) => {
        if (!client) return;

        const BOM = "\uFEFF";
        const delimiter = ";";
        const headers = [
            "Client",
            "Date session",
            "Type session",
            "Compte rendu complet",
            "Mail de synthese",
            "Statut email",
            "Lien enregistrement",
            "Projet",
            "Tache",
            "Statut tache",
            "Priorite",
            "Role",
            "Assignee",
            "Echeance",
        ];

        const taskRows = session.tasks.length > 0 ? session.tasks : [null];
        const rows = taskRows.map((task) => [
            client.name,
            new Date(session.date).toLocaleDateString("fr-FR"),
            getSessionTypeLabel(session),
            session.crMarkdown || "",
            session.summaryEmail || "",
            session.emailSentAt
                ? `Envoye le ${new Date(session.emailSentAt).toLocaleDateString("fr-FR")}`
                : "Non envoye automatiquement",
            session.recordingUrl || "",
            session.projectId ? `/manager/projects/${session.projectId}` : "",
            task?.label || "",
            task?.doneAt ? "Terminee" : task ? "A faire" : "",
            task?.priority || "",
            task?.assigneeRole || "",
            task?.assignee || "",
            task?.dueDate ? new Date(task.dueDate).toLocaleDateString("fr-FR") : "",
        ]);

        const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csv = BOM + [headers, ...rows].map((row) => row.map(escapeCell).join(delimiter)).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const safeClientName = client.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase();

        link.href = url;
        link.download = `${safeClientName || "client"}_rapport_session_${session.date.slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        success("Export CSV", "Le rapport a été téléchargé.");
    };

    // ─── Computed Values ───
    const nextMeeting = meetingsData?.allMeetings
        ?.filter((m) => m.callbackDate && new Date(m.callbackDate) > new Date())
        ?.sort(
            (a, b) =>
                new Date(a.callbackDate!).getTime() - new Date(b.callbackDate!).getTime()
        )[0];

    const lastSessionDaysAgo = sessions.length
        ? Math.floor((Date.now() - new Date(sessions[0].createdAt).getTime()) / 86400000)
        : null;

    const openTasksCount = sessions.reduce(
        (acc, s) => acc + s.tasks.filter((t) => !t.doneAt).length,
        0
    );

    const getMissionStatus = (m: Mission): MissionStatusValue => {
        if (m.status) return m.status;
        return m.isActive ? "ACTIVE" : "PAUSED";
    };

    // ─── Loading Skeleton ───
    if (isLoading) {
        return (
            <div className="space-y-6 max-w-[1600px] mx-auto w-full pb-12">
                <Skeleton className="h-44 w-full rounded-3xl" />
                <Skeleton className="h-12 w-96 rounded-2xl" />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-2xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="lg:col-span-2 h-96 rounded-3xl" />
                    <Skeleton className="h-96 rounded-3xl" />
                </div>
            </div>
        );
    }

    if (!client) return null;

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto w-full pb-16">
            {/* 1. Hero Header */}
            <ClientHeader
                client={client}
                onEdit={() => setShowEditClientDialog(true)}
                onDelete={() => setShowDeleteClientModal(true)}
            />

            {/* 2. Sticky Tab Nav */}
            <ClientTabsNav
                activeTab={activeTab}
                onChange={setActiveTab}
                counts={{
                    missions: client.missions?.length || 0,
                    sessions: sessions.length,
                }}
            />

            {/* 3. Tab Contents */}
            {activeTab === "overview" && (
                <OverviewTab
                    client={client}
                    sessions={sessions}
                    meetingsData={meetingsData}
                    openTasksCount={openTasksCount}
                    lastSessionDaysAgo={lastSessionDaysAgo}
                    nextMeeting={nextMeeting}
                    interlocuteurs={interlocuteurs}
                    activatingPortalFor={activatingPortalFor}
                    deletingIntId={deletingIntId}
                    isSavingPortalSettings={isSavingPortalSettings}
                    onViewSessionsTab={() => setActiveTab("sessions")}
                    onSelectSession={(sessionId) => {
                        setActiveTab("sessions");
                        setExpandedSessionId(sessionId);
                    }}
                    onViewMissionsTab={() => setActiveTab("missions")}
                    onNewMission={() => setShowNewMissionDialog(true)}
                    onNewSession={() => setShowNewSessionDialog(true)}
                    onEditClient={() => setShowEditClientDialog(true)}
                    onEditPersona={() => setShowPersonaDialog(true)}
                    onAddCommercial={() => {
                        setEditingInt(null);
                        setShowIntModal(true);
                    }}
                    onEditCommercial={(interl) => {
                        setEditingInt(interl);
                        setShowIntModal(true);
                    }}
                    onDeleteCommercial={handleDeleteInterlocuteur}
                    onActivatePortalForCommercial={handleActivatePortal}
                    onDeactivatePortalForCommercial={handleDeactivatePortal}
                    onOpenManageAccess={() => setShowManageAccessDialog(true)}
                    onQuickCreatePortalUser={() => setShowCreatePortalUserDialog(true)}
                    onPortalVisibilityChange={handlePortalVisibilityChange}
                    showToast={{ success, error: showError }}
                />
            )}

            {activeTab === "missions" && (
                <MissionsTab
                    client={client}
                    onNewMission={() => setShowNewMissionDialog(true)}
                    onEditMission={(m) => setEditingMission(m)}
                />
            )}

            {activeTab === "sessions" && (
                <SessionsTab
                    sessions={sessions}
                    isLoadingSessions={isLoadingSessions}
                    expandedSessionId={expandedSessionId}
                    onToggleExpand={(id) =>
                        setExpandedSessionId((prev) => (prev === id ? null : id))
                    }
                    onNewSession={() => setShowNewSessionDialog(true)}
                    onOpenReport={(session, tab = "cr") => {
                        setReportDialogSession(session);
                        setReportDialogTab(tab);
                    }}
                    onEditSession={(session) => setEditingSession(session)}
                    onDeleteSession={(session) => setSessionToDelete(session)}
                    onToggleTask={handleToggleTask}
                    togglingTaskId={togglingTaskId}
                    isDeletingSessionId={isDeletingSessionId}
                    onDownloadCsv={downloadSessionReportCsv}
                    showToast={{ success }}
                />
            )}

            {activeTab === "analytics" && (
                <AnalyticsTab
                    statsDateRange={statsDateRange}
                    onDateRangeChange={setStatsDateRange}
                    clientStats={clientStats}
                    clientPersona={clientPersona}
                    isLoadingStats={isLoadingStats}
                    isLoadingPersona={isLoadingPersona}
                    onRefresh={() => {
                        fetchClientStats();
                        fetchClientPersona();
                    }}
                />
            )}

            {/* ─── MODALS & DIALOGS ─── */}

            {/* 1. Edit Client */}
            <EditClientDialog
                isOpen={showEditClientDialog}
                onClose={() => setShowEditClientDialog(false)}
                client={client}
                onSaved={handleUpdateClient}
            />

            {/* 2. Delete Client Confirm */}
            <ConfirmModal
                isOpen={showDeleteClientModal}
                onClose={() => setShowDeleteClientModal(false)}
                onConfirm={handleDeleteClient}
                title="Supprimer le client ?"
                message={`Êtes-vous certain de vouloir supprimer "${client.name}" ? Toutes ses missions, campagnes, comptes portails et données associées seront supprimées. Cette action est irréversible.`}
                confirmText="Supprimer définitivement"
                variant="danger"
                isLoading={isDeletingClient}
            />

            {/* 3. Persona / ICP Dialog */}
            <PersonaDialog
                isOpen={showPersonaDialog}
                onClose={() => setShowPersonaDialog(false)}
                initialIcp={(client.onboarding?.onboardingData as { icp?: string } | null)?.icp ?? ""}
                onSave={handleSavePersona}
            />

            {/* 4. Quick Create Portal User */}
            <CreatePortalUserDialog
                isOpen={showCreatePortalUserDialog}
                onClose={() => setShowCreatePortalUserDialog(false)}
                clientName={client.name}
                onCreateUser={handleCreatePortalUser}
            />

            {/* 5. Commercial Portal Credentials */}
            <PortalCredentialsDialog
                isOpen={!!portalCredentials}
                onClose={() => setPortalCredentials(null)}
                credentials={portalCredentials}
            />

            {/* 6. Manage Access Hub Dialog */}
            <ManageAccessDialog
                isOpen={showManageAccessDialog}
                onClose={() => setShowManageAccessDialog(false)}
                client={client}
                interlocuteurs={interlocuteurs}
                onRefreshClient={fetchClient}
                showToast={{ success, error: showError }}
                onDeleteUser={(u) => setUserToDelete(u)}
            />

            {/* 7. Revoke User Confirm Modal */}
            <ConfirmModal
                isOpen={!!userToDelete}
                onClose={() => !isDeletingUser && setUserToDelete(null)}
                onConfirm={handleDeleteUser}
                title="Supprimer l'accès portail ?"
                message={`Êtes-vous certain de vouloir supprimer le compte d'accès de ${userToDelete?.name} ? Cette personne ne pourra plus se connecter.`}
                confirmText="Supprimer l'accès"
                variant="danger"
                isLoading={isDeletingUser}
            />

            {/* 8. Interlocuteur CRUD Dialog */}
            <InterlocuteurDialog
                isOpen={showIntModal}
                onClose={() => {
                    setShowIntModal(false);
                    setEditingInt(null);
                }}
                editing={editingInt}
                isSaving={isSavingInt}
                onSave={(data) => {
                    if (editingInt) {
                        handleUpdateInterlocuteur(editingInt.id, data);
                    } else {
                        handleCreateInterlocuteur(data as Omit<ClientInterlocuteur, "id" | "createdAt">);
                    }
                }}
            />

            {/* 9. New Session Dialog */}
            <NewSessionDialog
                isOpen={showNewSessionDialog}
                onClose={() => setShowNewSessionDialog(false)}
                client={client}
                leexiTranscriptions={leexiTranscriptions}
                isLoadingLeexi={isLoadingLeexi}
                onRefreshLeexi={fetchLeexiTranscriptions}
                onSaveSession={handleSaveSession}
                showToast={{ success, error: showError }}
            />

            {/* 10. Edit Session Dialog */}
            <EditSessionDialog
                isOpen={!!editingSession}
                onClose={() => setEditingSession(null)}
                session={editingSession}
                clientName={client.name}
                onSave={handleUpdateSession}
            />

            {/* 11. Full Session Report Dialog */}
            <SessionReportDialog
                isOpen={!!reportDialogSession}
                onClose={() => setReportDialogSession(null)}
                session={reportDialogSession}
                initialTab={reportDialogTab}
                clientEmail={client.email}
                onDownloadCsv={downloadSessionReportCsv}
            />

            {/* 12. Delete Session Confirm Modal */}
            <ConfirmModal
                isOpen={!!sessionToDelete}
                onClose={() => setSessionToDelete(null)}
                onConfirm={async () => {
                    if (sessionToDelete) {
                        await handleDeleteSession(sessionToDelete);
                    }
                }}
                title="Supprimer la session ?"
                message="Cette session et toutes ses tâches associées seront définitivement supprimées. Cette action est irréversible."
                confirmText="Supprimer"
                variant="danger"
                isLoading={!!isDeletingSessionId}
            />

            {/* 13. Mission Dialogs */}
            <NewMissionDialog
                isOpen={showNewMissionDialog}
                onClose={() => setShowNewMissionDialog(false)}
                onCreated={fetchClient}
            />

            <EditMissionDialog
                isOpen={!!editingMission}
                onClose={() => setEditingMission(null)}
                mission={
                    editingMission
                        ? {
                              id: editingMission.id,
                              name: editingMission.name,
                              objective: editingMission.objective,
                              channel: editingMission.channel,
                              channels: editingMission.channels,
                              status: getMissionStatus(editingMission),
                              startDate: editingMission.startDate,
                              endDate: editingMission.endDate,
                              client: client ? { id: client.id, name: client.name } : undefined,
                          }
                        : null
                }
                onSaved={fetchClient}
            />
        </div>
    );
}
