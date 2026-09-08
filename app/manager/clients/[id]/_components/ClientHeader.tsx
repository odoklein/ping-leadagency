"use client";

import Link from "next/link";
import { ArrowLeft, Building2, Calendar, Edit, Trash2, Globe, Mail, Phone } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import type { Client } from "../types";

interface ClientHeaderProps {
    client: Client;
    onEdit: () => void;
    onDelete: () => void;
}

export function ClientHeader({ client, onEdit, onDelete }: ClientHeaderProps) {
    const initials = client.name
        ? client.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()
        : "C";

    const formattedCreatedDate = client.createdAt
        ? new Date(client.createdAt).toLocaleDateString("fr-FR", {
              month: "short",
              year: "numeric",
          })
        : null;

    return (
        <div className="relative rounded-3xl bg-gradient-to-b from-[#0A1224] via-[#0B152A] to-[#080808] border border-blue-900/60 p-6 sm:p-7 text-white shadow-xl shadow-black/20 overflow-hidden">
            {/* Background ambient lighting glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#2890F8]/12 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Left side: Back button + Avatar + Details */}
                <div className="flex items-start sm:items-center gap-4 sm:gap-5">
                    <Link href="/manager/clients">
                        <button
                            type="button"
                            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white flex items-center justify-center transition-all duration-200 backdrop-blur-md shadow-xs"
                            title="Retour aux clients"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    </Link>

                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#2890F8] to-[#156cd4] shadow-lg shadow-blue-500/25 flex items-center justify-center text-xl sm:text-2xl font-black text-white ring-4 ring-white/10 shrink-0 tracking-wider">
                            {initials}
                        </div>

                        {/* Title & Metadata */}
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                                    {client.name}
                                </h1>
                                {client.industry && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[11px] font-bold">
                                        <Building2 className="w-3 h-3 text-blue-400" />
                                        {client.industry}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-300 flex-wrap">
                                {formattedCreatedDate && (
                                    <span className="text-slate-400 font-medium flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-slate-500" />
                                        Client depuis {formattedCreatedDate}
                                    </span>
                                )}
                                {client.email && (
                                    <>
                                        <span className="text-slate-600">·</span>
                                        <a
                                            href={`mailto:${client.email}`}
                                            className="text-blue-300 hover:text-white hover:underline flex items-center gap-1 transition-colors"
                                        >
                                            <Mail className="w-3 h-3 opacity-70" />
                                            {client.email}
                                        </a>
                                    </>
                                )}
                                {client.phone && (
                                    <>
                                        <span className="text-slate-600">·</span>
                                        <a
                                            href={`tel:${client.phone}`}
                                            className="text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                                        >
                                            <Phone className="w-3 h-3 opacity-70" />
                                            {client.phone}
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right side: Action buttons */}
                <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                    {client.bookingUrl && (
                        <a
                            href={client.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all shadow-xs backdrop-blur-md"
                        >
                            <Calendar className="w-3.5 h-3.5 text-[#2890F8]" />
                            <span>Réserver RDV</span>
                        </a>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEdit}
                        className="gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                    >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                    </Button>

                    <Button
                        variant="danger"
                        size="sm"
                        onClick={onDelete}
                        className="gap-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold text-xs rounded-xl transition-all"
                        title="Supprimer le client"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
