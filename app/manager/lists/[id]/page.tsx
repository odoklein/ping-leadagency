"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DataTable, ConfirmModal, DropdownMenu, useToast } from "@/components/ui";
import type { Column, DropdownMenuItem } from "@/components/ui";
import dynamic from "next/dynamic";
import {
    ArrowLeft,
    Building2,
    Users,
    Edit,
    Trash2,
    Download,
    MoreHorizontal,
    RefreshCw,
    Plus,
} from "lucide-react";
import Link from "next/link";
import { ProspectionHealthPanel } from "@/components/lists/ProspectionHealthPanel";

// The three drawers together are ~5 900 lines. Only one can ever be on screen,
// and on most visits none of them opens at all, so none belongs in the initial
// bundle for a page whose job is to render a table.
const CompanyDrawer = dynamic(
    () => import("@/components/drawers/CompanyDrawer").then((m) => ({ default: m.CompanyDrawer })),
    { ssr: false }
);
const ContactDrawer = dynamic(
    () => import("@/components/drawers/ContactDrawer").then((m) => ({ default: m.ContactDrawer })),
    { ssr: false }
);
const UnifiedActionDrawer = dynamic(
    () => import("@/components/drawers/UnifiedActionDrawer").then((m) => ({ default: m.UnifiedActionDrawer })),
    { ssr: false }
);

// ============================================
// TYPES
// ============================================

interface ListDetail {
    id: string;
    name: string;
    type: string;
    source: string;
    mission: {
        id: string;
        name: string;
        client: {
            name: string;
        };
    };
    _count: {
        companies: number;
    };
    createdAt: string;
    updatedAt: string;
}

type CompletenessStatus = "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";

interface Company {
    id: string;
    name: string;
    industry: string | null;
    country: string | null;
    website: string | null;
    phone: string | null;
    size: string | null;
    status: CompletenessStatus;
    // JSON blob storing any custom fields imported from CSV
    customData?: Record<string, any> | null;
    _count: {
        contacts: number;
    };
    contacts: Contact[];
}

interface Contact {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    linkedin: string | null;
    status: CompletenessStatus;
    companyId: string;
    companyName?: string;
}

interface ClientInterlocuteur {
    id: string;
    firstName: string;
    lastName: string;
    title?: string;
    emails: Array<{ value: string; label: string; isPrimary: boolean }>;
    phones: Array<{ value: string; label: string; isPrimary: boolean }>;
    bookingLinks: Array<{ label: string; url: string; durationMinutes: number }>;
    isActive: boolean;
}

// ============================================
// STATUS CONFIG
// ============================================
// One dot + one word. The previous icon + tinted pill + colored label spent
// three visual signals on a single fact, in every row of the table.

const STATUS_CONFIG: Record<CompletenessStatus, { label: string; dot: string; text: string }> = {
    INCOMPLETE: { label: "Incomplet", dot: "bg-[var(--elan-danger)]", text: "text-ink-soft" },
    PARTIAL: { label: "Partiel", dot: "bg-[var(--elan-amber)]", text: "text-ink-soft" },
    ACTIONABLE: { label: "Actionnable", dot: "bg-[var(--elan-success)]", text: "text-ink-soft" },
};

const STATUS_ORDER: CompletenessStatus[] = ["ACTIONABLE", "PARTIAL", "INCOMPLETE"];

function StatusCell({ status }: { status: CompletenessStatus }) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.INCOMPLETE;
    return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
            <span className={`text-xs ${config.text}`}>{config.label}</span>
        </span>
    );
}

// ============================================
// FILTER CHIPS
// ============================================
// Replaces scanning 15 status badges per page with one click.

type StatusFilter = "ALL" | CompletenessStatus;

