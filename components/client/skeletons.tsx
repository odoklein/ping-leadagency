import { Skeleton } from "@/components/ui/Skeleton";

export function DashboardSkeleton() {
    return (
        <div className="min-h-full bg-[#F4F6F9] p-4 md:p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="bg-white rounded-2xl border border-[#E8EBF0] p-8">
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 flex flex-col items-center md:items-start gap-4">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-16 w-24" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="w-[120px] h-[120px] rounded-full" />
                    </div>
                    <div className="hidden md:block w-px bg-[#E8EBF0]" />
                    <div className="flex-1 space-y-6">
                        <Skeleton className="h-5 w-36" />
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex justify-between items-center">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E8EBF0] p-6 space-y-4">
                <Skeleton className="h-5 w-32" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-full max-w-md" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function MeetingsSkeleton() {
    return (
        <div className="min-h-full bg-[#F4F6F9] p-4 md:p-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-64 rounded-full" />
            </div>
            <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-28 rounded-lg" />
                ))}
            </div>
            <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border border-[#E8EBF0] p-6">
                        <div className="flex items-start gap-3">
                            <Skeleton className="h-3 w-3 rounded-full mt-1.5" />
                            <div className="flex-1 space-y-3">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-5 w-56" />
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ResultsSkeleton() {
    return (
        <div className="min-h-full bg-[#F4F6F9] p-4 md:p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-4 w-52" />
                </div>
                <Skeleton className="h-10 w-48 rounded-xl" />
            </div>
            <div className="bg-white rounded-2xl border border-[#E8EBF0] p-8 space-y-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-8 w-20" />
                        </div>
                        {i === 1 && <Skeleton className="h-2.5 w-full rounded-full" />}
                        {i < 4 && <div className="border-b border-[#E8EBF0]" />}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Mirrors the shape of the daily report document: hero, KPI row, narrative. */
export function ReportingSkeleton() {
    return (
        <div className="min-h-full bg-[var(--elan-paper)] p-4 md:p-6 space-y-8">
            <div className="flex items-end justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-44 rounded-xl" />
            </div>
            <Skeleton className="h-40 w-full rounded-2xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                ))}
            </div>
            <div className="rounded-2xl border border-[var(--elan-line)] bg-[var(--elan-surface)] p-6 space-y-3">
                <Skeleton className="h-4 w-28" />
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-3 w-full rounded-full" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
        </div>
    );
}
