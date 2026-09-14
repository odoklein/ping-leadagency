"use client";

import { AppLayoutShell } from "@/components/layout/AppLayoutShell";
import { COMMERCIAL_NAV } from "@/lib/navigation/config";
import AssistantFab from "@/components/assistant/AssistantFab";

export default function CommercialLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppLayoutShell
            allowedRoles={["COMMERCIAL"]}
            customNavigation={COMMERCIAL_NAV}
        >
            {children}
            {/* Global floating assistant launcher — replaced the support chat FAB. */}
            <AssistantFab />
        </AppLayoutShell>
    );
}
