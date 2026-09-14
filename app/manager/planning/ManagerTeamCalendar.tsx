'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Clock3,
    Filter,
    Flag,
    Loader2,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    UserRound,
    UsersRound,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui';

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
    sdrAbsences: Array<{
        id: string;
        startDate: string;
        endDate: string;
        type: string;
        impactsPlanning: boolean;
    }>;
}

interface Mission {
    id: string;
    name: string;
    channel: string;
    startDate: string;
    endDate: string;
    client: { id: string; name: string };
}

interface ScheduleBlock {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    suggestionStatus: string | null;
    notes: string | null;
    sdrId: string;
    missionId: string;
    sdr: { id: string; name: string; email: string; role: string };
    mission: {
        id: string;
        name: string;
        channel: string;
        client: { id: string; name: string };
    };
    createdBy: { id: string; name: string };
}

interface MonthSnapshot {
    team: TeamMember[];
    missions: Mission[];
}

interface CalendarDay {
    date: Date;
    key: string;
    shortLabel: string;
    number: number;
    isToday: boolean;
}

interface TaskDraft {
    userId: string;
    missionId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes: string;
    urgent: boolean;
}

interface MemberTone {
    strong: string;
    soft: string;
    line: string;
}

const WEEKDAY_LABELS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN'];
const MEMBER_TONES: MemberTone[] = [
    { strong: '#0A9F58', soft: '#EAF8F0', line: '#13B866' },
    { strong: '#2675E8', soft: '#EBF3FF', line: '#3B82F6' },
    { strong: '#F07A00', soft: '#FFF3E6', line: '#F58A18' },
    { strong: '#9851CC', soft: '#F5EDFB', line: '#A65DDA' },
    { strong: '#D94770', soft: '#FDECF1', line: '#E35A80' },
    { strong: '#0E8C90', soft: '#E8F7F7', line: '#1AA3A8' },
];

const ROLE_LABELS: Record<string, string> = {
    SDR: 'SDR',
    BOOKER: 'Booker',
    MANAGER: 'Manager',
    DEVELOPER: 'Développeur',
    BUSINESS_DEVELOPER: 'Business developer',
    COMMERCIAL: 'Commercial',
};

const EMPTY_DRAFT: TaskDraft = {
    userId: '',
    missionId: '',
    date: '',
    startTime: '09:00',
    endTime: '12:00',
    notes: '',
    urgent: false,
};

