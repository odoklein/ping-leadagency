"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ConfirmModal, DropdownMenu, useToast } from "@/components/ui";
import type { DropdownMenuItem } from "@/components/ui";
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
    Search,
    Globe2,
    Phone,
    Mail,
    X,
    ExternalLink,
    ChevronRight,
    Check,
    Copy,
    ArrowUpDown,
    Layers,
    Linkedin,
    Briefcase,
    MapPin,
    Eye,
    ArrowUpRight,
    PhoneCall,
} from "lucide-react";
import Link from "next/link";
import { ProspectionHealthPanel, type QuickFilterKey } from "@/components/lists/ProspectionHealthPanel";

// Dynamic Drawers
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
// TYPES & INTERFACES
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
    createdAt: string;
    updatedAt: string;
}

type CompletenessStatus = "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";

interface LatestAction {
    id: string;
    result: string;
    channel: string;
    createdAt: string;
}

interface Company {
    id: string;
    name: string;
    industry: string | null;
    country: string | null;
    website: string | null;
    phone: string | null;
    size: string | null;
    status: CompletenessStatus;
    customData?: Record<string, any> | null;
    actions?: LatestAction[];
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
    actions?: LatestAction[];
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

interface FlatContactRecord {
    contact: Contact;
    company: Company;
}

type ViewMode = "table" | "cards" | "contacts";
type SortOption = "name-asc" | "name-desc" | "contacts-desc" | "recent-desc" | "industry-asc";

// Action status formatting dictionary
const ACTION_RESULT_MAP: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    MEETING_BOOKED: { label: "RDV confirmé", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
    CALLBACK_REQUESTED: { label: "Rappel demandé", bg: "bg-sky-50 border-sky-200", text: "text-sky-700", dot: "bg-sky-500" },
    INTERESTED: { label: "Intéressé", bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700", dot: "bg-indigo-500" },
    NO_RESPONSE: { label: "Sans réponse", bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
    VOICEMAIL: { label: "Messagerie", bg: "bg-slate-100 border-slate-200", text: "text-slate-700", dot: "bg-slate-400" },
    DISQUALIFIED: { label: "Disqualifié", bg: "bg-rose-50 border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
    NOT_INTERESTED: { label: "Non intéressé", bg: "bg-slate-100 border-slate-200", text: "text-slate-600", dot: "bg-slate-400" },
    MEETING_CANCELLED: { label: "RDV annulé", bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-500" },
    BAD_CONTACT: { label: "Numéro KO", bg: "bg-rose-50 border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
    WRONG_NUMBER: { label: "Faux numéro", bg: "bg-rose-50 border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
};

// Deterministic gradient generator for company badges
const GRADIENT_PALETTES = [
    "from-emerald-500 to-teal-600 text-white",
    "from-blue-500 to-indigo-600 text-white",
    "from-violet-500 to-purple-600 text-white",
    "from-amber-500 to-orange-600 text-white",
    "from-teal-500 to-cyan-600 text-white",
    "from-sky-500 to-blue-600 text-white",
    "from-rose-500 to-pink-600 text-white",
    "from-slate-700 to-slate-900 text-white",
];

function getCompanyGradient(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % GRADIENT_PALETTES.length;
    return GRADIENT_PALETTES[idx];
}

function cleanWebsiteUrl(url: string | null | undefined): string {
    if (!url) return "";
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

function getInitials(text: string): string {
    if (!text) return "•";
    const parts = text.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { success: showSuccess, error: showError } = useToast();

    const isManager = session?.user?.role === "MANAGER";

    const [listId, setListId] = useState<string>("");
    const [list, setList] = useState<ListDetail | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // View & Filter states
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const [search, setSearch] = useState("");
    const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
    const [selectedCountry, setSelectedCountry] = useState<string>("all");
    const [selectedSize, setSelectedSize] = useState<string>("all");
    const [hasPhoneOnly, setHasPhoneOnly] = useState<boolean>(false);
    const [hasEmailOnly, setHasEmailOnly] = useState<boolean>(false);
    const [hasLinkedinOnly, setHasLinkedinOnly] = useState<boolean>(false);
    const [hasActionOnly, setHasActionOnly] = useState<boolean>(false);
    const [smartFilter, setSmartFilter] = useState<QuickFilterKey>("all");
    const [sortBy, setSortBy] = useState<SortOption>("name-asc");

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Clipboard feedback tracker
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // Search input ref
    const searchInputRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
        params.then((p) => setListId(p.id));
    }, [params]);

    // ============================================
    // FETCH LIST DATA
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
                    return;
                }

                if (companiesJson.success) {
                    setCompanies(companiesJson.data);
                }
            } catch (err) {
                showError("Erreur", "Impossible de charger les données de la liste");
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [listId, router, showError]
    );

    useEffect(() => {
        if (listId) fetchList();
    }, [listId, fetchList]);

    const refreshQuietly = useCallback(() => {
        fetchList({ silent: true });
    }, [fetchList]);

    // Fetch interlocuteurs & booking URL for UnifiedActionDrawer
    useEffect(() => {
        if (!list?.mission?.id) return;
        fetch(`/api/missions/${list.mission.id}/settings`)
            .then((r) => r.json())
            .then((res) => {
                if (res.success && res.data) {
                    if (res.data.bookingUrl) setClientBookingUrl(res.data.bookingUrl);
                    if (res.data.interlocuteurs) setClientInterlocuteurs(res.data.interlocuteurs);
                }
            })
            .catch(() => {});
    }, [list?.mission?.id]);

    // Keyboard shortcut to focus search with "/" or "Ctrl/Cmd+K"
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                (e.key === "/" &&
                    (e.target as HTMLElement).tagName !== "INPUT" &&
                    (e.target as HTMLElement).tagName !== "TEXTAREA") ||
                ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")
            ) {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === "Escape" && search) {
                setSearch("");
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [search]);

    // Copy to clipboard helper
    const handleCopy = (text: string, key: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        showSuccess("Copié !", `${label} : ${text}`);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // ============================================
    // DERIVED STATS & FILTERS
    // ============================================

    // Global Statistics / Executive KPI Cards
    const stats = useMemo(() => {
        const totalCompanies = companies.length;
        let totalContacts = 0;
        let withPhone = 0;
        let withEmail = 0;
        let withLinkedin = 0;
        let withActions = 0;

        companies.forEach((c) => {
            totalContacts += c.contacts.length;
            const companyHasPhone = !!c.phone || c.contacts.some((ct) => !!ct.phone);
            if (companyHasPhone) withPhone++;
            if (c.contacts.some((ct) => !!ct.email)) withEmail++;
            if (c.contacts.some((ct) => !!ct.linkedin)) withLinkedin++;
            if (c.actions && c.actions.length > 0) withActions++;
        });

        const phoneCoverage = totalCompanies > 0 ? Math.round((withPhone / totalCompanies) * 100) : 0;
        const emailCoverage = totalCompanies > 0 ? Math.round((withEmail / totalCompanies) * 100) : 0;
        const linkedinCoverage = totalCompanies > 0 ? Math.round((withLinkedin / totalCompanies) * 100) : 0;

        return {
            totalCompanies,
            totalContacts,
            withPhone,
            withEmail,
            withLinkedin,
            withActions,
            phoneCoverage,
            emailCoverage,
            linkedinCoverage,
        };
    }, [companies]);

    // Dynamic filter options
    const filterOptions = useMemo(() => {
        const industriesMap = new Map<string, number>();
        const countriesMap = new Map<string, number>();
        const sizesMap = new Map<string, number>();

        companies.forEach((c) => {
            if (c.industry) {
                industriesMap.set(c.industry, (industriesMap.get(c.industry) || 0) + 1);
            }
            if (c.country) {
                countriesMap.set(c.country, (countriesMap.get(c.country) || 0) + 1);
            }
            if (c.size) {
                sizesMap.set(c.size, (sizesMap.get(c.size) || 0) + 1);
            }
        });

        return {
            industries: Array.from(industriesMap.entries()).sort((a, b) => b[1] - a[1]),
            countries: Array.from(countriesMap.entries()).sort((a, b) => b[1] - a[1]),
            sizes: Array.from(sizesMap.entries()).sort((a, b) => b[1] - a[1]),
        };
    }, [companies]);

    // Filtered & Sorted Companies
    const filteredCompanies = useMemo(() => {
        const query = search.trim().toLowerCase();

        return companies
            .filter((c) => {
                // Search query
                if (query) {
                    const haystack = [
                        c.name,
                        c.industry,
                        c.country,
                        c.size,
                        c.website,
                        c.phone,
                        ...c.contacts.flatMap((ct) => [
                            ct.firstName,
                            ct.lastName,
                            ct.title,
                            ct.email,
                            ct.phone,
                        ]),
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    if (!haystack.includes(query)) return false;
                }

                // Dropdowns
                if (selectedIndustry !== "all" && c.industry !== selectedIndustry) return false;
                if (selectedCountry !== "all" && c.country !== selectedCountry) return false;
                if (selectedSize !== "all" && c.size !== selectedSize) return false;

                // Toggles
                if (hasPhoneOnly && !c.phone && !c.contacts.some((ct) => !!ct.phone)) return false;
                if (hasEmailOnly && !c.contacts.some((ct) => !!ct.email)) return false;
                if (hasLinkedinOnly && !c.contacts.some((ct) => !!ct.linkedin)) return false;
                if (hasActionOnly && (!c.actions || c.actions.length === 0)) return false;

                // Smart Queue Filters from Health Panel
                if (smartFilter === "virgin") {
                    if (c.actions && c.actions.length > 0) return false;
                } else if (smartFilter === "prospected") {
                    if (!c.actions || c.actions.length === 0) return false;
                } else if (smartFilter === "callbacks") {
                    const lastResult = c.actions?.[0]?.result;
                    if (
                        lastResult !== "CALLBACK_REQUESTED" &&
                        lastResult !== "INTERESTED" &&
                        lastResult !== "MEETING_BOOKED"
                    ) {
                        return false;
                    }
                } else if (smartFilter === "bad_contacts") {
                    const lastResult = c.actions?.[0]?.result;
                    const isBadAction = lastResult === "BAD_CONTACT" || lastResult === "WRONG_NUMBER";
                    const isMissingPhone = !c.phone && !c.contacts.some((ct) => !!ct.phone);
                    if (!isBadAction && !isMissingPhone && c.status !== "INCOMPLETE") return false;
                }

                return true;
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case "name-asc":
                        return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
                    case "name-desc":
                        return b.name.localeCompare(a.name, "fr", { sensitivity: "base" });
                    case "contacts-desc":
                        return b.contacts.length - a.contacts.length;
                    case "industry-asc":
                        return (a.industry || "").localeCompare(b.industry || "", "fr", { sensitivity: "base" });
                    default:
                        return 0;
                }
            });
    }, [
        companies,
        search,
        selectedIndustry,
        selectedCountry,
        selectedSize,
        hasPhoneOnly,
        hasEmailOnly,
        hasLinkedinOnly,
        hasActionOnly,
        smartFilter,
        sortBy,
    ]);

    // Flattened decision-maker contacts for "contacts" directory view
    const flatContacts = useMemo<FlatContactRecord[]>(() => {
        const list: FlatContactRecord[] = [];
        filteredCompanies.forEach((company) => {
            company.contacts.forEach((contact) => {
                list.push({ contact, company });
            });
        });
        return list;
    }, [filteredCompanies]);

    // Reset pagination when filter changes
    useEffect(() => {
        setPage(1);
    }, [
        search,
        selectedIndustry,
        selectedCountry,
        selectedSize,
        hasPhoneOnly,
        hasEmailOnly,
        hasLinkedinOnly,
        hasActionOnly,
        smartFilter,
        sortBy,
        viewMode,
    ]);

    // Active filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedIndustry !== "all") count++;
        if (selectedCountry !== "all") count++;
        if (selectedSize !== "all") count++;
        if (hasPhoneOnly) count++;
        if (hasEmailOnly) count++;
        if (hasLinkedinOnly) count++;
        if (hasActionOnly) count++;
        if (smartFilter !== "all") count++;
        return count;
    }, [
        selectedIndustry,
        selectedCountry,
        selectedSize,
        hasPhoneOnly,
        hasEmailOnly,
        hasLinkedinOnly,
        hasActionOnly,
        smartFilter,
    ]);

    const resetAllFilters = () => {
        setSearch("");
        setSelectedIndustry("all");
        setSelectedCountry("all");
        setSelectedSize("all");
        setHasPhoneOnly(false);
        setHasEmailOnly(false);
        setHasLinkedinOnly(false);
        setHasActionOnly(false);
        setSmartFilter("all");
        setSortBy("name-asc");
    };

    // Paginated subsets
    const totalItems = viewMode === "contacts" ? flatContacts.length : filteredCompanies.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const paginatedCompanies = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredCompanies.slice(start, start + pageSize);
    }, [filteredCompanies, page, pageSize]);