function FilterChips({
    value,
    onChange,
    counts,
    total,
}: {
    value: StatusFilter;
    onChange: (next: StatusFilter) => void;
    counts: Record<CompletenessStatus, number>;
    total: number;
}) {
    const chips: Array<{ key: StatusFilter; label: string; count: number; dot?: string }> = [
        { key: "ALL", label: "Tous", count: total },
        ...STATUS_ORDER.map((status) => ({
            key: status as StatusFilter,
            label: STATUS_CONFIG[status].label,
            count: counts[status],
            dot: STATUS_CONFIG[status].dot,
        })),
    ];

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => {
                const active = value === chip.key;
                return (
                    <button
                        key={chip.key}
                        type="button"
                        onClick={() => onChange(chip.key)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-elan border text-xs font-medium transition-colors ${
                            active
                                ? "border-amber bg-eucalyptus text-ink"
                                : "border-line bg-surface text-ink-soft hover:border-line-strong"
                        }`}
                    >
                        {chip.dot && <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`} />}
                        {chip.label}
                        <span className="text-slate tabular-nums">{chip.count}</span>
                    </button>
                );
            })}
        </div>
    );
}

// ============================================
// LIST DETAIL PAGE
// ============================================

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { success, error: showError } = useToast();

    // Everything under /manager is MANAGER-only (see middleware.ts), so this page
    // never renders for another role. It is still forwarded to the drawers, which
    // are shared with the SDR surface and do gate on it.
    const isManager = session?.user?.role === "MANAGER";

    const [listId, setListId] = useState<string>("");
    const [list, setList] = useState<ListDetail | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [view, setView] = useState<"companies" | "contacts">("companies");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

    // Drawer states
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedContact, setSelectedContact] = useState<(Contact & { companyName: string }) | null>(null);
    const [showCompanyDrawer, setShowCompanyDrawer] = useState(false);
    const [showContactDrawer, setShowContactDrawer] = useState(false);
    const [isCreatingCompany, setIsCreatingCompany] = useState(false);
    const [isCreatingContact, setIsCreatingContact] = useState(false);
    const [unifiedDrawerTarget, setUnifiedDrawerTarget] = useState<{ contactId: string | null; companyId: string } | null>(null);
    const [clientBookingUrl, setClientBookingUrl] = useState("");
    const [clientInterlocuteurs, setClientInterlocuteurs] = useState<ClientInterlocuteur[]>([]);

    const hasAppliedUrlDrawers = useRef(false);

    // Resolve params
    useEffect(() => {
        params.then((p) => setListId(p.id));
    }, [params]);

    // ============================================
    // FETCH LIST
    // ============================================

    const fetchList = useCallback(
        async ({ silent = false }: { silent?: boolean } = {}) => {
            if (!listId) return;

            if (silent) setIsRefreshing(true);
            else setIsLoading(true);

            try {
                const [listRes, companiesRes] = await Promise.all([
                    fetch(`/api/lists/${listId}`),
                    fetch(`/api/lists/${listId}/companies`),
                ]);

                const listJson = await listRes.json();
                const companiesJson = await companiesRes.json();

                if (listJson.success) {
                    setList(listJson.data);
                } else {
                    showError("Erreur", listJson.error || "Liste non trouvée");
                    router.push("/manager/lists");
                }

                if (companiesJson.success) {
                    setCompanies(companiesJson.data);
                }
            } catch (err) {
                console.error("Failed to fetch list:", err);
                showError("Erreur", "Impossible de charger la liste");
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        // showError/router are stable in practice; listId is the real dependency.
        [listId] // eslint-disable-line react-hooks/exhaustive-deps
    );

    useEffect(() => {
        if (listId) {
            fetchList();
        }
    }, [listId, fetchList]);

    // A row action can change counts; refresh without flashing the skeleton.
    const refreshQuietly = useCallback(() => fetchList({ silent: true }), [fetchList]);

    useEffect(() => {
        const missionId = list?.mission?.id;
        if (!missionId) return;
        let mounted = true;
        (async () => {
            try {
                const res = await fetch(`/api/missions/${missionId}/client-booking`);
                const json = await res.json();
                if (!mounted || !json?.success) return;
                setClientBookingUrl(json.data?.bookingUrl ?? "");
                setClientInterlocuteurs(Array.isArray(json.data?.interlocuteurs) ? json.data.interlocuteurs : []);
            } catch {
                if (!mounted) return;
                setClientBookingUrl("");
                setClientInterlocuteurs([]);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [list?.mission?.id]);

    // ============================================
    // DERIVED DATA
    // ============================================
    // All of these walk every company (and every contact). Memoized so typing in
    // the table's search box doesn't re-flatten the whole list on each keystroke.

    const allContacts = useMemo<(Contact & { companyName: string })[]>(
        () =>
            companies.flatMap((company) =>
                company.contacts.map((contact) => ({
                    ...contact,
                    companyId: company.id,
                    companyName: company.name,
                }))
            ),
        [companies]
    );

    const totalContacts = useMemo(
        () => companies.reduce((acc, c) => acc + c._count.contacts, 0),
        [companies]
    );

    const companyStatusCounts = useMemo(() => {
        const counts: Record<CompletenessStatus, number> = { INCOMPLETE: 0, PARTIAL: 0, ACTIONABLE: 0 };
        for (const company of companies) {
            if (counts[company.status] !== undefined) counts[company.status] += 1;
        }
        return counts;
    }, [companies]);

    const contactStatusCounts = useMemo(() => {
        const counts: Record<CompletenessStatus, number> = { INCOMPLETE: 0, PARTIAL: 0, ACTIONABLE: 0 };
        for (const contact of allContacts) {
            if (counts[contact.status] !== undefined) counts[contact.status] += 1;
        }
        return counts;
    }, [allContacts]);

    const visibleCompanies = useMemo(
        () => (statusFilter === "ALL" ? companies : companies.filter((c) => c.status === statusFilter)),
        [companies, statusFilter]
    );

    const visibleContacts = useMemo(
        () => (statusFilter === "ALL" ? allContacts : allContacts.filter((c) => c.status === statusFilter)),
        [allContacts, statusFilter]
    );

    // Discover all custom field keys present in this list's companies
    const customCompanyFieldKeys = useMemo(
        () =>
            Array.from(
                new Set(
                    companies.flatMap((company) =>
                        company.customData ? Object.keys(company.customData) : []
                    )
                )
            ),
        [companies]
    );

    // Open contact + company drawers from URL (e.g. from global search)
    useEffect(() => {
        const contactId = searchParams.get("contactId");
        const companyId = searchParams.get("companyId");
        if (!contactId || !companyId || isLoading || !list || hasAppliedUrlDrawers.current || companies.length === 0) return;
        const contact = allContacts.find((c) => c.id === contactId);
        const company = companies.find((c) => c.id === companyId);
        if (contact && company) {
            hasAppliedUrlDrawers.current = true;
            setSelectedCompany(company);
            setSelectedContact(contact);
            setShowCompanyDrawer(true);
            setShowContactDrawer(true);
            router.replace(`/manager/lists/${listId}`, { scroll: false });
        }
    }, [searchParams, isLoading, list, companies, allContacts, listId, router]);

    // ============================================
    // DRAWER HANDLERS
    // ============================================

    const handleCompanyClick = (company: Company) => {
        setUnifiedDrawerTarget({ contactId: null, companyId: company.id });
    };

    const handleContactClick = (contact: Contact & { companyName: string }) => {
        setUnifiedDrawerTarget({ contactId: contact.id, companyId: contact.companyId });
    };

    const handleCompanyUpdate = (updatedCompany: Company) => {
        setCompanies((prev) =>
            prev.map((c) => (c.id === updatedCompany.id ? { ...c, ...updatedCompany } : c))
        );
        setSelectedCompany((prev) => (prev?.id === updatedCompany.id ? { ...prev, ...updatedCompany } : prev));
        // Refresh list to update counts if needed
        if (updatedCompany._count.contacts !== selectedCompany?._count.contacts) {
            refreshQuietly();
        }
    };

    const handleCompanyCreate = (newCompany: Company) => {
        setCompanies((prev) => [newCompany, ...prev]);
        refreshQuietly();
    };

    const handleContactCreate = (newContact: Contact & { companyName: string }) => {
        // Find company and add contact
        setCompanies((prev) =>
            prev.map((company) => {
                if (company.id === newContact.companyId) {
                    return {
                        ...company,
                        contacts: [...company.contacts, newContact],
                        _count: {
                            contacts: company._count.contacts + 1,
                        },
                    };
                }
                return company;
            })
        );
        refreshQuietly();
    };

    const handleContactUpdate = (updatedContact: Contact) => {
        // Update in companies list (nested)
        setCompanies((prev) =>
            prev.map((company) => {
                if (company.id === updatedContact.companyId) {
                    return {
                        ...company,
                        contacts: company.contacts.map((c) =>
                            c.id === updatedContact.id ? { ...c, ...updatedContact } : c
                        ),
                    };
                }
                return company;
            })
        );

        // Update selected contact if open
        if (selectedContact?.id === updatedContact.id) {
            setSelectedContact({
                ...updatedContact,
                companyName: selectedContact.companyName,
            });
        }

        // Update selected company's contacts if open
        if (selectedCompany && selectedCompany.id === updatedContact.companyId) {
            setSelectedCompany((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    contacts: prev.contacts.map((c) => (c.id === updatedContact.id ? updatedContact : c)),
                };
            });
        }
    };

    // Handle contact click from inside CompanyDrawer
    const handleCompanyContactClick = (contact: Contact) => {
        if (!selectedCompany) return;

        setSelectedContact({
            ...contact,
            companyName: selectedCompany.name,
            companyId: selectedCompany.id,
        });
        setShowCompanyDrawer(false);
        setTimeout(() => setShowContactDrawer(true), 100);
    };

    // ============================================
    // LIST ACTIONS
    // ============================================

    const handleDelete = async () => {
        if (!list) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/lists/${list.id}`, {
                method: "DELETE",
            });

            const json = await res.json();

            if (json.success) {
                success("Liste supprimée", `${list.name} a été supprimée`);
                router.push("/manager/lists");
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Impossible de supprimer la liste");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleExport = () => {
        if (!list) return;
        window.location.href = `/api/lists/${list.id}/export`;
    };

    const formatCustomFieldLabel = (key: string) => {
        // Convert snake_case / camelCase to "Title Case"
        const withSpaces = key
            .replace(/_/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2");
        return withSpaces
            .split(" ")
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

    // ============================================
    // COMPANY TABLE COLUMNS
    // ============================================
    // Four primary columns. Industrie/Pays and every imported CSV field are
    // secondary — reachable from the "+N colonnes" menu, not shown by default.

    const companyColumns = useMemo<Column<Company>[]>(
        () => [
            {
                key: "name",
                header: "Société",
                sortable: true,
                render: (_, company) => (
                    <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{company.name}</p>
                        {company.website && (
                            <a
                                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-amber hover:underline truncate block"
                            >
                                {company.website}
                            </a>
                        )}
                    </div>
                ),
            },
            {
                key: "contacts",
                header: "Contacts",
                render: (_, company) => (
                    <span className="text-ink-soft tabular-nums">{company._count.contacts}</span>
                ),
            },
            {
                key: "phone",
                header: "Téléphone",
                sortable: true,
                render: (value) =>
                    value ? (
                        <a
                            href={`tel:${value}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-ink-soft text-sm hover:text-amber"
                        >
                            {value}
                        </a>
                    ) : (
                        <span className="text-slate">—</span>
                    ),
            },
            {
                key: "status",
                header: "Statut",
                render: (value) => <StatusCell status={value as CompletenessStatus} />,
            },
            {
                key: "industry",
                header: "Industrie",
                sortable: true,
                importance: "secondary",
                render: (value) => <span className="text-ink-soft">{value || "—"}</span>,
            },
            {
                key: "country",
                header: "Pays",
                sortable: true,
                importance: "secondary",
                render: (value) => <span className="text-ink-soft">{value || "—"}</span>,
            },
        ],
        []
    );

    // Dynamically build columns for any custom company fields imported from CSV
    const customCompanyColumns = useMemo<Column<Company>[]>(
        () =>
            customCompanyFieldKeys.map((fieldKey) => ({
                key: `custom_${fieldKey}`,
                header: formatCustomFieldLabel(fieldKey),
                sortable: false,
                importance: "secondary",
                render: (_, company) => {
                    const value = company.customData ? company.customData[fieldKey] : undefined;
                    if (value === null || value === undefined || value === "") {
                        return <span className="text-slate">—</span>;
                    }
                    return <span className="text-ink-soft">{String(value)}</span>;
                },
            })),
        [customCompanyFieldKeys]
    );

    const companyTableColumns = useMemo(
        () => [...companyColumns, ...customCompanyColumns],
        [companyColumns, customCompanyColumns]
    );

    // ============================================
    // CONTACT TABLE COLUMNS
    // ============================================

    const contactColumns = useMemo<Column<Contact & { companyName: string }>[]>(
        () => [
            {
                key: "firstName",
                header: "Contact",
                sortable: true,
                render: (_, contact) => (
                    <div className="min-w-0">
                        <p className="font-medium text-ink truncate">
                            {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}
                        </p>
                        {contact.title && (
                            <p className="text-xs text-slate truncate">{contact.title}</p>
                        )}
                    </div>
                ),
            },
            {
                key: "companyName",
                header: "Société",
                sortable: true,
                render: (value) => <span className="text-ink-soft truncate">{value}</span>,
            },
            {
                key: "email",
                header: "Email",
                render: (value) =>
                    value ? (
                        <a
                            href={`mailto:${value}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-amber hover:underline text-sm"
                        >
                            {value}
                        </a>
                    ) : (
                        <span className="text-slate">—</span>
                    ),
            },
            {
                key: "phone",
                header: "Téléphone",
                render: (value) =>
                    value ? (
                        <a
                            href={`tel:${value}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-ink-soft text-sm hover:text-amber"
                        >
                            {value}
                        </a>
                    ) : (
                        <span className="text-slate">—</span>
                    ),
            },
            {
                key: "status",
                header: "Statut",
                render: (value) => <StatusCell status={value as CompletenessStatus} />,
            },
            {
                key: "linkedin",
                header: "LinkedIn",
                importance: "secondary",
                render: (value) =>
                    value ? (
                        <a
                            href={value.startsWith("http") ? value : `https://${value}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-amber hover:underline text-sm"
                        >
                            Profil
                        </a>
                    ) : (
                        <span className="text-slate">—</span>
                    ),
            },
        ],
        []
    );

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading || !list) {
        return (
            <div className="elan-page space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-paper-2 rounded-elan animate-pulse" />
                    <div className="space-y-2">
                        <div className="h-6 w-56 bg-paper-2 rounded animate-pulse" />
                        <div className="h-3.5 w-40 bg-paper-2 rounded animate-pulse" />
                    </div>
                </div>
                <div className="h-14 bg-paper-2 rounded-elan-lg animate-pulse" />
                <div className="h-96 bg-paper-2 rounded-elan-lg animate-pulse" />
            </div>
        );
    }

    const listActions: DropdownMenuItem[] = [
        {
            label: "Exporter en CSV",
            icon: <Download className="w-4 h-4" />,
            onClick: handleExport,
        },
        {
            label: "Modifier la liste",
            icon: <Edit className="w-4 h-4" />,
            onClick: () => router.push(`/manager/lists/${list.id}/edit`),
        },
        {
            label: isRefreshing ? "Actualisation…" : "Actualiser",
            icon: <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />,
            onClick: refreshQuietly,
            disabled: isRefreshing,
        },
        {
            label: "Supprimer la liste",
            icon: <Trash2 className="w-4 h-4" />,
            onClick: () => setShowDeleteModal(true),
            variant: "danger",
            divider: true,
        },
    ];

    const isCompaniesView = view === "companies";
    const activeCounts = isCompaniesView ? companyStatusCounts : contactStatusCounts;
    const activeTotal = isCompaniesView ? companies.length : allContacts.length;

    return (
        <div className="elan-page space-y-4">
            {/* ── 1. Identity row ─────────────────────────────────────────────
                Who am I looking at, how do I get back, what can I do to it.
                Destructive and rare actions live behind the ⋯ menu so the one
                primary action is unambiguous. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/manager/lists"
                        aria-label="Retour aux listes"
                        className="flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-elan border border-line bg-surface text-slate hover:text-ink hover:border-line-strong transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <h1 className="text-xl font-semibold text-ink tracking-tight truncate">
                                {list.name}
                            </h1>
                            <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-[0.07em] text-slate border border-line rounded px-1.5 py-0.5">
                                {list.type}
                            </span>
                        </div>
                        <p className="text-xs text-slate truncate">
                            {list.mission.client.name}
                            <span className="mx-1.5 text-line-strong">/</span>
                            {list.mission.name}
                            {list.source && (
                                <>
                                    <span className="mx-1.5 text-line-strong">/</span>
                                    {list.source}
                                </>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => {
                            if (isCompaniesView) {
                                setIsCreatingCompany(true);
                                setSelectedCompany(null);
                                setShowCompanyDrawer(true);
                            } else {
                                setIsCreatingContact(true);
                                setSelectedContact(null);
                                setShowContactDrawer(true);
                            }
                        }}
                        disabled={!isCompaniesView && companies.length === 0}
                        className="mgr-btn-primary inline-flex items-center gap-2 h-9 px-3.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                        {isCompaniesView ? "Société" : "Contact"}
                    </button>
                    <DropdownMenu
                        align="right"
                        width={200}
                        items={listActions}
                        trigger={
                            <span
                                role="button"
                                aria-label="Actions sur la liste"
                                className="flex items-center justify-center w-9 h-9 rounded-elan border border-line bg-surface text-slate hover:text-ink hover:border-line-strong transition-colors cursor-pointer"
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </span>
                        }
                    />
                </div>
            </div>

            {/* ── 2. Pulse strip ──────────────────────────────────────────────
                The four stat cards said what the tab labels and the coverage bar
                already say. One line of counts, then the health summary — the
                full 40-metric panel is one click away instead of always open. */}
            <div className="rounded-elan-lg border border-line bg-surface shadow-elan-sm divide-y divide-line">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                    <span className="text-sm text-ink">
                        <strong className="font-semibold tabular-nums">{companies.length}</strong>{" "}
                        <span className="text-slate">sociétés</span>
                    </span>
                    <span className="text-sm text-ink">
                        <strong className="font-semibold tabular-nums">{totalContacts}</strong>{" "}
                        <span className="text-slate">contacts</span>
                    </span>
                    <span className="text-sm text-ink">
                        <strong className="font-semibold tabular-nums">{companyStatusCounts.ACTIONABLE}</strong>{" "}
                        <span className="text-slate">sociétés actionnables</span>
                    </span>
                    <span className="text-sm text-ink">
                        <strong className="font-semibold tabular-nums">
                            {allContacts.filter((c) => c.email).length}
                        </strong>{" "}
                        <span className="text-slate">avec e-mail</span>
                    </span>
                </div>
                <div className="px-4 py-3">
                    <ProspectionHealthPanel listId={list.id} collapsible defaultExpanded={false} />
                </div>
            </div>

            {/* ── 3. Work surface ─────────────────────────────────────────────
                Everything above this point fits in ~150px, so the first row of
                real data is visible without scrolling. */}
            <div className="rounded-elan-lg border border-line bg-surface shadow-elan-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-line">
                    <div className="inline-flex items-center p-0.5 bg-paper rounded-elan border border-line">
                        <button
                            onClick={() => {
                                setView("companies");
                                setStatusFilter("ALL");
                            }}
                            className={`inline-flex items-center gap-2 h-8 px-3 rounded-[7px] text-xs font-medium transition-colors ${
                                isCompaniesView
                                    ? "bg-surface text-ink shadow-elan-sm"
                                    : "text-slate hover:text-ink"
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            Sociétés
                            <span className="tabular-nums text-slate">{companies.length}</span>
                        </button>
                        <button
                            onClick={() => {
                                setView("contacts");
                                setStatusFilter("ALL");
                            }}
                            className={`inline-flex items-center gap-2 h-8 px-3 rounded-[7px] text-xs font-medium transition-colors ${
                                !isCompaniesView
                                    ? "bg-surface text-ink shadow-elan-sm"
                                    : "text-slate hover:text-ink"
                            }`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Contacts
                            <span className="tabular-nums text-slate">{totalContacts}</span>
                        </button>
                    </div>

                    <FilterChips
                        value={statusFilter}
                        onChange={setStatusFilter}
                        counts={activeCounts}
                        total={activeTotal}
                    />
                </div>

                {activeTotal === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
                        <div className="w-12 h-12 rounded-full bg-paper border border-line flex items-center justify-center mb-4">
                            {isCompaniesView ? (
                                <Building2 className="w-5 h-5 text-slate" />
                            ) : (
                                <Users className="w-5 h-5 text-slate" />
                            )}
                        </div>
                        <h3 className="text-base font-semibold text-ink">
                            {isCompaniesView ? "Aucune société" : "Aucun contact"}
                        </h3>
                        <p className="text-sm text-slate mt-1 max-w-sm">
                            {isCompaniesView
                                ? "Cette liste est vide. Importez un fichier ou ajoutez une société pour commencer."
                                : "Ajoutez un contact depuis une société, ou importez un nouveau fichier."}
                        </p>
                    </div>
                ) : isCompaniesView ? (
                    <DataTable
                        data={visibleCompanies}
                        columns={companyTableColumns}
                        keyField="id"
                        searchable
                        searchPlaceholder="Rechercher une société (nom, industrie, pays, téléphone)…"
                        searchFields={["name", "industry", "country", "phone"]}
                        pagination
                        pageSize={25}
                        onRowClick={handleCompanyClick}
                        enableSecondaryColumnsToggle
                        emptyMessage="Aucune société ne correspond à ce filtre"
                    />
                ) : (
                    <DataTable
                        data={visibleContacts}
                        columns={contactColumns}
                        keyField="id"
                        searchable
                        searchPlaceholder="Rechercher un contact (nom, e-mail, téléphone, société)…"
                        searchFields={["firstName", "lastName", "email", "phone", "companyName"]}
                        pagination
                        pageSize={25}
                        onRowClick={handleContactClick}
                        enableSecondaryColumnsToggle
                        emptyMessage="Aucun contact ne correspond à ce filtre"
                    />
                )}
            </div>

            {/* Company Drawer */}
            {(showCompanyDrawer || selectedCompany) && (
                <CompanyDrawer
                    isOpen={showCompanyDrawer}
                    onClose={() => {
                        setShowCompanyDrawer(false);
                        setIsCreatingCompany(false);
                        setSelectedCompany(null);
                    }}
                    company={selectedCompany}
                    onUpdate={handleCompanyUpdate}
                    onCreate={isCreatingCompany ? handleCompanyCreate : undefined}
                    onContactClick={handleCompanyContactClick}
                    isManager={isManager}
                    listId={listId}
                    isCreating={isCreatingCompany}
                />
            )}

            {/* Contact Drawer */}
            {(showContactDrawer || selectedContact) && (
                <ContactDrawer
                    isOpen={showContactDrawer}
                    onClose={() => {
                        setShowContactDrawer(false);
                        setIsCreatingContact(false);
                        setSelectedContact(null);
                    }}
                    contact={selectedContact}
                    onUpdate={handleContactUpdate}
                    onCreate={isCreatingContact ? handleContactCreate : undefined}
                    isManager={isManager}
                    listId={listId}
                    companies={companies}
                    isCreating={isCreatingContact}
                />
            )}

            {/* Unified Action Drawer (open on row click) */}
            {unifiedDrawerTarget && (
                <UnifiedActionDrawer
                    isOpen={!!unifiedDrawerTarget}
                    onClose={() => setUnifiedDrawerTarget(null)}
                    contactId={unifiedDrawerTarget.contactId}
                    companyId={unifiedDrawerTarget.companyId}
                    missionId={list.mission.id}
                    missionName={list.mission.name}
                    clientBookingUrl={clientBookingUrl || undefined}
                    clientInterlocuteurs={clientInterlocuteurs}
                    onActionRecorded={refreshQuietly}
                    onContactSelect={(newContactId) => {
                        setUnifiedDrawerTarget((prev) => (prev ? { ...prev, contactId: newContactId } : prev));
                    }}
                />
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Supprimer la liste ?"
                message={`Êtes-vous sûr de vouloir supprimer "${list.name}" ? Cette action supprimera également toutes les sociétés et contacts associés.`}
                confirmText="Supprimer"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