export function ManagerTeamCalendar() {
    const { success, error: showError } = useToast();
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [snapshot, setSnapshot] = useState<MonthSnapshot | null>(null);
    const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [memberFilter, setMemberFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [taskOpen, setTaskOpen] = useState(false);
    const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);
    const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
    const filterRef = useRef<HTMLDivElement | null>(null);

    const days = useMemo(() => buildWeekdays(weekStart), [weekStart]);
    const weekEnd = days[4]?.date ?? weekStart;
    const monthKey = formatMonthKey(days[3]?.date ?? weekStart);

    const loadData = useCallback(async (quiet = false) => {
        if (quiet) setRefreshing(true);
        else setLoading(true);

        try {
            const start = toDateKey(weekStart);
            const end = toDateKey(weekEnd);
            const [monthResponse, blocksResponse] = await Promise.all([
                fetch(`/api/planning/month?month=${monthKey}&scope=all`),
                fetch(`/api/planning?startDate=${start}&endDate=${end}`),
            ]);
            const [monthJson, blocksJson] = await Promise.all([
                monthResponse.json(),
                blocksResponse.json(),
            ]);

            if (!monthResponse.ok || !monthJson.success) {
                throw new Error(monthJson.error || 'Impossible de charger les collaborateurs.');
            }
            if (!blocksResponse.ok || !blocksJson.success) {
                throw new Error(blocksJson.error || 'Impossible de charger le planning.');
            }

            setSnapshot(monthJson.data as MonthSnapshot);
            setBlocks((blocksJson.data as ScheduleBlock[]).filter((block) => block.status !== 'CANCELLED'));
        } catch (error) {
            showError(
                'Planning indisponible',
                error instanceof Error ? error.message : 'Une erreur est survenue.',
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [monthKey, showError, weekEnd, weekStart]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setFilterOpen(false);
            }
        }
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const roles = useMemo(
        () => [...new Set((snapshot?.team ?? []).map((member) => member.role))].sort(),
        [snapshot?.team],
    );

    const filteredMembers = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase('fr-FR');
        return (snapshot?.team ?? []).filter((member) => {
            if (roleFilter !== 'ALL' && member.role !== roleFilter) return false;
            if (memberFilter !== 'ALL' && member.id !== memberFilter) return false;
            if (!normalizedSearch) return true;
            return `${member.name} ${member.email} ${ROLE_LABELS[member.role] ?? member.role}`
                .toLocaleLowerCase('fr-FR')
                .includes(normalizedSearch);
        });
    }, [memberFilter, roleFilter, search, snapshot?.team]);

    const visibleMemberIds = useMemo(
        () => new Set(filteredMembers.map((member) => member.id)),
        [filteredMembers],
    );

    const visibleBlocks = useMemo(
        () => blocks.filter((block) => visibleMemberIds.has(block.sdr.id)),
        [blocks, visibleMemberIds],
    );

    const stats = useMemo(
        () => computeStats(filteredMembers, visibleBlocks),
        [filteredMembers, visibleBlocks],
    );

    const dayLoads = useMemo(() => {
        const capacity = Math.max(filteredMembers.length * 8, 1);
        return Object.fromEntries(
            days.map((day) => {
                const hours = visibleBlocks
                    .filter((block) => dateKey(block.date) === day.key)
                    .reduce((total, block) => total + durationHours(block.startTime, block.endTime), 0);
                return [day.key, Math.min(100, Math.round((hours / capacity) * 100))];
            }),
        );
    }, [days, filteredMembers.length, visibleBlocks]);

    function navigateWeek(offset: number) {
        setWeekStart((current) => addDays(current, offset * 7));
        setSelectedBlock(null);
    }

    function goToToday() {
        setWeekStart(startOfWeek(new Date()));
        setSelectedBlock(null);
    }

    function openCreateTask(userId = '', date = days[0]?.key ?? toDateKey(new Date())) {
        setDraft({ ...EMPTY_DRAFT, userId, date });
        setTaskOpen(true);
    }

    async function createTask(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft.userId || !draft.missionId || !draft.date) return;

        const notes = `${draft.urgent ? '[URGENT] ' : ''}${draft.notes.trim()}`.trim() || undefined;
        try {
            const response = await fetch('/api/planning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sdrId: draft.userId,
                    missionId: draft.missionId,
                    date: draft.date,
                    startTime: draft.startTime,
                    endTime: draft.endTime,
                    notes,
                }),
            });
            const json = await response.json();
            if (!response.ok || !json.success) {
                throw new Error(json.error || 'Impossible de créer la tâche.');
            }

            success('Tâche planifiée', 'Le collaborateur a été notifié.');
            setTaskOpen(false);
            setDraft(EMPTY_DRAFT);
            await loadData(true);
        } catch (error) {
            showError(
                'Création impossible',
                error instanceof Error ? error.message : 'Une erreur est survenue.',
            );
        }
    }

    async function updateBlockStatus(block: ScheduleBlock, status: ScheduleBlock['status']) {
        try {
            const response = await fetch(`/api/planning/${block.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            const json = await response.json();
            if (!response.ok || !json.success) {
                throw new Error(json.error || 'Impossible de mettre à jour la tâche.');
            }
            success('Tâche mise à jour', status === 'COMPLETED' ? 'La tâche est terminée.' : 'Le statut a été modifié.');
            setSelectedBlock(null);
            await loadData(true);
        } catch (error) {
            showError('Mise à jour impossible', error instanceof Error ? error.message : 'Une erreur est survenue.');
        }
    }

    async function deleteBlock(block: ScheduleBlock) {
        try {
            const response = await fetch(`/api/planning/${block.id}`, { method: 'DELETE' });
            const json = await response.json();
            if (!response.ok || !json.success) {
                throw new Error(json.error || 'Impossible de supprimer la tâche.');
            }
            success('Tâche supprimée', 'Le planning a été mis à jour.');
            setSelectedBlock(null);
            await loadData(true);
        } catch (error) {
            showError('Suppression impossible', error instanceof Error ? error.message : 'Une erreur est survenue.');
        }
    }

    if (loading && !snapshot) {
        return <PlanningSkeleton />;
    }

    return (
        <div className="h-full overflow-y-auto bg-[#F8FAFB] text-[#102033]">
            <div className="mx-auto w-full max-w-[1600px] px-5 py-5 lg:px-7">
                <div className="mb-4">
                    <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#748396]">
                            Équipe
                        </p>
                        <h1 className="text-[26px] font-bold tracking-[-0.035em] text-[#0F1D2E]">
                            Planning équipe
                        </h1>
                    </div>
                </div>

                <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <WeekNavigator
                        weekStart={weekStart}
                        onPrevious={() => navigateWeek(-1)}
                        onNext={() => navigateWeek(1)}
                        onToday={goToToday}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={memberFilter}
                            onChange={(event) => setMemberFilter(event.target.value)}
                            aria-label="Vue par collaborateur"
                            className="h-10 min-w-[190px] rounded-lg border border-[#DDE4EA] bg-white px-3 text-[12px] font-semibold text-[#34465A] shadow-[0_1px_2px_rgba(16,32,51,0.03)] outline-none focus:border-[#0B5A51]"
                        >
                            <option value="ALL">Vue par collaborateur</option>
                            {(snapshot?.team ?? []).map((member) => (
                                <option key={member.id} value={member.id}>{member.name}</option>
                            ))}
                        </select>

                        <div className="relative" ref={filterRef}>
                            <button
                                type="button"
                                onClick={() => setFilterOpen((current) => !current)}
                                className={cn(
                                    'inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3.5 text-[12px] font-semibold shadow-[0_1px_2px_rgba(16,32,51,0.03)] transition-colors',
                                    filterOpen || roleFilter !== 'ALL' || search
                                        ? 'border-[#9BC6BE] text-[#0B5A51]'
                                        : 'border-[#DDE4EA] text-[#34465A] hover:border-[#BAC7D2]',
                                )}
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Filtres
                                {(roleFilter !== 'ALL' || search) && (
                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E6F4F0] px-1 text-[9px] text-[#0B5A51]">1</span>
                                )}
                            </button>
                            {filterOpen && (
                                <div className="cp-pop cp-pop-origin-tr absolute right-0 top-12 w-[290px] p-3">
                                    <label className="relative block">
                                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#8290A0]" />
                                        <input
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Rechercher un collaborateur"
                                            className="h-9 w-full rounded-lg border border-[#DDE4EA] bg-[#F9FBFC] pl-9 pr-3 text-[12px] outline-none focus:border-[#0B5A51]"
                                        />
                                    </label>
                                    <p className="mb-2 mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8290A0]">Rôle</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        <FilterChip active={roleFilter === 'ALL'} onClick={() => setRoleFilter('ALL')}>
                                            Tous
                                        </FilterChip>
                                        {roles.map((role) => (
                                            <FilterChip key={role} active={roleFilter === role} onClick={() => setRoleFilter(role)}>
                                                {ROLE_LABELS[role] ?? role}
                                            </FilterChip>
                                        ))}
                                    </div>
                                    {(roleFilter !== 'ALL' || search) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRoleFilter('ALL');
                                                setSearch('');
                                            }}
                                            className="mt-3 text-[11px] font-semibold text-[#0B5A51] hover:underline"
                                        >
                                            Réinitialiser les filtres
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => void loadData(true)}
                            disabled={refreshing}
                            title="Actualiser"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#DDE4EA] bg-white text-[#526476] transition-colors hover:border-[#BAC7D2] hover:text-[#0B5A51] disabled:opacity-50"
                        >
                            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </button>

                        <button
                            type="button"
                            onClick={() => openCreateTask()}
                            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#063E39] bg-[#084C45] px-4 text-[12px] font-bold text-white shadow-[0_5px_14px_rgba(8,76,69,0.18)] transition-colors hover:bg-[#063E39] active:translate-y-px"
                        >
                            <Plus className="h-4 w-4" />
                            Nouvelle tâche
                        </button>
                    </div>
                </div>

                <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <MetricCard icon={UsersRound} tone="blue" value={filteredMembers.length} label="Collaborateurs" />
                    <MetricCard icon={RefreshCw} tone="green" value={`${stats.averageLoad}%`} label="Charge moyenne" />
                    <MetricCard icon={Clock3} tone="green" value={`${formatHours(stats.availableHours)}h`} label="Disponibilités" />
                    <MetricCard icon={AlertTriangle} tone="red" value={stats.lateCount} label="Retards" />
                    <MetricCard icon={Flag} tone="orange" value={stats.urgentCount} label="Tâches urgentes" />
                </section>

                <section className="mb-4 rounded-xl border border-[#DDE4EA] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(20,40,60,0.03)]">
                    <div className="grid items-center gap-4 lg:grid-cols-[180px_repeat(5,minmax(0,1fr))]">
                        <h2 className="text-[13px] font-bold text-[#18293B]">Charge de l&apos;équipe</h2>
                        {days.map((day, index) => {
                            const load = dayLoads[day.key] ?? 0;
                            const color = load >= 85 ? '#E5484D' : load >= 65 ? '#F08B21' : '#0DB66A';
                            return (
                                <div key={day.key}>
                                    <div className="mb-2 flex items-center justify-between text-[10px]">
                                        <span className="font-bold text-[#53677A]">{WEEKDAY_LABELS[index]}</span>
                                        <span className="font-bold text-[#132437]">{load}%</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-[#E8EDF0]">
                                        <div className="h-full rounded-full" style={{ width: `${load}%`, backgroundColor: color }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="overflow-x-auto overflow-y-hidden rounded-xl border border-[#D8E0E7] bg-white shadow-[0_1px_4px_rgba(20,40,60,0.04)]">
                    <div className="min-w-[1040px]">
                        <div className="grid grid-cols-[180px_repeat(5,minmax(145px,1fr))_160px] border-b border-[#DDE4EA] bg-[#FBFCFD]">
                            <div className="border-r border-[#E3E8EC]" />
                            {days.map((day, index) => (
                                <div
                                    key={day.key}
                                    className={cn(
                                        'border-r border-[#E3E8EC] px-3 py-3 text-center',
                                        day.isToday && 'bg-[#EFF6F5]',
                                    )}
                                >
                                    <span className="text-[11px] font-bold text-[#425A70]">
                                        {WEEKDAY_LABELS[index]} {day.number}
                                    </span>
                                </div>
                            ))}
                            <div className="px-3 py-3 text-center text-[10px] font-bold text-[#425A70]">RÉSUMÉ SEMAINE</div>
                        </div>

                        {filteredMembers.length === 0 ? (
                            <div className="flex min-h-[330px] flex-col items-center justify-center px-6 text-center">
                                <UsersRound className="mb-3 h-9 w-9 text-[#B4C0CA]" />
                                <h3 className="text-sm font-bold text-[#24374A]">Aucun collaborateur trouvé</h3>
                                <p className="mt-1 text-xs text-[#758597]">Modifiez les filtres pour afficher le planning.</p>
                            </div>
                        ) : (
                            filteredMembers.map((member) => {
                                const tone = toneForMember(member.id);
                                const memberBlocks = visibleBlocks.filter((block) => block.sdr.id === member.id);
                                const scheduledHours = memberBlocks.reduce(
                                    (total, block) => total + durationHours(block.startTime, block.endTime),
                                    0,
                                );
                                const load = Math.min(100, Math.round((scheduledHours / 40) * 100));
                                return (
                                    <div
                                        key={member.id}
                                        className="grid grid-cols-[180px_repeat(5,minmax(145px,1fr))_160px] border-b border-[#E3E8EC] last:border-b-0"
                                    >
                                        <MemberSummary member={member} tone={tone} load={load} taskCount={memberBlocks.length} />
                                        {days.map((day) => {
                                            const dayBlocks = memberBlocks
                                                .filter((block) => dateKey(block.date) === day.key)
                                                .sort((a, b) => a.startTime.localeCompare(b.startTime));
                                            const absent = isMemberAbsent(member, day.key);
                                            return (
                                                <div
                                                    key={day.key}
                                                    className={cn(
                                                        'group min-h-[126px] border-r border-[#E3E8EC] p-2',
                                                        day.isToday && 'bg-[#FBFDFD]',
                                                    )}
                                                >
                                                    {absent ? (
                                                        <div className="flex h-full min-h-[108px] items-center justify-center rounded-lg border border-dashed border-[#CCD5DC] bg-[#F4F6F7] text-[11px] font-semibold text-[#768593]">
                                                            Absence
                                                        </div>
                                                    ) : dayBlocks.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            {dayBlocks.map((block) => (
                                                                <TaskBlock
                                                                    key={block.id}
                                                                    block={block}
                                                                    tone={tone}
                                                                    onClick={() => setSelectedBlock(block)}
                                                                />
                                                            ))}
                                                            <button
                                                                type="button"
                                                                onClick={() => openCreateTask(member.id, day.key)}
                                                                className="flex h-6 w-full items-center justify-center gap-1 rounded-md text-[10px] font-semibold text-[#718294] opacity-0 transition-opacity hover:bg-[#F3F6F8] group-hover:opacity-100"
                                                            >
                                                                <Plus className="h-3 w-3" /> Ajouter
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => openCreateTask(member.id, day.key)}
                                                            className="flex h-full min-h-[108px] w-full flex-col items-center justify-center rounded-lg text-[11px] font-medium text-[#64778A] transition-colors hover:bg-[#F5F8F9] hover:text-[#0B5A51]"
                                                        >
                                                            <span>Libre</span>
                                                            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                                                                <Plus className="h-3 w-3" /> Planifier
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <WeekSummary load={load} scheduledHours={scheduledHours} tone={tone} />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-white px-3 py-2 text-[10px] text-[#415468]">
                    {roles.map((role) => {
                        const roleMember = (snapshot?.team ?? []).find((member) => member.role === role);
                        const tone = toneForMember(roleMember?.id ?? role);
                        return (
                            <span key={role} className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.line }} />
                                {ROLE_LABELS[role] ?? role}
                            </span>
                        );
                    })}
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#E5484D]" />
                        Urgente
                    </span>
                </div>
            </div>

            {taskOpen && (
                <TaskModal
                    draft={draft}
                    setDraft={setDraft}
                    members={snapshot?.team ?? []}
                    missions={snapshot?.missions ?? []}
                    onSubmit={createTask}
                    onClose={() => setTaskOpen(false)}
                />
            )}

            {selectedBlock && (
                <TaskDetails
                    block={selectedBlock}
                    onClose={() => setSelectedBlock(null)}
                    onComplete={() => void updateBlockStatus(selectedBlock, 'COMPLETED')}
                    onDelete={() => void deleteBlock(selectedBlock)}
                />
            )}
        </div>
    );
}

function WeekNavigator({
    weekStart,
    onPrevious,
    onNext,
    onToday,
}: {
    weekStart: Date;
    onPrevious: () => void;
    onNext: () => void;
    onToday: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-10 w-fit items-center overflow-hidden rounded-lg border border-[#DDE4EA] bg-white shadow-[0_1px_2px_rgba(16,32,51,0.03)]">
                <button
                    type="button"
                    onClick={onPrevious}
                    aria-label="Semaine précédente"
                    className="flex h-full w-10 items-center justify-center border-r border-[#E7ECF0] text-[#526476] hover:bg-[#F6F8F9]"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex h-full min-w-[195px] items-center justify-center gap-2 px-3 text-[12px] font-bold text-[#233548]">
                    <CalendarDays className="h-4 w-4 text-[#607387]" />
                    {formatWeekRange(weekStart, addDays(weekStart, 6))}
                </div>
                <button
                    type="button"
                    onClick={onNext}
                    aria-label="Semaine suivante"
                    className="flex h-full w-10 items-center justify-center border-l border-[#E7ECF0] text-[#526476] hover:bg-[#F6F8F9]"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
            <button
                type="button"
                onClick={onToday}
                className="h-10 w-fit rounded-lg border border-[#DDE4EA] bg-white px-4 text-[12px] font-bold text-[#233548] hover:bg-[#F6F8F9]"
            >
                Aujourd&apos;hui
            </button>
        </div>
    );
}

function MetricCard({
    icon: Icon,
    tone,
    value,
    label,
}: {
    icon: typeof UsersRound;
    tone: 'blue' | 'green' | 'red' | 'orange';
    value: string | number;
    label: string;
}) {
    const styles = {
        blue: 'bg-[#EDF4FF] text-[#367CE7]',
        green: 'bg-[#EAF8F0] text-[#149956]',
        red: 'bg-[#FFF0F1] text-[#E5484D]',
        orange: 'bg-[#FFF4E9] text-[#EB790A]',
    };
    return (
        <div className="flex min-h-[86px] items-center gap-3 rounded-xl border border-[#DDE4EA] bg-white px-4 shadow-[0_1px_3px_rgba(20,40,60,0.03)]">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', styles[tone])}>
                <Icon className="h-5 w-5" />
            </span>
            <div>
                <p className="text-[19px] font-bold leading-none tracking-[-0.03em] text-[#102033]">{value}</p>
                <p className="mt-1.5 text-[10px] font-medium text-[#607387]">{label}</p>
            </div>
        </div>
    );
}

function MemberSummary({
    member,
    tone,
    load,
    taskCount,
}: {
    member: TeamMember;
    tone: MemberTone;
    load: number;
    taskCount: number;
}) {
    const initials = member.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'U';
    return (
        <div className="min-h-[126px] border-r border-[#E3E8EC] px-3 py-4">
            <div className="flex items-start gap-2.5">
                <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: tone.strong }}
                >
                    {initials}
                </span>
                <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-[#102033]">{member.name}</p>
                    <p className="truncate text-[10px] text-[#607387]">{ROLE_LABELS[member.role] ?? member.role}</p>
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px]">
                <span className="text-[#607387]">Charge : <strong style={{ color: tone.strong }}>{load}%</strong></span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E8EDF0]">
                <div className="h-full rounded-full" style={{ width: `${load}%`, backgroundColor: tone.line }} />
            </div>
            <p className="mt-3 text-[10px] text-[#607387]">{taskCount} tâche{taskCount !== 1 ? 's' : ''}</p>
        </div>
    );
}

function TaskBlock({ block, tone, onClick }: { block: ScheduleBlock; tone: MemberTone; onClick: () => void }) {
    const urgent = isUrgent(block);
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full rounded-md border-l-2 px-2.5 py-2 text-left transition-transform hover:-translate-y-px hover:shadow-sm"
            style={{ backgroundColor: tone.soft, borderLeftColor: tone.line }}
        >
            <div className="flex items-start justify-between gap-2">
                <span className="truncate text-[10px] font-bold" style={{ color: tone.strong }}>{block.mission.name}</span>
                {urgent && <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E5484D]" title="Urgente" />}
            </div>
            <p className="mt-1 text-[9px] font-medium text-[#425A70]">{block.startTime} - {block.endTime}</p>
        </button>
    );
}

function WeekSummary({
    load,
    scheduledHours,
    tone,
}: {
    load: number;
    scheduledHours: number;
    tone: MemberTone;
}) {
    const freeHours = Math.max(0, 40 - scheduledHours);
    return (
        <div className="flex min-h-[126px] flex-col items-center justify-center px-3 py-3">
            <div
                className="grid h-14 w-14 place-items-center rounded-full"
                style={{ background: `conic-gradient(${tone.line} ${load * 3.6}deg, #E8EDF0 0deg)` }}
                role="img"
                aria-label={`${load}% de charge`}
            >
                <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[10px] font-bold text-[#34465A]">
                    {load}%
                </div>
            </div>
            <p className="mt-2 text-[10px] text-[#53677A]"><strong className="text-[#223548]">{formatHours(scheduledHours)}h</strong> planifiées</p>
            <p className="mt-0.5 text-[10px] text-[#53677A]"><strong className="text-[#223548]">{formatHours(freeHours)}h</strong> libres</p>
        </div>
    );
}

function FilterChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                active
                    ? 'border-[#9BC6BE] bg-[#EAF5F2] text-[#0B5A51]'
                    : 'border-[#DDE4EA] bg-white text-[#5F7183] hover:bg-[#F6F8F9]',
            )}
        >
            {children}
        </button>
    );
}

