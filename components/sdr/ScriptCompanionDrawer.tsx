"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { Drawer, Tabs, Button, Select, TextSkeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
    sdrScriptCompanionCampaignsKey,
    sdrScriptCompanionDataKey,
} from "@/lib/query-keys";

interface ScriptCompanionDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    missionId?: string;
    missionName?: string;
}

type ScriptTabId = "base" | "additional" | "ai";

type CampaignSummary = {
    id: string;
    name: string;
};

type CompanionData = {
    campaignId: string;
    campaignName: string;
    baseScript: string;
    additionalDraft: string;
    additionalShared: string;
    sharedUpdatedAt: string | null;
    sharedUpdatedBy: string | null;
    aiShared: string;
    aiGeneratedAt: string | null;
    aiGeneratedFrom: string | null;
    defaultTab: "base" | "additional" | "ai";
};


function EmptyNote({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-xl border border-[#dfe7e3] bg-[#f7f9f8] px-4 py-6 text-center text-sm text-slate-600">
            {children}
        </p>
    );
}

/** A read-only script with a copy affordance — the SDR reads this live on a call. */
function ScriptPane({
    content,
    emptyLabel,
    meta,
}: {
    content: string;
    emptyLabel: string;
    meta?: React.ReactNode;
}) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1600);
        return () => window.clearTimeout(timer);
    }, [copied]);

    if (!content) return <EmptyNote>{emptyLabel}</EmptyNote>;

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#dfe7e3] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#e7ecea] bg-[#fafcfb] px-3 py-2">
                <div className="min-w-0">{meta}</div>
                <button
                    type="button"
                    onClick={() => {
                        void navigator.clipboard.writeText(content).then(() => setCopied(true));
                    }}
                    aria-label="Copier le script"
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-[#d7e3df] bg-white px-2 text-[11px] font-semibold text-[#1f4d47] transition-colors hover:bg-[#eef4f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c3b38]/20"
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copié" : "Copier"}
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-[1.7] text-slate-700">{content}</pre>
            </div>
        </div>
    );
}

