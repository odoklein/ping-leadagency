"use client";

import {
    SlidersHorizontal,
    ListChecks,
    Megaphone,
    ShieldCheck,
    BellRing,
} from "lucide-react";
import { SubNav, SubNavItem } from "@/components/ui/SubNav";

const ITEMS: SubNavItem[] = [
    {
        href: "/manager/settings",
        label: "Général",
        icon: SlidersHorizontal,
        exact: true,
    },
    {
        href: "/manager/settings/statuses",
        label: "Statuts d'appel",
        icon: ListChecks,
    },
    {
        href: "/manager/settings/broadcast",
        label: "Broadcast",
        icon: Megaphone,
    },
    {
        href: "/manager/settings/security-email",
        label: "Sécurité email",
        icon: ShieldCheck,
    },
    {
        href: "/manager/settings/task-reminders",
        label: "Rappels tâches",
        icon: BellRing,
    },
];

export function SettingsSubNav() {
    return <SubNav items={ITEMS} aria-label="Paramètres" />;
}

export default SettingsSubNav;