function TaskModal({
    draft,
    setDraft,
    members,
    missions,
    onSubmit,
    onClose,
}: {
    draft: TaskDraft;
    setDraft: React.Dispatch<React.SetStateAction<TaskDraft>>;
    members: TeamMember[];
    missions: Mission[];
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onClose: () => void;
}) {
    const [submitting, setSubmitting] = useState(false);
    const activeMissions = missions.filter((mission) => {
        if (!draft.date) return true;
        const day = draft.date;
        return day >= dateKey(mission.startDate) && day <= dateKey(mission.endDate);
    });

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0A1B2B]/35 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
            <div
                className="w-full max-w-[560px] rounded-2xl border border-white/80 bg-white shadow-[0_26px_80px_rgba(10,27,43,0.24)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-[#E4E9ED] px-5 py-4">
                    <div>
                        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[#112336]">Nouvelle tâche</h2>
                        <p className="mt-1 text-[11px] text-[#6B7C8E]">Planifiez une mission pour un collaborateur.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#748396] hover:bg-[#F3F6F8]">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form
                    onSubmit={async (event) => {
                        setSubmitting(true);
                        try {
                            await onSubmit(event);
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                    className="space-y-4 p-5"
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Collaborateur">
                            <select
                                required
                                value={draft.userId}
                                onChange={(event) => setDraft((current) => ({ ...current, userId: event.target.value }))}
                                className="planning-input"
                            >
                                <option value="">Sélectionner</option>
                                {members.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.name} · {ROLE_LABELS[member.role] ?? member.role}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Date">
                            <input
                                required
                                type="date"
                                value={draft.date}
                                onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value, missionId: '' }))}
                                className="planning-input"
                            />
                        </FormField>
                    </div>
                    <FormField label="Mission">
                        <select
                            required
                            value={draft.missionId}
                            onChange={(event) => setDraft((current) => ({ ...current, missionId: event.target.value }))}
                            className="planning-input"
                        >
                            <option value="">Sélectionner une mission</option>
                            {activeMissions.map((mission) => (
                                <option key={mission.id} value={mission.id}>
                                    {mission.name} · {mission.client.name}
                                </option>
                            ))}
                        </select>
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Début">
                            <input
                                required
                                type="time"
                                value={draft.startTime}
                                onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))}
                                className="planning-input"
                            />
                        </FormField>
                        <FormField label="Fin">
                            <input
                                required
                                type="time"
                                value={draft.endTime}
                                onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))}
                                className="planning-input"
                            />
                        </FormField>
                    </div>
                    <FormField label="Instructions">
                        <textarea
                            value={draft.notes}
                            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                            placeholder="Ajoutez les informations utiles pour cette tâche"
                            rows={3}
                            className="planning-input resize-none py-2.5"
                        />
                    </FormField>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#E1E7EB] bg-[#FAFBFC] px-3 py-2.5">
                        <input
                            type="checkbox"
                            checked={draft.urgent}
                            onChange={(event) => setDraft((current) => ({ ...current, urgent: event.target.checked }))}
                            className="h-4 w-4 accent-[#E5484D]"
                        />
                        <span>
                            <span className="block text-[11px] font-bold text-[#26394C]">Tâche urgente</span>
                            <span className="block text-[10px] text-[#758597]">Affiche un indicateur prioritaire dans le planning.</span>
                        </span>
                    </label>
                    <div className="flex items-center justify-end gap-2 border-t border-[#E8ECEF] pt-4">
                        <button type="button" onClick={onClose} className="h-9 rounded-lg px-4 text-[11px] font-bold text-[#5F7183] hover:bg-[#F3F6F8]">
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !draft.userId || !draft.missionId || !draft.date}
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#084C45] px-4 text-[11px] font-bold text-white hover:bg-[#063E39] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Planifier la tâche
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#657689]">{label}</span>
            {children}
        </label>
    );
}

