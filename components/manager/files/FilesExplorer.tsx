"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Card, Input, PageHeader, useToast } from "@/components/ui";
import {
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  File as FileIcon,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Import,
  Info,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Search,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  X,
  Move,
  Check,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  Eye,
  Sparkles,
  Layers,
  Calendar,
  User,
  Building2,
  Filter,
  CheckSquare,
  Square,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import {
  type FileItem,
  type FolderItem,
  type ViewMode,
  type ActiveTab,
  type ItemKind,
  type SortField,
  type SortOrder,
  type FileTypeFilter,
  typeIcon,
  typeLabel,
  formatBytes,
  formatDateShort,
  getFolderColor,
  downloadUrl,
  getFileCategory,
  isImageFile,
} from "./file-utils";
import { FilePreviewModal } from "./FilePreviewModal";
import { FileDetailsInspector } from "./FileDetailsInspector";
import { FileStorageBar } from "./FileStorageBar";
import { FileBulkActionBar } from "./FileBulkActionBar";
import { trackEvent, UMAMI_EVENTS } from "@/lib/analytics/umami";
import {
  CreateFolderModal,
  ShareModal,
  MoveModal,
  RenameModal,
  ImportDriveProgressModal,
} from "./FileModals";

export default function FilesExplorer() {
  const { success, error: showError } = useToast();

  // Tab & View Preferences
  const [activeTab, setActiveTab] = useState<ActiveTab>("crm");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Data
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null; role?: string }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Navigation
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: "Accueil" },
  ]);

  // Filters, Search & Sorting
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>("all");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Selection
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  // Inspector / Details Side Drawer
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [inspectorTarget, setInspectorTarget] = useState<{ kind: ItemKind; item: FileItem | FolderItem } | null>(null);

  // In-app File Preview Modal
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Modals
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ kind: ItemKind; item: FileItem | FolderItem } | null>(null);
  const [shareMode, setShareMode] = useState<"link" | "direct">("link");
  const [isSubmittingShare, setIsSubmittingShare] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ kind: ItemKind; item: FileItem | FolderItem } | null>(null);
  const [renaming, setRenaming] = useState(false);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ kind: ItemKind; item: FileItem | FolderItem } | null>(null);
  const [moving, setMoving] = useState(false);

  // Context Menu
  const [ctxMenuPos, setCtxMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [ctxMenuTarget, setCtxMenuTarget] = useState<{
    kind: ItemKind;
    item: FileItem | FolderItem;
    isDriveItem?: boolean;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);

  // Google Drive
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<FileItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [drivePath, setDrivePath] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: "Mon Drive" },
  ]);
  const [importingFromDrive, setImportingFromDrive] = useState(false);
  const [importingFileName, setImportingFileName] = useState<string | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const foldersParams = new URLSearchParams();
      foldersParams.set("parentId", currentFolder ?? "root");
      if (clientFilter) foldersParams.set("clientId", clientFilter);
      const foldersRes = await fetch(`/api/folders?${foldersParams}`);
      const foldersJson = await foldersRes.json();
      if (foldersJson.success) setFolders(foldersJson.data.folders);

      const filesParams = new URLSearchParams();
      if (currentFolder) filesParams.set("folderId", currentFolder);
      if (clientFilter) filesParams.set("clientId", clientFilter);
      if (search) filesParams.set("search", search);
      const filesRes = await fetch(`/api/files?${filesParams}`);
      const filesJson = await filesRes.json();
      if (filesJson.success) setFiles(filesJson.data.files);
    } catch {
      showError("Erreur", "Impossible de charger les fichiers.");
    } finally {
      setIsLoading(false);
    }
  }, [currentFolder, search, clientFilter, showError]);

  const fetchDriveStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/google-drive/status");
      const json = await res.json();
      if (json.success) {
        setDriveConnected(Boolean(json.data.connected));
        setDriveEmail(json.data.email ?? null);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchDrive = useCallback(async () => {
    if (!driveConnected) return;
    setDriveLoading(true);
    try {
      const params = new URLSearchParams();
      if (driveFolderId) params.set("folderId", driveFolderId);
      const res = await fetch(`/api/integrations/google-drive/files?${params}`);
      const json = await res.json();
      if (json.success) {
        setDriveFolders(json.data.folders);
        setDriveFiles(
          json.data.files.map((f: any) => ({
            ...f,
            originalName: f.name,
            source: "google_drive",
          }))
        );
      }
    } finally {
      setDriveLoading(false);
    }
  }, [driveConnected, driveFolderId]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients?limit=200");
      const json = await res.json();
      if (json.success && json.data) {
        setClients(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch("/api/users?limit=100");
      const json = await res.json();
      const list = json?.data?.users ?? json?.users;
      if (json.success && Array.isArray(list)) {
        setUsers(list);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchClients();
    fetchUsers();
    fetchDriveStatus();
  }, [fetchClients, fetchUsers, fetchDriveStatus]);

  useEffect(() => {
    if (driveConnected) fetchDrive();
  }, [driveConnected, fetchDrive]);

  // ─── Filtered and Sorted Files ──────────────────────────────
  const displayedFiles = useMemo(() => {
    const sourceList = activeTab === "drive" ? driveFiles : files;
    let list = [...sourceList];

    // Filter by type
    if (typeFilter !== "all") {
      list = list.filter((f) => getFileCategory(f.mimeType) === typeFilter);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "date") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === "size") {
        cmp = (a.size || 0) - (b.size || 0);
      } else if (sortField === "type") {
        cmp = (a.mimeType || "").localeCompare(b.mimeType || "");
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }, [files, driveFiles, activeTab, typeFilter, sortField, sortOrder]);

  // ─── Folder Navigation ──────────────────────────────────────
  const navigateToFolder = (folderId: string | null, folderName: string) => {
    setCurrentFolder(folderId);
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());

    const idx = folderPath.findIndex((f) => f.id === folderId);
    if (idx >= 0) setFolderPath(folderPath.slice(0, idx + 1));
    else setFolderPath([...folderPath, { id: folderId, name: folderName }]);
  };

  const navigateDriveFolder = (folderId: string | null, folderName: string) => {
    setDriveFolderId(folderId);
    if (folderId === null) setDrivePath([{ id: null, name: "Mon Drive" }]);
    else {
      const idx = drivePath.findIndex((f) => f.id === folderId);
      if (idx >= 0) setDrivePath(drivePath.slice(0, idx + 1));
      else setDrivePath([...drivePath, { id: folderId, name: folderName }]);
    }
  };

  // ─── Dropzone Setup ─────────────────────────────────────────
  const uploadFilesToTarget = async (filesList: File[], targetFolderId?: string | null) => {
    if (activeTab === "drive") {
      if (!driveConnected) {
        showError("Erreur", "Google Drive n'est pas connecté.");
        return;
      }
      try {
        for (const file of filesList) {
          const form = new FormData();
          form.append("file", file);
          if (driveFolderId) form.append("folderId", driveFolderId);
          const res = await fetch("/api/integrations/google-drive/upload", { method: "POST", body: form });
          const json = await res.json();
          if (!json.success) throw new Error("Upload failed");
        }
        success("Google Drive", `${filesList.length} fichier(s) envoyé(s) vers Drive.`);
        fetchDrive();
      } catch {
        showError("Erreur", "Échec de l'envoi vers Google Drive.");
      }
      return;
    }

    try {
      for (const file of filesList) {
        const form = new FormData();
        form.append("file", file);
        const folderToUse = targetFolderId !== undefined ? targetFolderId : currentFolder;
        if (folderToUse) form.append("folderId", folderToUse);
        const res = await fetch("/api/files/upload", { method: "POST", body: form });
        const json = await res.json();
        if (!json.success) throw new Error("Upload failed");
      }
      trackEvent(UMAMI_EVENTS.FILE_UPLOADED, { count: filesList.length });
      success("Téléchargement réussi", `${filesList.length} fichier(s) ajouté(s) avec succès.`);
      fetchData();
    } catch {
      showError("Erreur", "Échec du téléchargement des fichiers.");
    }
  };

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) uploadFilesToTarget(accepted);
    },
    multiple: true,
    noClick: true,
    maxSize: 100 * 1024 * 1024,
  });

  // ─── Selection Helpers ──────────────────────────────────────
  const toggleSelectFile = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectFolder = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiles = () => {
    if (selectedFiles.size === displayedFiles.length && displayedFiles.length > 0) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(displayedFiles.map((f) => f.id)));
    }
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  };

  // ─── Keyboard Shortcuts ─────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "Escape") {
        clearSelection();
        setCtxMenuPos(null);
      } else if (e.key === " " && selectedFiles.size === 1 && !previewOpen) {
        // Space to preview selected file
        e.preventDefault();
        const selectedId = Array.from(selectedFiles)[0];
        const fileToPreview = displayedFiles.find((f) => f.id === selectedId);
        if (fileToPreview) {
          setPreviewFile(fileToPreview);
          setPreviewOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a" && !previewOpen) {
        e.preventDefault();
        selectAllFiles();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFiles, displayedFiles, previewOpen]);

  // ─── Actions Handlers ───────────────────────────────────────
  const handleCreateFolder = async (name: string, color: string, description?: string) => {
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, description, parentId: currentFolder }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Erreur de création");
      success("Dossier créé", `Le dossier « ${name} » a été créé.`);
      setCreateFolderOpen(false);
      fetchData();
    } catch (e: any) {
      showError("Erreur", e.message || "Impossible de créer le dossier.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFile = async (file: FileItem) => {
    if (!confirm(`Supprimer définitivement « ${file.name} » ?`)) return;
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error("delete failed");
      success("Supprimé", `« ${file.name} » a été supprimé.`);
      if (inspectorTarget?.item.id === file.id) setInspectorTarget(null);
      fetchData();
    } catch {
      showError("Erreur", "Impossible de supprimer ce fichier.");
    }
  };

  const handleDeleteFolder = async (folder: FolderItem) => {
    if ((folder._count.files ?? 0) > 0 || (folder._count.children ?? 0) > 0) {
      showError("Dossier non vide", "Veuillez vider le dossier avant de le supprimer.");
      return;
    }
    if (!confirm(`Supprimer le dossier « ${folder.name} » ?`)) return;
    try {
      const res = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error("delete failed");
      success("Supprimé", `Le dossier « ${folder.name} » a été supprimé.`);
      if (inspectorTarget?.item.id === folder.id) setInspectorTarget(null);
      fetchData();
    } catch {
      showError("Erreur", "Impossible de supprimer ce dossier.");
    }
  };

  const handleBulkDelete = async () => {
    const total = selectedFiles.size + selectedFolders.size;
    if (!total) return;
    if (!confirm(`Supprimer définitivement ces ${total} élément(s) ?`)) return;
    try {
      for (const id of selectedFiles) await fetch(`/api/files/${id}`, { method: "DELETE" });
      for (const id of selectedFolders) await fetch(`/api/folders/${id}`, { method: "DELETE" });
      success("Suppression terminée", `${total} élément(s) supprimé(s).`);
      clearSelection();
      setInspectorTarget(null);
      fetchData();
    } catch {
      showError("Erreur", "Erreur lors de la suppression groupée.");
    }
  };

  const handleBulkCopyLinks = async () => {
    if (!selectedFiles.size) return;
    try {
      const links = Array.from(selectedFiles)
        .map((id) => downloadUrl(id))
        .join("\n");
      await navigator.clipboard.writeText(links);
      success("Liens copiés", `${selectedFiles.size} lien(s) copié(s) dans le presse-papiers.`);
    } catch {
      showError("Erreur", "Impossible de copier les liens.");
    }
  };

  const handleDirectShareSubmit = async (userIds: string[]) => {
    if (!shareTarget || userIds.length === 0) return;
    setIsSubmittingShare(true);
    try {
      const url =
        shareTarget.kind === "file"
          ? `/api/files/${(shareTarget.item as FileItem).id}/share`
          : `/api/folders/${(shareTarget.item as FolderItem).id}/share`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Erreur");
      success("Partage réussi", `Partagé avec ${userIds.length} membre(s) de l'équipe.`);
      setShareOpen(false);
    } catch (e: any) {
      showError("Erreur", e?.message || "Impossible d'effectuer le partage.");
    } finally {
      setIsSubmittingShare(false);
    }
  };

  const handleConfirmRename = async (newName: string) => {
    if (!renameTarget) return;
    setRenaming(true);
    try {
      if (renameTarget.kind === "file") {
        const res = await fetch(`/api/files/${(renameTarget.item as FileItem).id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        const json = await res.json();
        if (!json.success) throw new Error("rename failed");
      } else {
        const res = await fetch(`/api/folders/${(renameTarget.item as FolderItem).id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        const json = await res.json();
        if (!json.success) throw new Error("rename failed");
      }
      success("Renommé", "Nom mis à jour avec succès.");
      setRenameOpen(false);
      setRenameTarget(null);
      fetchData();
    } catch {
      showError("Erreur", "Impossible de renommer.");
    } finally {
      setRenaming(false);
    }
  };

  const handleConfirmMove = async (destinationId: string | null) => {
    if (!moveTarget) return;
    setMoving(true);
    try {
      if (moveTarget.kind === "file") {
        const res = await fetch(`/api/files/${(moveTarget.item as FileItem).id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: destinationId }),
        });
        const json = await res.json();
        if (!json.success) throw new Error("move failed");
      } else {
        const res = await fetch(`/api/folders/${(moveTarget.item as FolderItem).id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: destinationId }),
        });
        const json = await res.json();
        if (!json.success) throw new Error("move failed");
      }
      success("Déplacé", "Élément déplacé avec succès.");
      setMoveOpen(false);
      setMoveTarget(null);
      fetchData();
    } catch {
      showError("Erreur", "Impossible de déplacer l'élément.");
    } finally {
      setMoving(false);
    }
  };

  const handleUpdateTags = async (file: FileItem, tags: string[]) => {
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      const json = await res.json();
      if (!json.success) throw new Error("tags update failed");
      success("Tags mis à jour", "Les tags ont été actualisés.");
      fetchData();
      if (inspectorTarget?.item.id === file.id) {
        setInspectorTarget({ kind: "file", item: { ...file, tags } });
      }
    } catch {
      showError("Erreur", "Impossible de modifier les tags.");
    }
  };

  const handleImportFromDrive = async (file: FileItem) => {
    setImportingFromDrive(true);
    setImportingFileName(file.name);
    try {
      const res = await fetch("/api/integrations/google-drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveFileId: file.id, crmFolderId: currentFolder || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error("Import failed");
      success("Import réussi", `« ${file.name} » a été copié dans votre CRM.`);
      fetchData();
    } catch {
      showError("Erreur", "Échec de l'import depuis Google Drive.");
    } finally {
      setImportingFromDrive(false);
      setImportingFileName(null);
    }
  };

  const handleConnectDrive = async () => {
    try {
      const res = await fetch("/api/integrations/google-drive/connect", { method: "POST" });
      const json = await res.json();
      if (json.success && json.data.authUrl) window.location.href = json.data.authUrl;
      else throw new Error("no url");
    } catch {
      showError("Erreur", "Connexion Google Drive impossible.");
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm("Déconnecter votre compte Google Drive ?")) return;
    try {
      const res = await fetch("/api/integrations/google-drive/disconnect", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error("failed");
      setDriveConnected(false);
      setDriveEmail(null);
      setActiveTab("crm");
      success("Déconnecté", "Google Drive a été déconnecté.");
    } catch {
      showError("Erreur", "Déconnexion impossible.");
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenuPos) return;
    const onDocClick = (e: MouseEvent) => {
      if (ctxMenuRef.current?.contains(e.target as Node)) return;
      setCtxMenuPos(null);
      setCtxMenuTarget(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [ctxMenuPos]);

  const openContextMenu = (
    e: React.MouseEvent,
    kind: ItemKind,
    item: FileItem | FolderItem,
    isDriveItem = false
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenuPos({ x: e.clientX, y: e.clientY });
    setCtxMenuTarget({ kind, item, isDriveItem });
  };

  const currentLocationLabel = useMemo(() => {
    if (activeTab === "drive") return drivePath[drivePath.length - 1]?.name ?? "Mon Drive";
    return folderPath[folderPath.length - 1]?.name ?? "Accueil";
  }, [activeTab, drivePath, folderPath]);

  return (
    <div {...getRootProps()} className="elan-page min-h-screen space-y-6 pb-24">
      <input {...getInputProps()} />

      {/* Drag & Drop Fullscreen Visual Overlay */}
      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-fade-in pointer-events-none">
          <div className="bg-white rounded-3xl border-2 border-dashed border-indigo-500 shadow-2xl p-10 text-center max-w-md animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-indigo-50/50">
              <Upload className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Déposez vos fichiers ici</h3>
            <p className="text-sm text-slate-500 mt-2">
              Ils seront automatiquement importés dans l&apos;espace « {currentLocationLabel} ».
            </p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Gestionnaire de Fichiers & Documents"
        subtitle={`Espace actif : ${currentLocationLabel}`}
        onRefresh={activeTab === "drive" ? fetchDrive : fetchData}
        isRefreshing={isLoading || driveLoading}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setCreateFolderOpen(true)}
              className="gap-2 rounded-xl shadow-xs"
            >
              <FolderPlus className="w-4 h-4 text-amber-500" />
              Nouveau dossier
            </Button>
            <Button
              variant="primary"
              onClick={openFilePicker}
              className="gap-2 rounded-xl shadow-sm shadow-indigo-500/20"
            >
              <Upload className="w-4 h-4" />
              Télécharger
            </Button>
          </div>
        }
      />

      {/* Storage Visualizer Banner */}
      <FileStorageBar
        files={files}
        foldersCount={folders.length}
        driveConnected={driveConnected}
        driveEmail={driveEmail}
        onConnectDrive={handleConnectDrive}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Main Content Area */}
        <div className="flex-1 w-full space-y-4 min-w-0">
          {/* Top Control Strip */}
          <Card className="p-4 bg-white/90 backdrop-blur-xl border-slate-200/80 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Source Switcher Pill */}
              <div className="flex items-center p-1 rounded-2xl bg-slate-100 border border-slate-200/80 shrink-0">
                <button
                  onClick={() => setActiveTab("crm")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "crm"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Fichiers CRM</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                    {files.length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    if (driveConnected) setActiveTab("drive");
                    else handleConnectDrive();
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "drive"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-500" />
                  <span>Google Drive</span>
                  {driveConnected ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ) : (
                    <span className="text-[10px] text-blue-600 underline">Connecter</span>
                  )}
                </button>
              </div>

              {/* Search input */}
              <div className="flex-1 max-w-md relative">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, tags, description…"
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                  className="rounded-2xl bg-slate-50/80 border-slate-200"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Actions & View Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Client filter */}
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50/80 border border-slate-200 rounded-2xl text-slate-800 text-xs font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Tous les clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Sort selector */}
                <div className="flex items-center bg-slate-50/80 border border-slate-200 rounded-2xl p-1">
                  <select
                    value={`${sortField}-${sortOrder}`}
                    onChange={(e) => {
                      const [f, o] = e.target.value.split("-") as [SortField, SortOrder];
                      setSortField(f);
                      setSortOrder(o);
                    }}
                    className="bg-transparent text-xs text-slate-700 font-medium px-2 py-1 focus:outline-none"
                  >
                    <option value="date-desc">Plus récents</option>
                    <option value="date-asc">Plus anciens</option>
                    <option value="name-asc">Nom (A → Z)</option>
                    <option value="name-desc">Nom (Z → A)</option>
                    <option value="size-desc">Taille (Grand → Petit)</option>
                    <option value="size-asc">Taille (Petit → Grand)</option>
                  </select>
                </div>

                {/* Grid / List view toggle */}
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-2xl p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-xl transition-all ${
                      viewMode === "grid"
                        ? "bg-white text-indigo-600 shadow-xs"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                    title="Vue Grille"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-xl transition-all ${
                      viewMode === "list"
                        ? "bg-white text-indigo-600 shadow-xs"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                    title="Vue Liste"
                  >
                    <ListIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Inspector toggle */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDetailsOpen((v) => !v)}
                  className={`gap-1.5 rounded-2xl text-xs ${detailsOpen ? "bg-indigo-50 text-indigo-700 border-indigo-200" : ""}`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{detailsOpen ? "Masquer" : "Détails"}</span>
                </Button>
              </div>
            </div>

            {/* Filter Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-slate-400 font-medium mr-1 text-[11px] uppercase tracking-wider">Filtre:</span>
              {[
                { key: "all", label: "Tous" },
                { key: "image", label: "Images" },
                { key: "document", label: "Documents" },
                { key: "sheet", label: "Tableurs" },
                { key: "media", label: "Médias" },
                { key: "code", label: "Code & Text" },
                { key: "archive", label: "Archives" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTypeFilter(f.key as FileTypeFilter)}
                  className={`px-3 py-1 rounded-xl font-medium transition-all whitespace-nowrap ${
                    typeFilter === f.key
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Interactive Breadcrumbs Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl text-xs shadow-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeTab === "crm"
                ? folderPath.map((crumb, idx) => {
                    const isLast = idx === folderPath.length - 1;
                    return (
                      <div key={crumb.id ?? "root"} className="flex items-center gap-1.5">
                        {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                        <button
                          onClick={() => navigateToFolder(crumb.id, crumb.name)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all ${
                            isLast
                              ? "bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-200/60"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          {idx === 0 ? (
                            <Home className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <Folder className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>{crumb.name}</span>
                        </button>
                      </div>
                    );
                  })
                : drivePath.map((crumb, idx) => {
                    const isLast = idx === drivePath.length - 1;
                    return (
                      <div key={crumb.id ?? "root-drive"} className="flex items-center gap-1.5">
                        {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                        <button
                          onClick={() => navigateDriveFolder(crumb.id, crumb.name)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all ${
                            isLast
                              ? "bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-200/60"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          {idx === 0 ? (
                            <Cloud className="w-3.5 h-3.5 text-blue-500" />
                          ) : (
                            <Folder className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          <span>{crumb.name}</span>
                        </button>
                      </div>
                    );
                  })}
            </div>

            {/* Quick Count & Select All */}
            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                {displayedFiles.length} fichier(s){activeTab === "crm" && folders.length > 0 ? `, ${folders.length} dossier(s)` : ""}
              </span>
              <button
                onClick={selectAllFiles}
                className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                title="Tout sélectionner (Ctrl+A)"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tout sélectionner</span>
              </button>
            </div>
          </div>

          {/* Folders Section (if CRM active) */}
          {activeTab === "crm" && folders.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                Dossiers ({folders.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {folders.map((folder) => {
                  const colorCfg = getFolderColor(folder.color);
                  const isSelected = selectedFolders.has(folder.id);

                  return (
                    <div
                      key={folder.id}
                      onClick={() => navigateToFolder(folder.id, folder.name)}
                      onContextMenu={(e) => openContextMenu(e, "folder", folder, false)}
                      className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/90 border-indigo-300 shadow-md ring-2 ring-indigo-500/20"
                          : "bg-white/90 hover:bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => toggleSelectFolder(folder.id, e)}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white border-slate-200 text-transparent group-hover:border-slate-400"
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>

                        {/* Folder icon */}
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${colorCfg.gradient} flex items-center justify-center text-white shadow-xs shrink-0`}
                        >
                          <Folder className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate" title={folder.name}>
                            {folder.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {folder._count?.files || 0} fichier(s) • {folder._count?.children || 0} dossier(s)
                          </p>
                        </div>
                      </div>

                      {/* Right Action Menu */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectorTarget({ kind: "folder", item: folder });
                          setDetailsOpen(true);
                        }}
                        className="p-1.5 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all"
                        title="Détails du dossier"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drive Folders Section (if Drive active) */}
          {activeTab === "drive" && driveFolders.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                Dossiers Drive ({driveFolders.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {driveFolders.map((f: any) => (
                  <div
                    key={f.id}
                    onClick={() => navigateDriveFolder(f.id, f.name)}
                    className="group flex items-center gap-3 p-3.5 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Folder className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate flex-1">{f.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Grid / List View */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
              Fichiers ({displayedFiles.length})
            </h4>

            {isLoading || driveLoading ? (
              <div className="py-16 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                <p className="text-sm font-medium">Chargement des fichiers…</p>
              </div>
            ) : displayedFiles.length === 0 ? (
              <Card className="p-12 text-center bg-white/80 rounded-3xl border-dashed border-2 border-slate-200">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                  <FileIcon className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Aucun fichier trouvé</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {search
                    ? `Aucun fichier ne correspond à votre recherche « ${search} ».`
                    : "Téléchargez des documents ou synchronisez Google Drive pour commencer."}
                </p>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <Button variant="secondary" onClick={() => setCreateFolderOpen(true)} className="gap-2">
                    <FolderPlus className="w-4 h-4" />
                    Créer un dossier
                  </Button>
                  <Button variant="primary" onClick={openFilePicker} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Télécharger
                  </Button>
                </div>
              </Card>
            ) : viewMode === "grid" ? (
              /* ─── GRID VIEW ────────────────────────────────────── */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5">
                {displayedFiles.map((file) => {
                  const typeVis = typeIcon(file.mimeType);
                  const isSelected = selectedFiles.has(file.id);
                  const isImage = isImageFile(file.mimeType);

                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        setInspectorTarget({ kind: "file", item: file });
                        setDetailsOpen(true);
                      }}
                      onDoubleClick={() => {
                        setPreviewFile(file);
                        setPreviewOpen(true);
                      }}
                      onContextMenu={(e) => openContextMenu(e, "file", file, file.source === "google_drive")}
                      className={`group relative flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/90 border-indigo-300 shadow-md ring-2 ring-indigo-500/20"
                          : "bg-white/95 hover:bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1"
                      }`}
                    >
                      {/* Top Visual Thumbnail Box */}
                      <div className="relative aspect-4/3 bg-slate-100/70 overflow-hidden flex items-center justify-center border-b border-slate-100">
                        {isImage && file.source !== "google_drive" ? (
                          <img
                            src={downloadUrl(file.id)}
                            alt={file.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${typeVis.gradient} flex items-center justify-center text-white shadow-md transition-transform duration-200 group-hover:scale-110`}
                          >
                            <typeVis.Icon className="w-7 h-7" />
                          </div>
                        )}

                        {/* Top-left selection checkbox */}
                        <button
                          onClick={(e) => toggleSelectFile(file.id, e)}
                          className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all z-10 ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                              : "bg-white/90 border-slate-300 text-transparent opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>

                        {/* Quick Hover Actions (Top-right) */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewFile(file);
                              setPreviewOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-xs transition-colors"
                            title="Aperçu rapide (Espace)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {file.source === "google_drive" ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImportFromDrive(file);
                              }}
                              className="p-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-xs transition-colors"
                              title="Importer dans CRM"
                            >
                              <Import className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                trackEvent(UMAMI_EVENTS.FILE_DOWNLOADED, { fileId: file.id });
                                const a = document.createElement("a");
                                a.href = downloadUrl(file.id);
                                a.download = file.originalName || file.name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="p-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-xs transition-colors"
                              title="Télécharger"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* File Card Info */}
                      <div className="p-3.5 flex flex-col gap-1.5 flex-1 justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-slate-900 truncate flex-1" title={file.name}>
                              {file.name}
                            </p>
                            {file.source === "google_drive" && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold">
                                Drive
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>{typeLabel(file.mimeType)}</span>
                            <span>{file.formattedSize || formatBytes(file.size)}</span>
                          </div>
                        </div>

                        {/* Tags & Author / Client row */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                          <span className="truncate max-w-[65%]">
                            {file.client?.name || file.uploadedBy?.name || formatDateShort(file.createdAt)}
                          </span>
                          {file.tags && file.tags.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                              #{file.tags[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ─── LIST / TABLE VIEW ────────────────────────────── */
              <Card className="p-0 overflow-hidden rounded-3xl border-slate-200/80 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="p-3.5 w-10 text-center">
                          <button
                            onClick={selectAllFiles}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Tout sélectionner"
                          >
                            <CheckSquare className="w-4 h-4" />
                          </button>
                        </th>
                        <th className="p-3.5">Nom</th>
                        <th className="p-3.5">Format</th>
                        <th className="p-3.5">Taille</th>
                        <th className="p-3.5">Client / Auteur</th>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">Tags</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedFiles.map((file) => {
                        const typeVis = typeIcon(file.mimeType);
                        const isSelected = selectedFiles.has(file.id);

                        return (
                          <tr
                            key={file.id}
                            onClick={() => {
                              setInspectorTarget({ kind: "file", item: file });
                              setDetailsOpen(true);
                            }}
                            onDoubleClick={() => {
                              setPreviewFile(file);
                              setPreviewOpen(true);
                            }}
                            onContextMenu={(e) => openContextMenu(e, "file", file, file.source === "google_drive")}
                            className={`group hover:bg-slate-50/80 cursor-pointer transition-colors ${
                              isSelected ? "bg-indigo-50/60" : ""
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-3.5 text-center" onClick={(e) => toggleSelectFile(file.id, e)}>
                              <button
                                className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "bg-white border-slate-200 text-transparent group-hover:border-slate-400"
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </button>
                            </td>

                            {/* Name & Icon */}
                            <td className="p-3.5 font-medium text-slate-900 max-w-xs truncate">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-8 h-8 rounded-lg ${typeVis.bg} ${typeVis.ring} ring-1 flex items-center justify-center shrink-0`}
                                >
                                  <typeVis.Icon className={`w-4 h-4 ${typeVis.fg}`} />
                                </div>
                                <span className="truncate" title={file.name}>
                                  {file.name}
                                </span>
                              </div>
                            </td>

                            {/* Format */}
                            <td className="p-3.5 text-slate-500">{typeLabel(file.mimeType)}</td>

                            {/* Size */}
                            <td className="p-3.5 text-slate-700 font-mono">
                              {file.formattedSize || formatBytes(file.size)}
                            </td>

                            {/* Client / Author */}
                            <td className="p-3.5 text-slate-600 truncate max-w-xs">
                              {file.client ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                                  {file.client.name}
                                </span>
                              ) : file.uploadedBy ? (
                                <span>{file.uploadedBy.name}</span>
                              ) : (
                                "—"
                              )}
                            </td>

                            {/* Date */}
                            <td className="p-3.5 text-slate-500 whitespace-nowrap">
                              {formatDateShort(file.createdAt)}
                            </td>

                            {/* Tags */}
                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {file.tags?.slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]"
                                  >
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setPreviewFile(file);
                                    setPreviewOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                                  title="Aperçu rapide"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {file.source !== "google_drive" && (
                                  <button
                                    onClick={() => {
                                      trackEvent(UMAMI_EVENTS.FILE_DOWNLOADED, { fileId: file.id });
                                      const a = document.createElement("a");
                                      a.href = downloadUrl(file.id);
                                      a.download = file.originalName || file.name;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                                    title="Télécharger"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setInspectorTarget({ kind: "file", item: file });
                                    setDetailsOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                                  title="Détails"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Slide-over Inspector / Details Side Drawer */}
        {detailsOpen && inspectorTarget && (
          <FileDetailsInspector
            isOpen={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            target={inspectorTarget}
            onPreview={(file) => {
              setPreviewFile(file);
              setPreviewOpen(true);
            }}
            onShareLink={(kind, item) => {
              setShareTarget({ kind, item });
              setShareMode("link");
              setShareOpen(true);
            }}
            onShareDirect={(kind, item) => {
              setShareTarget({ kind, item });
              setShareMode("direct");
              setShareOpen(true);
            }}
            onRename={(kind, item) => {
              setRenameTarget({ kind, item });
              setRenameOpen(true);
            }}
            onMove={(kind, item) => {
              setMoveTarget({ kind, item });
              setMoveOpen(true);
            }}
            onDelete={(kind, item) => {
              if (kind === "file") handleDeleteFile(item as FileItem);
              else handleDeleteFolder(item as FolderItem);
            }}
            onUpdateTags={handleUpdateTags}
          />
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <FileBulkActionBar
        selectedFileIds={selectedFiles}
        selectedFolderIds={selectedFolders}
        onClearSelection={clearSelection}
        onBulkCopyLinks={handleBulkCopyLinks}
        onBulkMove={() => {
          const firstFileId = Array.from(selectedFiles)[0];
          const firstFile = files.find((f) => f.id === firstFileId);
          if (firstFile) {
            setMoveTarget({ kind: "file", item: firstFile });
            setMoveOpen(true);
          }
        }}
        onBulkDelete={handleBulkDelete}
      />

      {/* Context Menu */}
      {ctxMenuPos && ctxMenuTarget && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={ctxMenuRef}
            className="fixed z-[9999] w-56 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl py-1.5 animate-scale-in text-xs"
            style={{
              left: Math.min(ctxMenuPos.x, window.innerWidth - 240),
              top: Math.min(ctxMenuPos.y, window.innerHeight - 320),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-2xl -mt-1.5 mb-1" />

            {ctxMenuTarget.kind === "file" && (
              <button
                className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50 font-medium"
                onClick={() => {
                  setPreviewFile(ctxMenuTarget.item as FileItem);
                  setPreviewOpen(true);
                  setCtxMenuPos(null);
                }}
              >
                <Eye className="w-3.5 h-3.5 text-indigo-500" />
                Aperçu rapide
              </button>
            )}

            <button
              className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setInspectorTarget({ kind: ctxMenuTarget.kind, item: ctxMenuTarget.item });
                setDetailsOpen(true);
                setCtxMenuPos(null);
              }}
            >
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Voir les détails
            </button>

            <button
              className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setShareTarget({ kind: ctxMenuTarget.kind, item: ctxMenuTarget.item });
                setShareMode("link");
                setShareOpen(true);
                setCtxMenuPos(null);
              }}
            >
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              Partager le lien
            </button>

            {!ctxMenuTarget.isDriveItem && (
              <button
                className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setShareTarget({ kind: ctxMenuTarget.kind, item: ctxMenuTarget.item });
                  setShareMode("direct");
                  setShareOpen(true);
                  setCtxMenuPos(null);
                }}
              >
                <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                Partager avec l&apos;équipe
              </button>
            )}

            {!ctxMenuTarget.isDriveItem && (
              <>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setRenameTarget({ kind: ctxMenuTarget.kind, item: ctxMenuTarget.item });
                    setRenameOpen(true);
                    setCtxMenuPos(null);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  Renommer
                </button>
                <button
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setMoveTarget({ kind: ctxMenuTarget.kind, item: ctxMenuTarget.item });
                    setMoveOpen(true);
                    setCtxMenuPos(null);
                  }}
                >
                  <Move className="w-3.5 h-3.5 text-slate-400" />
                  Déplacer vers…
                </button>
              </>
            )}

            {ctxMenuTarget.isDriveItem && (
              <>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-blue-600 hover:bg-blue-50 font-medium"
                  onClick={() => {
                    if (ctxMenuTarget.kind === "file") handleImportFromDrive(ctxMenuTarget.item as FileItem);
                    setCtxMenuPos(null);
                  }}
                >
                  <Import className="w-3.5 h-3.5" />
                  Importer dans le CRM
                </button>
              </>
            )}

            <div className="h-px bg-slate-100 my-1" />
            <button
              className="w-full px-3 py-2 text-left flex items-center gap-2 text-red-600 hover:bg-red-50"
              onClick={() => {
                if (ctxMenuTarget.kind === "file") handleDeleteFile(ctxMenuTarget.item as FileItem);
                else handleDeleteFolder(ctxMenuTarget.item as FolderItem);
                setCtxMenuPos(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </button>
          </div>,
          document.body
        )}

      {/* In-app File Preview Modal */}
      <FilePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        file={previewFile}
        allFiles={displayedFiles}
        onNavigateFile={(nextFile) => setPreviewFile(nextFile)}
      />

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onSubmit={handleCreateFolder}
        isLoading={creatingFolder}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        target={shareTarget}
        initialMode={shareMode}
        users={users}
        isLoadingUsers={isLoadingUsers}
        onDirectShare={handleDirectShareSubmit}
        isSubmittingDirect={isSubmittingShare}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        target={renameTarget}
        onSubmit={handleConfirmRename}
        isLoading={renaming}
      />

      {/* Move Modal */}
      <MoveModal
        isOpen={moveOpen}
        onClose={() => setMoveOpen(false)}
        target={moveTarget}
        folders={folders}
        onSubmit={handleConfirmMove}
        isLoading={moving}
      />

      {/* Google Drive Import Progress Modal */}
      <ImportDriveProgressModal isOpen={importingFromDrive} fileName={importingFileName} />
    </div>
  );
}
