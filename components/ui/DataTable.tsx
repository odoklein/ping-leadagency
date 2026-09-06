"use client";

import { useState, useMemo, useEffect } from "react";
import {
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Search,
    X,
    Inbox,
    Square,
    CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// DATA TABLE COMPONENT
// ============================================

export interface Column<T> {
    key: string;
    header: string | React.ReactNode;
    sortable?: boolean;
    /** Path for sorting (e.g. "company.name", "confidence"). Uses key if not set. */
    sortField?: string;
    width?: string;
    render?: (value: any, row: T) => React.ReactNode;
    /** Optional importance flag used for primary vs secondary columns */
    importance?: "primary" | "secondary";
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyField: keyof T | ((row: T) => string);
    searchable?: boolean;
    searchPlaceholder?: string;
    searchFields?: (keyof T)[];
    pagination?: boolean;
    pageSize?: number;
    loading?: boolean;
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
    /** Optional class name per row (e.g. for highlighting recently updated rows) */
    getRowClassName?: (row: T) => string;
    className?: string;
    /** Enable UI to toggle visibility of columns marked as importance="secondary" */
    enableSecondaryColumnsToggle?: boolean;
    /** Enable row selection with checkboxes */
    selectable?: boolean;
    /** Currently selected row IDs (controlled) */
    selectedIds?: Set<string>;
    /** Callback when selection changes */
    onSelectionChange?: (selectedIds: string[]) => void;
}

type SortDirection = "asc" | "desc" | null;

/** Get value from row by key; supports nested paths e.g. "contact.firstName" */
function getValueAtPath<T extends Record<string, any>>(row: T, field: string): unknown {
    if (!field.includes(".")) return row[field];
    const parts = field.split(".");
    let current: unknown = row;
    for (const part of parts) {
        current = current != null && typeof current === "object" && part in current
            ? (current as Record<string, unknown>)[part]
            : undefined;
    }
    return current;
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    keyField,
    searchable = false,
    searchPlaceholder = "Rechercher...",
    searchFields,
    pagination = true,
    pageSize = 10,
    loading = false,
    emptyMessage = "Aucune donnée",
    onRowClick,
    getRowClassName,
    className,
    enableSecondaryColumnsToggle = false,
    selectable = false,
    selectedIds: controlledSelectedIds,
    onSelectionChange,
}: DataTableProps<T>) {
    const [searchQuery, setSearchQuery] = useState("");
    const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());

    const selectedIds = controlledSelectedIds ?? internalSelectedIds;
    const setSelectedIds = (updater: (prev: Set<string>) => Set<string>) => {
        const next = updater(selectedIds);
        onSelectionChange?.(Array.from(next));
        if (controlledSelectedIds === undefined) {
            setInternalSelectedIds(next);
        }
    };
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [showSecondaryMenu, setShowSecondaryMenu] = useState(false);

    // Compute secondary columns (those explicitly marked as such)
    const secondaryColumns = useMemo(
        () => columns.filter((c) => c.importance === "secondary"),
        [columns]
    );

    // Visible secondary column keys; by default show none if any secondary exist,
    // otherwise everything is treated as primary for backwards compatibility.
    const [visibleSecondaryKeys, setVisibleSecondaryKeys] = useState<string[]>([]);

    useEffect(() => {
        if (secondaryColumns.length === 0) {
            setVisibleSecondaryKeys([]);
            return;
        }
        // Initialize on columns change: hide all secondary columns by default
        setVisibleSecondaryKeys([]);
    }, [secondaryColumns]);

    // Columns actually rendered in the table (all primaries + visible secondaries)
    const visibleColumns = useMemo(
        () =>
            columns.filter(
                (c) =>
                    c.importance !== "secondary" ||
                    visibleSecondaryKeys.includes(c.key)
            ),
        [columns, visibleSecondaryKeys]
    );

    // Get row key
    const getRowKey = (row: T): string => {
        if (typeof keyField === "function") {
            return keyField(row);
        }
        return String(row[keyField]);
    };

    // Filter data (supports nested paths in searchFields e.g. "contact.firstName")
    const filteredData = useMemo(() => {
        const trimmedQuery = searchQuery.trim();
        if (!trimmedQuery) return data;

        const query = trimmedQuery.toLowerCase();
        // Phone numbers are stored in inconsistent formats (spaces, dashes, +33 vs 0...).
        // When the query looks like a phone number, also compare digits-only so
        // formatting differences between the typed query and the stored value don't matter.
        const isPhoneLikeQuery = /^[0-9+\-\s().]+$/.test(trimmedQuery);
        const queryDigits = isPhoneLikeQuery ? trimmedQuery.replace(/\D/g, "") : "";

        return data.filter((row) => {
            const fieldsToSearch = searchFields || (Object.keys(row) as (keyof T)[]);
            return fieldsToSearch.some((field) => {
                const value = getValueAtPath(row, field as string);
                if (value == null) return false;
                const stringValue = String(value).toLowerCase();
                if (stringValue.includes(query)) return true;
                if (queryDigits.length >= 4) {
                    return stringValue.replace(/\D/g, "").includes(queryDigits);
                }
                return false;
            });
        });
    }, [data, searchQuery, searchFields]);

    // Sort data (supports nested paths via sortField)
    const sortedData = useMemo(() => {
        if (!sortKey || !sortDirection) return filteredData;

        const column = columns.find((c) => c.key === sortKey);
        const path = (column?.sortField ?? sortKey) as string;

        return [...filteredData].sort((a, b) => {
            const aVal = getValueAtPath(a, path);
            const bVal = getValueAtPath(b, path);

            if (aVal === bVal) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            let comparison: number;
            if (typeof aVal === "number" && typeof bVal === "number") {
                comparison = aVal - bVal;
            } else {
                const aStr = String(aVal).toLowerCase();
                const bStr = String(bVal).toLowerCase();
                comparison = aStr.localeCompare(bStr);
            }
            return sortDirection === "asc" ? (comparison < 0 ? -1 : comparison > 0 ? 1 : 0) : comparison > 0 ? -1 : comparison < 0 ? 1 : 0;
        });
    }, [filteredData, sortKey, sortDirection, columns]);

    // Paginate data
    const paginatedData = useMemo(() => {
        if (!pagination) return sortedData;

        const start = (currentPage - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, pagination, currentPage, pageSize]);

    const totalPages = Math.ceil(sortedData.length / pageSize);

    // Reset to first page only when search query changes (not when data changes e.g. after quick action)
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // When data length changes (e.g. row removed), clamp current page so we don't show an empty page
    useEffect(() => {
        if (!pagination || totalPages < 1) return;
        setCurrentPage((p) => Math.min(p, totalPages));
    }, [sortedData.length, pageSize, pagination, totalPages]);

    // Handle row selection toggle
    const toggleRowSelection = (rowKey: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    };

    // Handle select all on current page
    const toggleSelectAllOnPage = (e: React.MouseEvent) => {
        e.stopPropagation();
        const pageKeys = paginatedData.map((r) => getRowKey(r));
        const allSelected = pageKeys.every((k) => selectedIds.has(k));
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                pageKeys.forEach((k) => next.delete(k));
            } else {
                pageKeys.forEach((k) => next.add(k));
            }
            return next;
        });
    };

    const allOnPageSelected = selectable && paginatedData.length > 0 && paginatedData.every((r) => selectedIds.has(getRowKey(r)));
    const someOnPageSelected = selectable && paginatedData.some((r) => selectedIds.has(getRowKey(r)));
    const allSelected = selectable && sortedData.length > 0 && sortedData.every((r) => selectedIds.has(getRowKey(r)));

    const toggleSelectAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (allSelected) {
            setSelectedIds(() => new Set());
        } else {
            const allKeys = sortedData.map((r) => getRowKey(r));
            setSelectedIds(() => new Set(allKeys));
        }
    };

    // Handle sort
    const handleSort = (key: string) => {
        if (sortKey === key) {
            if (sortDirection === "asc") {
                setSortDirection("desc");
            } else if (sortDirection === "desc") {
                setSortKey(null);
                setSortDirection(null);
            }
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    return (
        <div className={cn("space-y-0", className)}>
            {/* Search */}
            {searchable && (
                <div className="relative px-5 py-4 border-b border-slate-100 bg-slate-50/30">
                    <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}

            {/* Select all bar (when selectable) */}
            {selectable && sortedData.length > 0 && (
                <div className="flex items-center justify-between px-5 py-2 border-b border-slate-100 bg-slate-50/40">
                    <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                        {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                    {selectedIds.size > 0 && (
                        <span className="text-xs text-slate-500">
                            {selectedIds.size} sur {sortedData.length} sélectionné(s)
                        </span>
                    )}
                </div>
            )}

            {/* Secondary columns visibility toggle */}
            {enableSecondaryColumnsToggle && secondaryColumns.length > 0 && (
                <div className="flex justify-end px-5 py-2 border-b border-slate-100 bg-slate-50/40 relative">
                    <button
                        type="button"
                        onClick={() => setShowSecondaryMenu((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
                    >
                        Colonnes secondaires
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    {showSecondaryMenu && (
                        <div className="absolute z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg right-5 top-9">
                            <div className="px-3 py-2 border-b border-slate-100">
                                <p className="text-xs font-semibold text-slate-500">
                                    Afficher / masquer
                                </p>
                            </div>
                            <div className="max-h-64 overflow-y-auto py-1">
                                {secondaryColumns.map((col) => {
                                    const checked = visibleSecondaryKeys.includes(col.key);
                                    return (
                                        <label
                                            key={col.key}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={checked}
                                                onChange={() => {
                                                    setVisibleSecondaryKeys((prev) =>
                                                        checked
                                                            ? prev.filter((k) => k !== col.key)
                                                            : [...prev, col.key]
                                                    );
                                                }}
                                            />
                                            <span>
                                                {typeof col.header === "string"
                                                    ? col.header
                                                    : col.key}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200/80">
                            {selectable && (
                                <th
                                    className="w-12 px-3 py-3.5 text-left"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={toggleSelectAllOnPage}
                                        className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded-lg border transition-colors",
                                            allOnPageSelected
                                                ? "bg-indigo-600 border-indigo-600 text-white"
                                                : "border-slate-200 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                                        )}
                                        aria-label={allOnPageSelected ? "Désélectionner la page" : "Sélectionner la page"}
                                    >
                                        {allOnPageSelected ? (
                                            <CheckSquare className="w-4 h-4" />
                                        ) : (
                                            <Square className={cn("w-4 h-4", someOnPageSelected && "opacity-50")} />
                                        )}
                                    </button>
                                </th>
                            )}
                            {visibleColumns.map((column) => (
                                <th
                                    key={column.key}
                                    className={cn(
                                        "px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider",
                                        column.sortable && "cursor-pointer select-none hover:text-slate-700 transition-colors"
                                    )}
                                    style={{ width: column.width }}
                                    onClick={() => column.sortable && handleSort(column.key)}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {typeof column.header === "string" ? (
                                            <span>{column.header}</span>
                                        ) : (
                                            column.header
                                        )}
                                        {column.sortable && (
                                            <span className="flex flex-col shrink-0">
                                                <ChevronUp
                                                    className={cn(
                                                        "w-3 h-3 -mb-1 transition-colors",
                                                        sortKey === column.key && sortDirection === "asc"
                                                            ? "text-indigo-600"
                                                            : "text-slate-300"
                                                    )}
                                                />
                                                <ChevronDown
                                                    className={cn(
                                                        "w-3 h-3 -mt-1 transition-colors",
                                                        sortKey === column.key && sortDirection === "desc"
                                                            ? "text-indigo-600"
                                                            : "text-slate-300"
                                                    )}
                                                />
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                                    className="px-5 py-16 text-center"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm text-slate-500 font-medium">Chargement...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                                    className="px-5 py-16 text-center"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                                            <Inbox className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">{emptyMessage}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((row, index) => {
                                const rowKey = getRowKey(row);
                                const isSelected = selectedIds.has(rowKey);
                                return (
                                <tr
                                    key={rowKey}
                                    onClick={() => onRowClick?.(row)}
                                    className={cn(
                                        "group transition-all duration-150",
                                        onRowClick && "cursor-pointer",
                                        index % 2 === 0 ? "bg-white" : "bg-slate-50/30",
                                        onRowClick && "hover:bg-indigo-50/40",
                                        selectable && isSelected && "bg-indigo-50/60",
                                        getRowClassName?.(row)
                                    )}
                                    style={{
                                        animationDelay: `${index * 20}ms`,
                                    }}
                                >
                                    {selectable && (
                                        <td
                                            className="w-12 px-3 py-3.5"
                                            onClick={(e) => toggleRowSelection(rowKey, e)}
                                        >
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleRowSelection(rowKey);
                                                }}
                                                className={cn(
                                                    "flex items-center justify-center w-8 h-8 rounded-lg border transition-colors",
                                                    isSelected
                                                        ? "bg-indigo-600 border-indigo-600 text-white"
                                                        : "border-slate-200 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                                                )}
                                                aria-label={isSelected ? "Désélectionner" : "Sélectionner"}
                                            >
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4" />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                            </button>
                                        </td>
                                    )}
                                    {visibleColumns.map((column) => (
                                        <td
                                            key={column.key}
                                            className="px-5 py-3.5 text-sm text-slate-700"
                                        >
                                            {column.render
                                                ? column.render(row[column.key], row)
                                                : row[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/30">
                    <span className="text-xs text-slate-500 font-medium">
                        <span className="text-slate-700">{((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, sortedData.length)}</span>
                        {" "}sur{" "}
                        <span className="text-slate-700">{sortedData.length}</span>
                    </span>

                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-0.5 mx-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={cn(
                                            "min-w-[32px] h-8 rounded-lg text-xs font-semibold transition-all duration-150",
                                            pageNum === currentPage
                                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                        )}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DataTable;
