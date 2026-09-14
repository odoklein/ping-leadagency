"use client";

import { AppLayoutShell } from "@/components/layout/AppLayoutShell";
import { CLIENT_NAV } from "@/lib/navigation/config";
import AssistantFab from "@/components/assistant/AssistantFab";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppLayoutShell
            allowedRoles={["CLIENT", "COMMERCIAL"]}
            customNavigation={CLIENT_NAV}
        >
            {children}
            {/* Global floating assistant launcher — replaced the support chat FAB. */}
            <AssistantFab />
        </AppLayoutShell>
    );
}
