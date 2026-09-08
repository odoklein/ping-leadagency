"use client";

import type { Client, ClientSession, MeetingsData, Meeting, ClientInterlocuteur } from "../../types";
import { ClientKpiGrid } from "./ClientKpiGrid";
import { ProductionEngagementCard } from "./ProductionEngagementCard";
import { NextMeetingBanner } from "./NextMeetingBanner";
import { ActiveMissionsSummary } from "./ActiveMissionsSummary";
import { RecentSessionsList } from "./RecentSessionsList";
import { PrimaryContactCard } from "./PrimaryContactCard";
import { PersonaIcpCard } from "./PersonaIcpCard";
import { CommercialsCard } from "./CommercialsCard";
import { PortalAccessCard } from "./PortalAccessCard";

interface OverviewTabProps {
    client: Client;
    sessions: ClientSession[];
    meetingsData: MeetingsData | null;
    openTasksCount: number;
    lastSessionDaysAgo: number | null;
    nextMeeting: Meeting | null | undefined;
    interlocuteurs: ClientInterlocuteur[];
    activatingPortalFor: string | null;
    deletingIntId: string | null;
    isSavingPortalSettings: boolean;
    onViewSessionsTab: () => void;
    onSelectSession: (sessionId: string) => void;
    onViewMissionsTab: () => void;
    onNewMission: () => void;
    onNewSession: () => void;
    onEditClient: () => void;
    onEditPersona: () => void;
    onAddCommercial: () => void;
    onEditCommercial: (interlocuteur: ClientInterlocuteur) => void;
    onDeleteCommercial: (id: string) => void;
    onActivatePortalForCommercial: (interlocuteur: ClientInterlocuteur) => void;
    onDeactivatePortalForCommercial: (interlocuteur: ClientInterlocuteur) => void;
    onOpenManageAccess: () => void;
    onQuickCreatePortalUser: () => void;
    onPortalVisibilityChange: (key: "portalShowCallHistory" | "portalShowDatabase", value: boolean) => Promise<void>;
    showToast: {
        success: (title: string, message?: string) => void;
        error: (title: string, message?: string) => void;
    };
}

export function OverviewTab({
    client,
    sessions,
    meetingsData,
    openTasksCount,
    lastSessionDaysAgo,
    nextMeeting,
    interlocuteurs,
    activatingPortalFor,
    deletingIntId,
    isSavingPortalSettings,
    onViewSessionsTab,
    onSelectSession,
    onViewMissionsTab,
    onNewMission,
    onNewSession,
    onEditClient,
    onEditPersona,
    onAddCommercial,
    onEditCommercial,
    onDeleteCommercial,
    onActivatePortalForCommercial,
    onDeactivatePortalForCommercial,
    onOpenManageAccess,
    onQuickCreatePortalUser,
    onPortalVisibilityChange,
    showToast,
}: OverviewTabProps) {
    return (
        <div className="space-y-6">
            {/* Top Row: Executive StatCards */}
            <ClientKpiGrid
                client={client}
                sessions={sessions}
                meetingsData={meetingsData}
                openTasksCount={openTasksCount}
                lastSessionDaysAgo={lastSessionDaysAgo}
                onViewSessions={onViewSessionsTab}
            />

            {/* Production & Contract Engagement */}
            <ProductionEngagementCard client={client} />

            {/* Upcoming Meeting Banner (if any) */}
            {nextMeeting && <NextMeetingBanner meeting={nextMeeting} />}

            {/* Main 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Missions & Sessions */}
                <div className="lg:col-span-2 space-y-6">
                    <ActiveMissionsSummary
                        missions={client.missions}
                        onViewAll={onViewMissionsTab}
                        onNewMission={onNewMission}
                    />

                    <RecentSessionsList
                        sessions={sessions}
                        onSelectSession={onSelectSession}
                        onViewAll={onViewSessionsTab}
                        onNewSession={onNewSession}
                    />
                </div>

                {/* Right 1 Col: Contact, Persona, Commercials & Portal Access */}
                <div className="space-y-4">
                    <PrimaryContactCard
                        client={client}
                        onEdit={onEditClient}
                        showToast={showToast}
                    />

                    <PersonaIcpCard
                        client={client}
                        onEdit={onEditPersona}
                    />

                    <CommercialsCard
                        interlocuteurs={interlocuteurs}
                        onAdd={onAddCommercial}
                        onEdit={onEditCommercial}
                        onDelete={onDeleteCommercial}
                        onActivatePortal={onActivatePortalForCommercial}
                        onDeactivatePortal={onDeactivatePortalForCommercial}
                        activatingPortalFor={activatingPortalFor}
                        deletingIntId={deletingIntId}
                        showToast={showToast}
                    />

                    <PortalAccessCard
                        client={client}
                        onOpenManageAccess={onOpenManageAccess}
                        onQuickCreate={onQuickCreatePortalUser}
                        onVisibilityChange={onPortalVisibilityChange}
                        isSavingSettings={isSavingPortalSettings}
                    />
                </div>
            </div>
        </div>
    );
}