    const paginatedContacts = useMemo(() => {
        const start = (page - 1) * pageSize;
        return flatContacts.slice(start, start + pageSize);
    }, [flatContacts, page, pageSize]);

    // CSV Export Handler
    const handleExportCSV = () => {
        if (!list || filteredCompanies.length === 0) {
            showError("Export", "Aucune donnée à exporter.");
            return;
        }

        const headers = [
            "Entreprise",
            "Site Web",
            "Standard",
            "Secteur",
            "Taille",
            "Pays",
            "Statut Données",
            "Prénom Contact",
            "Nom Contact",
            "Poste",
            "Email Direct",
            "Téléphone Direct",
            "LinkedIn",
            "Dernière Action",
        ];

        const rows: string[][] = [];

        filteredCompanies.forEach((c) => {
            const lastAction = c.actions && c.actions[0]
                ? ACTION_RESULT_MAP[c.actions[0].result]?.label || c.actions[0].result
                : "Non contacté";

            if (c.contacts.length === 0) {
                rows.push([
                    c.name || "",
                    c.website || "",
                    c.phone || "",
                    c.industry || "",
                    c.size || "",
                    c.country || "",
                    c.status,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    lastAction,
                ]);
            } else {
                c.contacts.forEach((ct) => {
                    rows.push([
                        c.name || "",
                        c.website || "",
                        c.phone || "",
                        c.industry || "",
                        c.size || "",
                        c.country || "",
                        c.status,
                        ct.firstName || "",
                        ct.lastName || "",
                        ct.title || "",
                        ct.email || "",
                        ct.phone || "",
                        ct.linkedin || "",
                        lastAction,
                    ]);
                });
            }
        });

        const csvContent =
            "\uFEFF" +
            headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(";") +
            "\n" +
            rows
                .map((row) =>
                    row
                        .map((cell) => `"${(cell || "").toString().replace(/"/g, '""')}"`)
                        .join(";")
                )
                .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `liste_${list.name.replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showSuccess("Export CSV", `${rows.length} lignes exportées.`);
    };

    // ============================================
    // DRAWER HANDLERS
    // ============================================

    const handleCompanyClick = (company: Company) => {
        setUnifiedDrawerTarget({ contactId: null, companyId: company.id });
    };

    const handleContactClick = (contact: Contact) => {
        setUnifiedDrawerTarget({ contactId: contact.id, companyId: contact.companyId });
    };

    const handleCompanyContactClick = (contact: Contact) => {
        setSelectedContact({ ...contact, companyName: selectedCompany?.name || "" });
        setShowContactDrawer(true);
    };

    const handleCompanyUpdate = (updatedCompany: Company) => {
        setCompanies((prev) =>
            prev.map((c) => (c.id === updatedCompany.id ? { ...c, ...updatedCompany } : c))
        );
        setSelectedCompany((prev) => (prev?.id === updatedCompany.id ? { ...prev, ...updatedCompany } : prev));
        refreshQuietly();
    };

    const handleCompanyCreate = (newCompany: Company) => {
        setCompanies((prev) => [newCompany, ...prev]);
        refreshQuietly();
    };

    const handleContactCreate = (newContact: Contact & { companyName: string }) => {
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
        refreshQuietly();
    };

    const handleDelete = async () => {
        if (!list) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                showSuccess("Liste supprimée", "La liste a été supprimée avec succès");
                router.push("/manager/lists");
            } else {
                showError("Erreur", json.error || "Impossible de supprimer la liste");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue lors de la suppression");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    // ============================================
    // LOADING SKELETON
    // ============================================

    if (isLoading || !list) {
        return (
            <div className="elan-page space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse" />
                    <div className="space-y-2">
                        <div className="h-6 w-56 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3.5 w-40 bg-slate-100 rounded animate-pulse" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
                    ))}
                </div>
                <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
                <div className="h-96 bg-slate-100 rounded-2xl animate-pulse" />
            </div>
        );
    }

    const listActions: DropdownMenuItem[] = [
        {
            label: "Exporter en CSV",
            icon: <Download className="w-4 h-4" />,
            onClick: handleExportCSV,
        },
        {
            label: "Modifier la liste",
            icon: <Edit className="w-4 h-4" />,
            onClick: () => router.push(`/manager/lists/${list.id}/edit`),
        },
        {
            label: isRefreshing ? "Actualisation…" : "Actualiser",
            icon: <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />,
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

    return (
        <div className="elan-page space-y-6">
            {/* 1. IDENTITY & TOP HEADER ROW */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--elan-line)]">
                <div className="flex items-center gap-3.5 min-w-0">
                    <Link
                        href="/manager/lists"
                        aria-label="Retour aux listes"
                        className="flex items-center justify-center w-10 h-10 flex-shrink-0 rounded-xl border border-[var(--elan-line)] bg-[var(--elan-surface)] text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-xs"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-bold text-[var(--elan-ink)] tracking-tight truncate">
                                {list.name}
                            </h1>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5">
                                {list.type}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                            {list.mission.client.name}
                            <span className="mx-1.5 text-slate-300">/</span>
                            {list.mission.name}
                            {list.source && (
                                <>
                                    <span className="mx-1.5 text-slate-300">/</span>
                                    {list.source}
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={refreshQuietly}
                        disabled={isRefreshing}
                        title="Actualiser les données"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-[var(--elan-surface)] hover:bg-slate-50 border border-[var(--elan-line)] transition-all shadow-xs disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
                        <span className="hidden sm:inline">Actualiser</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setIsCreatingCompany(true);
                            setSelectedCompany(null);
                            setShowCompanyDrawer(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Société</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setIsCreatingContact(true);
                            setSelectedContact(null);
                            setShowContactDrawer(true);
                        }}
                        disabled={companies.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[var(--elan-line)] shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Contact</span>
                    </button>

                    <DropdownMenu
                        align="right"
                        width={200}
                        items={listActions}
                        trigger={
                            <button
                                type="button"
                                aria-label="Actions sur la liste"
                                className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--elan-line)] bg-[var(--elan-surface)] text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-xs cursor-pointer"
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        }
                    />
                </div>
            </div>

            {/* 2. EXECUTIVE KPI SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Comptes Cibles */}
                <div className="bg-[var(--elan-surface)] p-4 rounded-2xl border border-[var(--elan-line)] shadow-xs flex flex-col justify-between hover:border-emerald-300/60 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Comptes Cibles</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-2xl font-bold text-[var(--elan-ink)] tracking-tight">
                            {stats.totalCompanies.toLocaleString("fr-FR")}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {filterOptions.industries.length} secteurs d&apos;activité identifiés
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[var(--elan-line)] flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Prospectés / actifs</span>
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {stats.withActions} comptes
                        </span>
                    </div>
                </div>

                {/* 2. Décideurs Qualifiés */}
                <div className="bg-[var(--elan-surface)] p-4 rounded-2xl border border-[var(--elan-line)] shadow-xs flex flex-col justify-between hover:border-emerald-300/60 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Décideurs Répertoriés</span>
                        <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-2xl font-bold text-[var(--elan-ink)] tracking-tight">
                            {stats.totalContacts.toLocaleString("fr-FR")}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {(stats.totalCompanies > 0 ? (stats.totalContacts / stats.totalCompanies).toFixed(1) : 0)} contacts / compte
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[var(--elan-line)] flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Profils LinkedIn</span>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            {stats.withLinkedin} ({stats.linkedinCoverage}%)
                        </span>
                    </div>
                </div>

                {/* 3. Couverture Téléphone (Cliquable pour filtrer) */}
                <div
                    onClick={() => setHasPhoneOnly(!hasPhoneOnly)}
                    className={`cursor-pointer bg-[var(--elan-surface)] p-4 rounded-2xl border transition-all ${
                        hasPhoneOnly
                            ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                            : "border-[var(--elan-line)] hover:border-emerald-300/60 shadow-xs"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Couverture Téléphone</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Phone className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-[var(--elan-ink)] tracking-tight">
                                {stats.phoneCoverage}%
                            </span>
                            <span className="text-xs text-slate-500">
                                ({stats.withPhone} comptes)
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${stats.phoneCoverage}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[var(--elan-line)] flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Standard ou ligne directe</span>
                        <span className="font-semibold text-emerald-700">
                            {hasPhoneOnly ? "Filtre actif ✓" : "Filtrer"}
                        </span>
                    </div>
                </div>

                {/* 4. Couverture Email Direct (Cliquable pour filtrer) */}
                <div
                    onClick={() => setHasEmailOnly(!hasEmailOnly)}
                    className={`cursor-pointer bg-[var(--elan-surface)] p-4 rounded-2xl border transition-all ${
                        hasEmailOnly
                            ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                            : "border-[var(--elan-line)] hover:border-emerald-300/60 shadow-xs"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Emails Directs</span>
                        <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                            <Mail className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-[var(--elan-ink)] tracking-tight">
                                {stats.emailCoverage}%
                            </span>
                            <span className="text-xs text-slate-500">
                                ({stats.withEmail} comptes)
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-sky-500 to-blue-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${stats.emailCoverage}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[var(--elan-line)] flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Décideurs avec email</span>
                        <span className="font-semibold text-sky-700">
                            {hasEmailOnly ? "Filtre actif ✓" : "Filtrer"}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. COCKPIT SANTÉ DE PROSPECTION */}
            <div className="bg-[var(--elan-surface)] p-4 rounded-2xl border border-[var(--elan-line)] shadow-xs">
                <ProspectionHealthPanel
                    listId={list.id}
                    collapsible
                    defaultExpanded={false}
                    onQuickFilter={(key) => setSmartFilter(key)}
                    activeQuickFilter={smartFilter}
                />
            </div>

            {/* 4. COMMAND BAR: SEARCH, FILTERS, VIEW SWITCHER & SORT */}
            <div className="bg-[var(--elan-surface)] rounded-2xl border border-[var(--elan-line)] p-3.5 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-xl">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher une entreprise, secteur, nom de contact, email, poste..."
                            className="w-full h-10 pl-10 pr-16 rounded-xl border border-[var(--elan-line)] bg-[var(--elan-paper)] text-xs sm:text-sm text-[var(--elan-ink)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {search ? (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
                                    /
                                </kbd>
                            )}
                        </div>
                    </div>

                    {/* View Switcher & Sort */}
                    <div className="flex items-center gap-2.5 justify-between lg:justify-end flex-wrap">
                        {/* View Switcher Tabs */}
                        <div className="flex items-center p-1 bg-[var(--elan-paper)] border border-[var(--elan-line)] rounded-xl shadow-xs">
                            <button
                                type="button"
                                onClick={() => setViewMode("table")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    viewMode === "table"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Tableau</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("cards")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    viewMode === "cards"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                <span>Cartes</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("contacts")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    viewMode === "contacts"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span>Décideurs</span>
                            </button>
                        </div>

                        {/* Sort Dropdown */}
                        <div className="flex items-center gap-1.5">
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="h-9 px-2.5 rounded-xl border border-[var(--elan-line)] bg-[var(--elan-paper)] text-xs font-semibold text-[var(--elan-ink)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="name-asc">Nom (A → Z)</option>
                                <option value="name-desc">Nom (Z → A)</option>
                                <option value="contacts-desc">Plus de contacts</option>
                                <option value="industry-asc">Secteur</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Dropdowns & Boolean Filter Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--elan-line)]">
                    {/* Industry Dropdown */}
                    <select
                        value={selectedIndustry}
                        onChange={(e) => setSelectedIndustry(e.target.value)}
                        className={`h-8 px-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                            selectedIndustry !== "all"
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold"
                                : "border-[var(--elan-line)] bg-[var(--elan-paper)] text-slate-500 hover:text-slate-900"
                        }`}
                    >
                        <option value="all">Tous les secteurs ({filterOptions.industries.length})</option>
                        {filterOptions.industries.map(([ind, count]) => (
                            <option key={ind} value={ind}>
                                {ind} ({count})
                            </option>
                        ))}
                    </select>

                    {/* Country Dropdown */}
                    {filterOptions.countries.length > 1 && (
                        <select
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className={`h-8 px-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                selectedCountry !== "all"
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold"
                                    : "border-[var(--elan-line)] bg-[var(--elan-paper)] text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            <option value="all">Tous les pays ({filterOptions.countries.length})</option>
                            {filterOptions.countries.map(([c, count]) => (
                                <option key={c} value={c}>
                                    {c} ({count})
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Size Dropdown */}
                    {filterOptions.sizes.length > 1 && (
                        <select
                            value={selectedSize}
                            onChange={(e) => setSelectedSize(e.target.value)}
                            className={`h-8 px-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                selectedSize !== "all"
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold"
                                    : "border-[var(--elan-line)] bg-[var(--elan-paper)] text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            <option value="all">Toutes les tailles</option>
                            {filterOptions.sizes.map(([s, count]) => (
                                <option key={s} value={s}>
                                    {s} ({count})
                                </option>
                            ))}
                        </select>
                    )}

                    <div className="hidden sm:block h-4 w-px bg-slate-200 mx-1" />

                    {/* Quick Toggles */}
                    <button
                        type="button"
                        onClick={() => setHasPhoneOnly(!hasPhoneOnly)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            hasPhoneOnly
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-[var(--elan-paper)] text-slate-500 hover:text-slate-900 border border-[var(--elan-line)]"
                        }`}
                    >
                        <Phone className="w-3 h-3" />
                        <span>Téléphone dispo</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setHasEmailOnly(!hasEmailOnly)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            hasEmailOnly
                                ? "bg-sky-600 text-white shadow-xs"
                                : "bg-[var(--elan-paper)] text-slate-500 hover:text-slate-900 border border-[var(--elan-line)]"
                        }`}
                    >
                        <Mail className="w-3 h-3" />
                        <span>Email direct</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setHasLinkedinOnly(!hasLinkedinOnly)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            hasLinkedinOnly
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-[var(--elan-paper)] text-slate-500 hover:text-slate-900 border border-[var(--elan-line)]"
                        }`}
                    >
                        <Linkedin className="w-3 h-3" />
                        <span>LinkedIn</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setHasActionOnly(!hasActionOnly)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            hasActionOnly
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-[var(--elan-paper)] text-slate-500 hover:text-slate-900 border border-[var(--elan-line)]"
                        }`}
                    >
                        <PhoneCall className="w-3 h-3" />
                        <span>Déjà prospecté</span>
                    </button>

                    {/* Reset Button */}
                    {activeFiltersCount > 0 && (
                        <button
                            type="button"
                            onClick={resetAllFilters}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all ml-auto cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                            <span>Réinitialiser ({activeFiltersCount})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 5. CONTENT AREA: TABLEAU / CARTES / DÉCIDEURS */}
            {totalItems === 0 ? (
                /* Empty state */
                <div className="bg-[var(--elan-surface)] border-2 border-dashed border-[var(--elan-line)] rounded-3xl py-16 px-6 text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                        <Building2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-[var(--elan-ink)]">
                        Aucune entreprise ou contact ne correspond aux critères
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto">
                        Essayez de modifier votre recherche ou de réinitialiser vos filtres.
                    </p>
                    {activeFiltersCount > 0 || search ? (
                        <button
                            type="button"
                            onClick={resetAllFilters}
                            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Effacer tous les filtres</span>
                        </button>
                    ) : null}
                </div>
            ) : viewMode === "table" ? (
                /* MODE TABLEAU */
                <div className="bg-[var(--elan-surface)] rounded-2xl border border-[var(--elan-line)] overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-[var(--elan-paper)] border-b border-[var(--elan-line)] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Entreprise</th>
                                    <th className="py-3.5 px-4">Secteur & Taille</th>
                                    <th className="py-3.5 px-4">Standard & Pays</th>
                                    <th className="py-3.5 px-4">Décideurs Répertoriés</th>
                                    <th className="py-3.5 px-4">Statut Prospection</th>
                                    <th className="py-3.5 px-4 text-right">Fiche</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--elan-line)]">
                                {paginatedCompanies.map((company) => {
                                    const latestAction = company.actions && company.actions[0];
                                    const statusCfg = latestAction
                                        ? ACTION_RESULT_MAP[latestAction.result] || {
                                              label: latestAction.result,
                                              bg: "bg-slate-100",
                                              text: "text-slate-700",
                                              dot: "bg-slate-400",
                                          }
                                        : null;

                                    return (
                                        <tr
                                            key={company.id}
                                            onClick={() => handleCompanyClick(company)}
                                            className="hover:bg-emerald-50/25 transition-colors cursor-pointer group"
                                        >
                                            {/* Entreprise */}
                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${getCompanyGradient(
                                                            company.name
                                                        )} flex items-center justify-center font-bold text-xs shadow-xs shrink-0`}
                                                    >
                                                        {getInitials(company.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[var(--elan-ink)] text-xs sm:text-sm truncate group-hover:text-emerald-700 transition-colors">
                                                            {company.name}
                                                        </p>
                                                        {company.website ? (
                                                            <a
                                                                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-800 hover:underline transition-colors mt-0.5"
                                                            >
                                                                <Globe2 className="w-3 h-3 shrink-0" />
                                                                <span className="truncate max-w-[160px]">
                                                                    {cleanWebsiteUrl(company.website)}
                                                                </span>
                                                                <ArrowUpRight className="w-2.5 h-2.5 opacity-60" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400">Site non renseigné</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Secteur & Taille */}
                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="flex flex-col gap-1 max-w-[180px]">
                                                    {company.industry ? (
                                                        <span className="inline-flex items-center gap-1 font-medium text-[var(--elan-ink)] truncate">
                                                            <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="truncate">{company.industry}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                    {company.size && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                                            <Users className="w-3 h-3 text-slate-400" />
                                                            {company.size}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Standard & Pays */}
                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="flex flex-col gap-1 text-[11px]">
                                                    {company.phone ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <a
                                                                href={`tel:${company.phone}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="inline-flex items-center gap-1 text-[var(--elan-ink)] hover:text-emerald-700 font-medium"
                                                            >
                                                                <Phone className="w-3 h-3 text-emerald-600" />
                                                                {company.phone}
                                                            </a>
                                                            <button
                                                                type="button"
                                                                title="Copier le numéro"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopy(company.phone!, `phone-${company.id}`, "Standard");
                                                                }}
                                                                className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                                            >
                                                                {copiedKey === `phone-${company.id}` ? (
                                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                                ) : (
                                                                    <Copy className="w-3 h-3" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">Standard non renseigné</span>
                                                    )}
                                                    {company.country && (
                                                        <span className="inline-flex items-center gap-1 text-slate-500">
                                                            <MapPin className="w-3 h-3 text-slate-400" />
                                                            {company.country}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Décideurs Répertoriés */}
                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <Users className="w-3 h-3" />
                                                            {company.contacts.length} contact{company.contacts.length > 1 ? "s" : ""}
                                                        </span>
                                                        {company.contacts.some((c) => !!c.linkedin) && (
                                                            <span title="Profils LinkedIn disponibles" className="text-blue-600">
                                                                <Linkedin className="w-3.5 h-3.5" />
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Contact snippets */}
                                                    {company.contacts.slice(0, 2).map((ct) => {
                                                        const name = [ct.firstName, ct.lastName].filter(Boolean).join(" ") || "Contact";
                                                        return (
                                                            <div
                                                                key={ct.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleContactClick(ct);
                                                                }}
                                                                className="text-[11px] flex items-center gap-1.5 text-slate-600 truncate max-w-[200px] hover:text-emerald-700"
                                                            >
                                                                <span className="font-semibold text-slate-800 truncate">{name}</span>
                                                                {ct.title && <span className="text-slate-400 truncate">· {ct.title}</span>}
                                                            </div>
                                                        );
                                                    })}
                                                    {company.contacts.length > 2 && (
                                                        <span className="text-[10px] font-medium text-slate-400">
                                                            + {company.contacts.length - 2} autre{company.contacts.length - 2 > 1 ? "s" : ""}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Statut Prospection */}
                                            <td className="py-3.5 px-4 align-middle">
                                                {statusCfg ? (
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusCfg.bg} ${statusCfg.text}`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                                        {statusCfg.label}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-slate-400 bg-slate-100">
                                                        Non contacté
                                                    </span>
                                                )}
                                            </td>

                                            {/* Fiche action */}
                                            <td className="py-3.5 px-4 align-middle text-right">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCompanyClick(company);
                                                    }}
                                                    className="inline-flex items-center gap-1 p-2 rounded-xl text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all cursor-pointer"
                                                    title="Ouvrir la fiche d'action"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : viewMode === "cards" ? (
                /* MODE CARTES */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedCompanies.map((company) => {
                        const latestAction = company.actions && company.actions[0];
                        const statusCfg = latestAction
                            ? ACTION_RESULT_MAP[latestAction.result] || {
                                  label: latestAction.result,
                                  bg: "bg-slate-100",
                                  text: "text-slate-700",
                                  dot: "bg-slate-400",
                              }
                            : null;

                        return (
                            <div
                                key={company.id}
                                className="bg-[var(--elan-surface)] rounded-2xl border border-[var(--elan-line)] p-4 flex flex-col justify-between gap-4 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 group"
                            >
                                <div className="space-y-3">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div
                                                className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${getCompanyGradient(
                                                    company.name
                                                )} flex items-center justify-center font-bold text-sm shadow-xs shrink-0`}
                                            >
                                                {getInitials(company.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <h3
                                                    onClick={() => handleCompanyClick(company)}
                                                    className="font-bold text-sm sm:text-base text-[var(--elan-ink)] truncate cursor-pointer hover:text-emerald-700 transition-colors"
                                                >
                                                    {company.name}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                                                    {company.industry && (
                                                        <span className="font-medium text-slate-700">{company.industry}</span>
                                                    )}
                                                    {company.size && <span>· {company.size}</span>}
                                                    {company.country && (
                                                        <span className="inline-flex items-center gap-0.5 text-slate-500">
                                                            · <MapPin className="w-2.5 h-2.5" />
                                                            {company.country}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {statusCfg && (
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${statusCfg.bg} ${statusCfg.text}`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                                {statusCfg.label}
                                            </span>
                                        )}
                                    </div>

                                    {/* Phone & Website Bar */}
                                    <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-slate-600">
                                        {company.phone && (
                                            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                                                <Phone className="w-3 h-3 text-emerald-600" />
                                                <a href={`tel:${company.phone}`} className="hover:text-emerald-700 font-medium">
                                                    {company.phone}
                                                </a>
                                                <button
                                                    type="button"
                                                    title="Copier le numéro"
                                                    onClick={() => handleCopy(company.phone!, `phone-card-${company.id}`, "Numéro")}
                                                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                                >
                                                    {copiedKey === `phone-card-${company.id}` ? (
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                        {company.website && (
                                            <a
                                                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-medium bg-emerald-50/50 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 transition-colors"
                                            >
                                                <Globe2 className="w-3 h-3" />
                                                <span>{cleanWebsiteUrl(company.website)}</span>
                                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Contacts Accordion */}
                                    <div className="border-t border-slate-100 pt-2.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-emerald-600" />
                                                Décideurs ({company.contacts.length})
                                            </span>
                                        </div>

                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {company.contacts.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">Aucun décideur référencé</p>
                                            ) : (
                                                company.contacts.map((ct) => {
                                                    const name = [ct.firstName, ct.lastName].filter(Boolean).join(" ") || "Contact";
                                                    return (
                                                        <div
                                                            key={ct.id}
                                                            className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100/80 transition-colors space-y-1"
                                                        >
                                                            <div className="flex items-center justify-between gap-1">
                                                                <div
                                                                    onClick={() => handleContactClick(ct)}
                                                                    className="min-w-0 cursor-pointer hover:text-emerald-700"
                                                                >
                                                                    <p className="text-xs font-bold text-slate-800 truncate">{name}</p>
                                                                    {ct.title && (
                                                                        <p className="text-[11px] text-slate-500 truncate">{ct.title}</p>
                                                                    )}
                                                                </div>
                                                                {ct.linkedin && (
                                                                    <a
                                                                        href={ct.linkedin}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                                                                        title="Voir le profil LinkedIn"
                                                                    >
                                                                        <Linkedin className="w-3.5 h-3.5" />
                                                                    </a>
                                                                )}
                                                            </div>

                                                            {/* Contact action links */}
                                                            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                                                                {ct.email && (
                                                                    <div className="flex items-center gap-1 text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                                        <a
                                                                            href={`mailto:${ct.email}`}
                                                                            className="hover:text-emerald-700 flex items-center gap-1 font-medium truncate max-w-[150px]"
                                                                        >
                                                                            <Mail className="w-2.5 h-2.5 text-slate-400" />
                                                                            <span className="truncate">{ct.email}</span>
                                                                        </a>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleCopy(ct.email!, `mail-${ct.id}`, "Email")}
                                                                            title="Copier l'email"
                                                                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                                                        >
                                                                            {copiedKey === `mail-${ct.id}` ? (
                                                                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                                                            ) : (
                                                                                <Copy className="w-2.5 h-2.5" />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {ct.phone && (
                                                                    <div className="flex items-center gap-1 text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                                        <a
                                                                            href={`tel:${ct.phone}`}
                                                                            className="hover:text-emerald-700 flex items-center gap-1 font-medium"
                                                                        >
                                                                            <Phone className="w-2.5 h-2.5 text-slate-400" />
                                                                            <span>{ct.phone}</span>
                                                                        </a>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleCopy(ct.phone!, `ct-phone-${ct.id}`, "Ligne directe")}
                                                                            title="Copier le numéro"
                                                                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                                                        >
                                                                            {copiedKey === `ct-phone-${ct.id}` ? (
                                                                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                                                            ) : (
                                                                                <Copy className="w-2.5 h-2.5" />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Card Footer */}
                                <button
                                    type="button"
                                    onClick={() => handleCompanyClick(company)}
                                    className="w-full mt-2 py-2 px-3 rounded-xl border border-[var(--elan-line)] bg-slate-50 hover:bg-emerald-50 text-xs font-semibold text-slate-700 hover:text-emerald-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Consulter la fiche détaillée</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* MODE DÉCIDEURS DIRECTORY */
                <div className="bg-[var(--elan-surface)] rounded-2xl border border-[var(--elan-line)] overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-[var(--elan-paper)] border-b border-[var(--elan-line)] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Décideur</th>
                                    <th className="py-3.5 px-4">Poste / Fonction</th>
                                    <th className="py-3.5 px-4">Entreprise</th>
                                    <th className="py-3.5 px-4">Email Direct</th>
                                    <th className="py-3.5 px-4">Ligne Directe</th>
                                    <th className="py-3.5 px-4">LinkedIn</th>
                                    <th className="py-3.5 px-4 text-right">Fiche</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--elan-line)]">
                                {paginatedContacts.map(({ contact, company }) => {
                                    const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Contact";

                                    return (
                                        <tr
                                            key={`${company.id}-${contact.id}`}
                                            className="hover:bg-emerald-50/25 transition-colors cursor-pointer group"
                                            onClick={() => handleContactClick(contact)}
                                        >
                                            {/* Décideur */}
                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                                                        {getInitials(fullName)}
                                                    </div>
                                                    <span className="font-bold text-[var(--elan-ink)] text-xs sm:text-sm group-hover:text-emerald-700 transition-colors">
                                                        {fullName}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Poste */}
                                            <td className="py-3.5 px-4 align-middle font-medium text-slate-700">
                                                {contact.title || <span className="text-slate-400">—</span>}
                                            </td>

                                            {/* Entreprise */}
                                            <td className="py-3.5 px-4 align-middle font-semibold text-[var(--elan-ink)]">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate max-w-[160px]">{company.name}</span>
                                                </div>
                                            </td>

                                            {/* Email */}
                                            <td className="py-3.5 px-4 align-middle">
                                                {contact.email ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <a
                                                            href={`mailto:${contact.email}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-emerald-700 hover:underline font-medium truncate max-w-[180px]"
                                                        >
                                                            {contact.email}
                                                        </a>
                                                        <button
                                                            type="button"
                                                            title="Copier l'email"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopy(contact.email!, `dir-mail-${contact.id}`, "Email");
                                                            }}
                                                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                                        >
                                                            {copiedKey === `dir-mail-${contact.id}` ? (
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                            ) : (
                                                                <Copy className="w-3 h-3" />
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Phone */}
                                            <td className="py-3.5 px-4 align-middle">
                                                {contact.phone ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <a
                                                            href={`tel:${contact.phone}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-slate-800 hover:text-emerald-700 font-medium whitespace-nowrap"
                                                        >
                                                            {contact.phone}
                                                        </a>
                                                        <button
                                                            type="button"
                                                            title="Copier le numéro"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopy(contact.phone!, `dir-ph-${contact.id}`, "Ligne directe");
                                                            }}
                                                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                                        >
                                                            {copiedKey === `dir-ph-${contact.id}` ? (
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                            ) : (
                                                                <Copy className="w-3 h-3" />
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* LinkedIn */}
                                            <td className="py-3.5 px-4 align-middle">
                                                {contact.linkedin ? (
                                                    <a
                                                        href={contact.linkedin}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                                                    >
                                                        <Linkedin className="w-3.5 h-3.5" />
                                                        <span>Profil</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 align-middle text-right">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleContactClick(contact);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all cursor-pointer"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 6. PAGINATION FOOTER */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>
                            Affichage de{" "}
                            <strong className="text-slate-900 font-semibold">
                                {Math.min(totalItems, (page - 1) * pageSize + 1)}
                            </strong>{" "}
                            à{" "}
                            <strong className="text-slate-900 font-semibold">
                                {Math.min(totalItems, page * pageSize)}
                            </strong>{" "}
                            sur <strong className="text-slate-900 font-semibold">{totalItems}</strong>{" "}
                            {viewMode === "contacts" ? "décideurs" : "entreprises"}
                        </span>

                        <div className="flex items-center gap-1.5 ml-2">
                            <span>Par page :</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-7 px-2 rounded-lg border border-[var(--elan-line)] bg-[var(--elan-surface)] text-xs font-semibold cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1.5 rounded-lg border border-[var(--elan-line)] bg-[var(--elan-surface)] text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                Précédent
                            </button>

                            <div className="flex items-center gap-1 px-2 text-xs font-semibold text-slate-500">
                                Page <span className="text-slate-900 px-1">{page}</span> sur {totalPages}
                            </div>

                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 rounded-lg border border-[var(--elan-line)] bg-[var(--elan-surface)] text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                Suivant
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* DRAWERS & MODALS */}
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

            {/* Unified Action Drawer (opens on row click) */}
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

            {/* Delete Confirmation Modal */}
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
