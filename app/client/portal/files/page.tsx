"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button, useToast } from "@/components/ui";
import { Upload, Trash2, Loader2, FileText, FileImage, FileSpreadsheet, File, FolderOpen, CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent, UMAMI_EVENTS } from "@/lib/analytics/umami";

const ACCEPT: Record<string, string[]> = {
    "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "application/vnd.ms-excel": [".xls"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-powerpoint": [".ppt"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    "text/plain": [".txt"],
    "text/csv": [".csv"],
};

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

interface ClientFile {
    id: string;
    originalName: string;
    size: number;
    formattedSize: string;
    createdAt: string;
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function getFileIcon(name: string): { icon: React.ElementType; color: string; bg: string } {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (["pdf"].includes(ext)) return { icon: FileText, color: "text-red-500", bg: "bg-red-50" };
    if (["xls", "xlsx", "csv"].includes(ext)) return { icon: FileSpreadsheet, color: "text-emerald-600", bg: "bg-emerald-50" };
    if (["doc", "docx", "txt"].includes(ext)) return { icon: FileText, color: "text-blue-500", bg: "bg-blue-50" };
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return { icon: FileImage, color: "text-purple-500", bg: "bg-purple-50" };
    if (["ppt", "pptx"].includes(ext)) return { icon: FileText, color: "text-orange-500", bg: "bg-orange-50" };
    return { icon: File, color: "text-[var(--elan-slate)]", bg: "bg-[var(--elan-paper)]" };
}

export default function ClientPortalFilesPage() {
    const toast = useToast();
    const [files, setFiles] = useState<ClientFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/client/files");
            const json = await res.json();
            if (json.success && json.data?.files) {
                setFiles(json.data.files);
            } else {
                setFiles([]);
            }
        } catch {
            toast.error("Erreur", "Impossible de charger les fichiers");
            setFiles([]);
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;
            setUploadingCount((c) => c + acceptedFiles.length);
            let successCount = 0;
            let failCount = 0;
            for (const file of acceptedFiles) {
                try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/files/upload", { method: "POST", body: formData });
                    const json = await res.json();
                    if (json.success) successCount++;
                    else failCount++;
                } catch {
                    failCount++;
                }
            }
            setUploadingCount((c) => Math.max(0, c - acceptedFiles.length));
            if (successCount > 0) {
                trackEvent(UMAMI_EVENTS.FILE_UPLOADED, { count: successCount });
                await fetchFiles();
                toast.success("Fichiers déposés", `${successCount} fichier(s) ajouté(s)`);
            }
            if (failCount > 0) {
                toast.error("Erreur", `${failCount} fichier(s) n'ont pas pu être uploadés`);
            }
        },
        [fetchFiles, toast]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxSize: MAX_SIZE,
        accept: ACCEPT,
        disabled: uploadingCount > 0,
    });

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/client/files/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                setFiles((prev) => prev.filter((f) => f.id !== id));
                toast.success("Fichier supprimé");
            } else {
                toast.error("Erreur", json.error || "Impossible de supprimer");
            }
        } catch {
            toast.error("Erreur", "Impossible de supprimer le fichier");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="min-h-full bg-gradient-to-br from-[var(--elan-paper)] via-[var(--elan-paper)] to-[var(--elan-paper-2)] p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3" style={{ animation: "filesFadeUp 0.35s ease both" }}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                    <FolderOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[var(--elan-ink)] tracking-tight">Mes Fichiers</h1>
                    <p className="text-xs text-[var(--elan-slate)] mt-0.5">Déposez vos fichiers pour les partager avec votre équipe</p>
                </div>
            </div>

            {/* Drop zone */}
            <div
                {...getRootProps()}
                className={cn(
                    "relative flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 overflow-hidden",
                    isDragActive
                        ? "border-[var(--elan-amber-deep)] bg-[rgba(219,228,223,0.8)] scale-[1.01]"
                        : "border-[#DDE0EC] bg-[var(--elan-surface)]/60 hover:border-[rgba(255,158,27,0.4)] hover:bg-[var(--elan-surface)]/80",
                    uploadingCount > 0 && "opacity-60 pointer-events-none"
                )}
                style={{ animation: "filesFadeUp 0.35s ease both", animationDelay: "50ms" }}
            >
                {isDragActive && (
                    <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />
                )}
                <input {...getInputProps()} />
                <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200",
                    isDragActive ? "bg-indigo-100 shadow-lg shadow-indigo-200/60" : "bg-[#F0F1F9] border border-[#E2E4F0]"
                )}>
                    {uploadingCount > 0 ? (
                        <Loader2 className="w-8 h-8 text-[var(--elan-petrol)] animate-spin" />
                    ) : isDragActive ? (
                        <CloudUpload className="w-8 h-8 text-[var(--elan-petrol)]" />
                    ) : (
                        <Upload className="w-8 h-8 text-[#7f8e89]" />
                    )}
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--elan-ink)]">
                        {uploadingCount > 0
                            ? `Envoi en cours (${uploadingCount} fichier${uploadingCount > 1 ? "s" : ""})…`
                            : isDragActive
                            ? "Relâchez pour déposer"
                            : "Glissez-déposez vos fichiers ici"}
                    </p>
                    <p className="text-xs text-[var(--elan-slate)] mt-1">
                        ou <span className="text-[var(--elan-petrol)] font-medium">parcourir</span> — PDF, DOCX, XLSX, images · max 100 MB
                    </p>
                </div>
            </div>

            {/* File list */}
            <div className="bg-[var(--elan-surface)] rounded-2xl border border-[var(--elan-line)] overflow-hidden shadow-sm" style={{ animation: "filesFadeUp 0.35s ease both", animationDelay: "90ms" }}>
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-7 h-7 text-[var(--elan-petrol)] animate-spin" />
                    </div>
                ) : files.length === 0 ? (
                    <div className="py-16 px-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--elan-paper)] flex items-center justify-center mx-auto mb-4">
                            <File className="w-6 h-6 text-[#899892]" />
                        </div>
                        <p className="text-sm font-semibold text-[var(--elan-ink)]">Aucun fichier déposé</p>
                        <p className="text-xs text-[var(--elan-slate)] mt-1 max-w-xs mx-auto">
                            Déposez des fichiers dans la zone ci-dessus pour les partager avec votre équipe.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="px-5 py-3 border-b border-[var(--elan-line)] bg-[var(--elan-paper)]">
                            <div className="grid grid-cols-[1fr,100px,140px,44px] gap-4">
                                <span className="text-[11px] font-bold text-[#899892] uppercase tracking-wider">Fichier</span>
                                <span className="text-[11px] font-bold text-[#899892] uppercase tracking-wider">Taille</span>
                                <span className="text-[11px] font-bold text-[#899892] uppercase tracking-wider">Déposé le</span>
                                <span />
                            </div>
                        </div>
                        <div className="divide-y divide-[var(--elan-line)]">
                            {files.map((f, idx) => {
                                const { icon: FileIcon, color, bg } = getFileIcon(f.originalName);
                                return (
                                    <div
                                        key={f.id}
                                        className="px-5 py-3.5 hover:bg-[var(--elan-paper)] transition-colors"
                                        style={{ animation: "filesFadeUp 0.3s ease both", animationDelay: `${90 + idx * 20}ms` }}
                                    >
                                        <div className="grid grid-cols-[1fr,100px,140px,44px] gap-4 items-center">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bg)}>
                                                    <FileIcon className={cn("w-4 h-4", color)} />
                                                </div>
                                                <span className="text-sm font-semibold text-[var(--elan-ink)] truncate">{f.originalName}</span>
                                            </div>
                                            <span className="text-sm text-[var(--elan-slate)]">{f.formattedSize}</span>
                                            <span className="text-sm text-[var(--elan-slate)]">{formatDate(f.createdAt)}</span>
                                            <div className="flex justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(f.id)}
                                                    disabled={deletingId === f.id}
                                                    className="w-8 h-8 p-0 text-[#899892] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    aria-label="Supprimer"
                                                >
                                                    {deletingId === f.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="px-5 py-3 border-t border-[var(--elan-line)] bg-[var(--elan-paper)]">
                            <p className="text-xs text-[#899892]">{files.length} fichier{files.length > 1 ? "s" : ""} · Accessibles par votre équipe dans le CRM</p>
                        </div>
                    </>
                )}
            </div>

            <style jsx global>{`
                @keyframes filesFadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: none; }
                }
            `}</style>
        </div>
    );
}
