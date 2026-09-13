"use client";

import { ReactNode, Suspense, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui";
import { createQueryClient } from "@/lib/query-client";
import { OpenReplayProvider } from "@/components/providers/OpenReplayProvider";

interface ProvidersProps {
    children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
    const [client] = useState(createQueryClient);
    return (
        <QueryClientProvider client={client}>
            <SessionProvider>
                <Suspense fallback={null}>
                    <OpenReplayProvider />
                </Suspense>
                <ToastProvider position="top-right">
                    {children}
                </ToastProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
}
