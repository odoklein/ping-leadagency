"use client";

import { Video, Calendar, User, Phone, MapPin } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { Meeting } from "../../types";

interface NextMeetingBannerProps {
    meeting: Meeting | null | undefined;
}

export function NextMeetingBanner({ meeting }: NextMeetingBannerProps) {
    if (!meeting || !meeting.callbackDate) return null;

    const dateObj = new Date(meeting.callbackDate);
    const dayName = dateObj.toLocaleDateString("fr-FR", { weekday: "long" });
    const dayNumber = dateObj.getDate();
    const monthName = dateObj.toLocaleDateString("fr-FR", { month: "short" });
    const timeFormatted = dateObj.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });

    const meetingTypeLabel =
        meeting.meetingType === "VISIO"
            ? "Visio"
            : meeting.meetingType === "PHYSIQUE"
            ? "Présentiel"
            : "Téléphone";

    return (
        <div className="relative rounded-3xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-white to-white p-5 sm:p-6 shadow-xs overflow-hidden group hover:border-[#2890F8] transition-all duration-300">
            {/* Left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#2890F8]" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pl-2">
                <div className="flex items-center gap-4">
                    {/* Date badge */}
                    <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200 shadow-sm flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-[#2890F8] uppercase tracking-wider leading-none">
                            {monthName}
                        </span>
                        <span className="text-xl font-black text-slate-900 leading-none mt-1">
                            {dayNumber}
                        </span>
                    </div>

                    {/* Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2890F8]">
                                Prochain RDV confirmé
                            </span>
                            <Badge className="text-[10px] py-0 bg-blue-100 text-[#2890F8] border-0 font-bold">
                                {meetingTypeLabel}
                            </Badge>
                            {meeting.campaign?.mission?.name && (
                                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                                    · {meeting.campaign.mission.name}
                                </span>
                            )}
                        </div>

                        <p className="text-sm font-bold text-slate-900">
                            {meeting.contact.firstName} {meeting.contact.lastName}
                            {meeting.contact.company?.name && (
                                <span className="text-slate-500 font-normal">
                                    {" "}— {meeting.contact.company.name}
                                </span>
                            )}
                        </p>

                        <p className="text-xs text-slate-500 mt-0.5">
                            {dayName.charAt(0).toUpperCase() + dayName.slice(1)} à {timeFormatted}
                            {meeting.sdr?.name && (
                                <span className="text-slate-400"> (pris par {meeting.sdr.name})</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {meeting.meetingJoinUrl && (
                        <a
                            href={meeting.meetingJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button
                                variant="primary"
                                size="sm"
                                className="gap-2 text-xs font-bold bg-[#2890F8] hover:bg-[#1a75ce] text-white shadow-sm shadow-blue-500/20"
                            >
                                <Video className="w-3.5 h-3.5" />
                                Rejoindre la visio
                            </Button>
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