function TaskDetails({
    block,
    onClose,
    onComplete,
    onDelete,
}: {
    block: ScheduleBlock;
    onClose: () => void;
    onComplete: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[80] flex justify-end bg-[#0A1B2B]/25" onMouseDown={onClose}>
            <aside
                className="h-full w-full max-w-[420px] overflow-y-auto border-l border-[#DDE4EA] bg-white shadow-[-22px_0_60px_rgba(10,27,43,0.16)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-[#E4E9ED] px-5 py-5">
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-md bg-[#EAF5F2] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#0B5A51]">
                                {block.status === 'COMPLETED' ? 'Terminée' : 'Planifiée'}
                            </span>
                            {isUrgent(block) && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF0F1] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#D93C43]">
                                    <CircleAlert className="h-3 w-3" /> Urgente
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg font-bold text-[#112336]">{block.mission.name}</h2>
                        <p className="mt-1 text-xs text-[#6A7C8E]">{block.mission.client.name}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#748396] hover:bg-[#F3F6F8]">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-3 p-5">
                    <DetailRow icon={UserRound} label="Collaborateur" value={`${block.sdr.name} · ${ROLE_LABELS[block.sdr.role] ?? block.sdr.role}`} />
                    <DetailRow icon={CalendarDays} label="Date" value={formatLongDate(dateKey(block.date))} />
                    <DetailRow icon={Clock3} label="Horaire" value={`${block.startTime} - ${block.endTime}`} />
                    <DetailRow icon={UsersRound} label="Créée par" value={block.createdBy.name} />
                    {cleanNotes(block.notes) && (
                        <div className="rounded-xl border border-[#E1E7EB] bg-[#F8FAFB] p-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#758597]">Instructions</p>
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#34485C]">{cleanNotes(block.notes)}</p>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[#E4E9ED] p-5">
                    {block.status !== 'COMPLETED' && (
                        <button
                            type="button"
                            onClick={onComplete}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#084C45] px-4 text-[11px] font-bold text-white hover:bg-[#063E39]"
                        >
                            <Check className="h-4 w-4" />
                            Marquer terminée
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onDelete}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#F0C8CA] bg-[#FFF7F7] px-4 text-[11px] font-bold text-[#C93C42] hover:bg-[#FFF0F1]"
                    >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                    </button>
                </div>
            </aside>
        </div>
    );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-[#E4E9ED] px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF4F4] text-[#0B5A51]">
                <Icon className="h-4 w-4" />
            </span>
            <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#8492A0]">{label}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-[#2A3D50]">{value}</p>
            </div>
        </div>
    );
}

function PlanningSkeleton() {
    return (
        <div className="h-full overflow-hidden bg-[#F8FAFB] p-7">
            <div className="mx-auto max-w-[1600px] animate-pulse">
                <div className="mb-5 h-8 w-48 rounded-lg bg-[#E5EAEE]" />
                <div className="mb-4 flex gap-3">
                    <div className="h-10 w-60 rounded-lg bg-[#E5EAEE]" />
                    <div className="h-10 w-28 rounded-lg bg-[#E5EAEE]" />
                </div>
                <div className="mb-4 grid grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 rounded-xl bg-[#E5EAEE]" />)}
                </div>
                <div className="h-[520px] rounded-xl bg-[#E5EAEE]" />
            </div>
        </div>
    );
}

function computeStats(members: TeamMember[], blocks: ScheduleBlock[]) {
    const scheduledHours = blocks.reduce(
        (total, block) => total + durationHours(block.startTime, block.endTime),
        0,
    );
    const capacity = members.length * 40;
    const averageLoad = capacity > 0 ? Math.min(100, Math.round((scheduledHours / capacity) * 100)) : 0;
    const today = toDateKey(new Date());
    return {
        averageLoad,
        availableHours: Math.max(0, capacity - scheduledHours),
        lateCount: blocks.filter((block) => dateKey(block.date) < today && block.status !== 'COMPLETED').length,
        urgentCount: blocks.filter(isUrgent).length,
    };
}

function toneForMember(id: string): MemberTone {
    let hash = 0;
    for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) | 0;
    return MEMBER_TONES[Math.abs(hash) % MEMBER_TONES.length];
}

function startOfWeek(value: Date) {
    const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const weekday = date.getDay();
    const difference = weekday === 0 ? -6 : 1 - weekday;
    date.setDate(date.getDate() + difference);
    return date;
}

function addDays(value: Date, amount: number) {
    const result = new Date(value);
    result.setDate(result.getDate() + amount);
    return result;
}

function buildWeekdays(weekStart: Date): CalendarDay[] {
    const today = toDateKey(new Date());
    return Array.from({ length: 5 }, (_, index) => {
        const date = addDays(weekStart, index);
        const key = toDateKey(date);
        return {
            date,
            key,
            shortLabel: WEEKDAY_LABELS[index],
            number: date.getDate(),
            isToday: key === today,
        };
    });
}

function toDateKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dateKey(value: string) {
    return value.slice(0, 10);
}

function formatMonthKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function formatWeekRange(start: Date, end: Date) {
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
        return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
    }
    return `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
}

function formatLongDate(value: string) {
    return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function durationHours(start: string, end: string) {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    return Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
}

function formatHours(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

function isUrgent(block: ScheduleBlock) {
    return block.notes?.trim().startsWith('[URGENT]') ?? false;
}

function cleanNotes(notes: string | null) {
    return notes?.replace(/^\[URGENT\]\s*/, '').trim() ?? '';
}

function isMemberAbsent(member: TeamMember, day: string) {
    return (member.sdrAbsences ?? []).some(
        (absence) =>
            absence.impactsPlanning &&
            dateKey(absence.startDate) <= day &&
            dateKey(absence.endDate) >= day,
    );
}