export function ScriptCompanionDrawer({
    isOpen,
    onClose,
    missionId,
    missionName,
}: ScriptCompanionDrawerProps) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const [activeTab, setActiveTab] = useState<ScriptTabId>("base");
    const [additionalDraft, setAdditionalDraft] = useState("");
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const { data: campaigns = [], isFetching: campaignsLoading } = useQuery<CampaignSummary[]>({
        queryKey: sdrScriptCompanionCampaignsKey(isOpen && missionId ? missionId : null),
        queryFn: async () => {
            const res = await fetch(`/api/campaigns?missionId=${missionId}&isActive=true&limit=50`);
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data)) return [];
            return json.data as CampaignSummary[];
        },
        enabled: isOpen && !!missionId,
        staleTime: 60_000,
    });

    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const selectedCampaign = useMemo(
        () => campaigns.find((c) => c.id === selectedCampaignId) ?? campaigns[0] ?? null,
        [campaigns, selectedCampaignId]
    );

    const {
        data: companionData,
        isFetching: companionLoading,
        refetch: refetchCompanionData,
    } = useQuery<CompanionData | null>({
        queryKey: sdrScriptCompanionDataKey(isOpen && selectedCampaign ? selectedCampaign.id : null),
        queryFn: async () => {
            if (!selectedCampaign) return null;
            const res = await fetch(`/api/campaigns/${selectedCampaign.id}/script-companion`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Impossible de charger le script");
            return json.data as CompanionData;
        },
        enabled: isOpen && !!selectedCampaign,
        staleTime: 15_000,
    });

    useEffect(() => {
        if (companionData) {
            setAdditionalDraft(companionData.additionalDraft || companionData.additionalShared || "");
            if (companionData.defaultTab === "ai" || companionData.defaultTab === "base" || companionData.defaultTab === "additional") {
                setActiveTab(companionData.defaultTab);
            }
        } else {
            setAdditionalDraft("");
        }
    }, [companionData]);

    const isLoading = campaignsLoading || companionLoading;

    const hasUnsavedChanges = useMemo(
        () => (companionData?.additionalDraft ?? companionData?.additionalShared ?? "") !== additionalDraft,
        [companionData, additionalDraft]
    );

    const handleSaveDraft = async () => {
        if (!selectedCampaign) return;
        setIsSavingDraft(true);
        try {
            const res = await fetch(`/api/campaigns/${selectedCampaign.id}/script-companion`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ draft: additionalDraft }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Impossible de sauvegarder le brouillon");
            await refetchCompanionData();
            success("Brouillon sauvegardé", "Votre script additionel a bien été enregistré.");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Erreur inattendue";
            showError("Sauvegarde", message);
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleShare = async () => {
        if (!selectedCampaign) return;
        setIsPublishing(true);
        try {
            const res = await fetch(`/api/campaigns/${selectedCampaign.id}/script-companion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: additionalDraft }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Impossible de partager le script");
            await Promise.all([
                refetchCompanionData(),
                queryClient.invalidateQueries({
                    queryKey: sdrScriptCompanionDataKey(selectedCampaign.id),
                }),
            ]);
            success("Script partagé", "Le script additionel est maintenant partagé avec l'équipe.");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Erreur inattendue";
            showError("Partage", message);
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title="Script de campagne"
            description={missionName ? `Mission : ${missionName}` : undefined}
            size="lg"
            side="left"
            closeOnOverlay={false}
            modal={false}
            quarterWidth
            className="bg-white"
            contentClassName="@container !px-4 !pt-0 !pb-0 !bg-white flex flex-col"
        >
            {/* Tabs stay put while a long script scrolls under them. */}
            <div className="sticky top-0 z-10 -mx-4 bg-white/95 px-4 pb-3 pt-4 backdrop-blur">
                <Tabs
                    variant="pills"
                    activeTab={activeTab}
                    onTabChange={(tabId) => setActiveTab(tabId as ScriptTabId)}
                    tabs={[
                        { id: "base", label: "Script de base" },
                        { id: "additional", label: "Additionnel", badge: hasUnsavedChanges ? "•" : undefined },
                        { id: "ai", label: "Amélioré par IA" },
                    ]}
                />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
                {isLoading && (
                    <div className="space-y-3">
                        <TextSkeleton lines={1} className="h-8 w-2/3" />
                        <TextSkeleton lines={6} />
                    </div>
                )}

                {!campaignsLoading && campaigns.length === 0 && (
                    <EmptyNote>Aucune campagne active disponible pour cette mission.</EmptyNote>
                )}

                {!campaignsLoading && campaigns.length > 0 && companionData && (
                    <>
                        {/* One campaign: just name it. Several: let the SDR switch. */}
                        {campaigns.length > 1 ? (
                            <Select
                                label="Campagne"
                                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
                                value={selectedCampaign?.id}
                                onChange={setSelectedCampaignId}
                                searchable={campaigns.length > 6}
                            />
                        ) : (
                            <p className="truncate rounded-xl border border-[#dfe7e3] bg-[#f7f9f8] px-3 py-2 text-sm text-[#1f4d47]">
                                Campagne : <span className="font-semibold">{companionData.campaignName}</span>
                            </p>
                        )}

                        {activeTab === "base" ? (
                            <ScriptPane
                                content={companionData.baseScript}
                                emptyLabel="Aucun script de base configuré sur cette campagne."
                            />
                        ) : activeTab === "ai" ? (
                            <ScriptPane
                                content={companionData.aiShared}
                                emptyLabel="Aucun script IA disponible pour cette campagne."
                                meta={
                                    companionData.aiGeneratedAt ? (
                                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                            {companionData.aiGeneratedFrom ? `${companionData.aiGeneratedFrom} · ` : ""}
                                            {new Date(companionData.aiGeneratedAt).toLocaleDateString("fr-FR")}
                                        </span>
                                    ) : null
                                }
                            />
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col gap-2">
                                <textarea
                                    value={additionalDraft}
                                    onChange={(e) => setAdditionalDraft(e.target.value)}
                                    placeholder="Ajoutez votre script additionnel ici…"
                                    aria-label="Script additionnel"
                                    className="min-h-[220px] w-full flex-1 resize-none rounded-xl border border-[#dfe7e3] bg-white px-3 py-3 text-sm leading-6 text-slate-700 focus:border-[#0c3b38] focus:outline-none focus:ring-2 focus:ring-[#0c3b38]/15"
                                />

                                <p className="flex items-center gap-1.5 text-xs">
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "h-1.5 w-1.5 shrink-0 rounded-full",
                                            hasUnsavedChanges ? "bg-amber-500" : "bg-emerald-500"
                                        )}
                                    />
                                    <span className={hasUnsavedChanges ? "text-amber-700" : "text-slate-500"}>
                                        {hasUnsavedChanges ? "Modifications non sauvegardées" : "Brouillon à jour"}
                                    </span>
                                </p>

                                {companionData.sharedUpdatedAt && (
                                    <p className="text-xs text-slate-500">
                                        Partagé le {new Date(companionData.sharedUpdatedAt).toLocaleString("fr-FR")}
                                        {companionData.sharedUpdatedBy ? ` par ${companionData.sharedUpdatedBy}` : ""}
                                    </p>
                                )}

                                {/* Pinned so the SDR never has to scroll back to save. */}
                                <div className="sticky bottom-0 -mx-4 mt-1 flex flex-col gap-2 border-t border-[#dfe7e3] bg-white/95 px-4 pt-3 backdrop-blur @sm:flex-row">
                                    <Button
                                        onClick={handleSaveDraft}
                                        variant="secondary"
                                        disabled={isSavingDraft || isPublishing || !hasUnsavedChanges}
                                        isLoading={isSavingDraft}
                                        className="flex-1"
                                    >
                                        Sauvegarder le brouillon
                                    </Button>
                                    <Button
                                        onClick={handleShare}
                                        disabled={isPublishing || isSavingDraft || !additionalDraft.trim()}
                                        isLoading={isPublishing}
                                        className="flex-1"
                                    >
                                        Partager avec l&apos;équipe
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Drawer>
    );
}
