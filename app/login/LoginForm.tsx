"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    AlertCircle,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    Trash2,
    UserCircle2,
    Zap,
    Activity,
    LockKeyhole
} from "lucide-react";
import { ElanLogo } from "@/components/brand/ElanLogo";
import { CadenceBars } from "@/components/brand/CadenceBars";
import { trackLogin } from "@/lib/analytics/umami";
import {
    getRecentAccounts,
    removeRecentAccount,
    saveRecentAccount,
    type RecentAccount,
} from "@/lib/auth-recent-accounts";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarHue(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}

function prettyNameFromEmail(email: string): string {
    const local = (email.split("@")[0] || email).trim();
    const words = local.split(/[._-]+/).filter(Boolean);
    if (words.length === 0) return email;
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatRelativeTime(ts: number): string {
    if (!ts) return "";
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days} j`;
    return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapError(code: string | null | undefined): string {
    if (!code) return "";
    if (code.includes("verrouillé") || code.includes("Trop")) return code;
    if (code === "CredentialsSignin") return "Adresse e-mail ou mot de passe incorrect.";
    return "La connexion a échoué. Veuillez vérifier vos identifiants.";
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    const errorCode = searchParams.get("error");

    // Form state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [capsOn, setCapsOn] = useState(false);
    const [error, setError] = useState("");
    const [mounted, setMounted] = useState(false);

    // Recent accounts
    const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([]);
    const [view, setView] = useState<"accounts" | "credentials">("accounts");
    const [selectedAccount, setSelectedAccount] = useState<RecentAccount | null>(null);

    const emailInputRef = useRef<HTMLInputElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (errorCode) {
            setError(mapError(errorCode));
            trackLogin(false);
        }
    }, [errorCode]);

    useEffect(() => {
        const stored = getRecentAccounts();
        setRecentAccounts(stored);
        if (stored.length === 0) setView("credentials");
    }, []);

    useEffect(() => {
        if (view !== "credentials") return;
        requestAnimationFrame(() => {
            if (selectedAccount) passwordInputRef.current?.focus();
            else emailInputRef.current?.focus();
        });
    }, [view, selectedAccount]);

    const openAccount = (account: RecentAccount) => {
        setSelectedAccount(account);
        setEmail(account.email);
        setPassword("");
        setError("");
        setView("credentials");
    };

    const openFreshForm = () => {
        setSelectedAccount(null);
        setEmail("");
        setPassword("");
        setError("");
        setView("credentials");
    };

    const backToAccounts = () => {
        setView("accounts");
        setSelectedAccount(null);
        setPassword("");
        setError("");
    };

    const handleForgetAccount = (e: React.MouseEvent, targetEmail: string) => {
        e.stopPropagation();
        removeRecentAccount(targetEmail);
        const updated = getRecentAccounts();
        setRecentAccounts(updated);
        if (updated.length === 0) openFreshForm();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isLoading) return;

        const trimmedEmail = email.trim();
        if (!EMAIL_RE.test(trimmedEmail)) {
            setError("Saisissez une adresse e-mail valide.");
            emailInputRef.current?.focus();
            return;
        }
        if (!password) {
            setError("Saisissez votre mot de passe.");
            passwordInputRef.current?.focus();
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                email: trimmedEmail,
                password,
                callbackUrl,
                redirect: false,
            });

            if (result?.ok && !result?.error) {
                let name = selectedAccount?.name || prettyNameFromEmail(trimmedEmail);
                let avatarUrl = selectedAccount?.avatarUrl;
                try {
                    const res = await fetch("/api/auth/session");
                    if (res.ok) {
                        const session = await res.json();
                        if (session?.user?.name) name = session.user.name;
                        if (session?.user?.image) avatarUrl = session.user.image;
                    }
                } catch {
                    /* non-fatal */
                }

                saveRecentAccount({ email: trimmedEmail, name, avatarUrl });
                trackLogin(true);
                router.push(callbackUrl);
                return;
            }

            setError(mapError(result?.error) || "Adresse e-mail ou mot de passe incorrect.");
            trackLogin(false);
        } catch {
            setError("La connexion a échoué. Réessayez dans un instant.");
            trackLogin(false);
        } finally {
            setIsLoading(false);
        }
    };

    const AvatarCell = ({ account, size = 40 }: { account: RecentAccount; size?: number }) => {
        const hue = getAvatarHue(account.email);
        if (account.avatarUrl) {
            return (
                <img
                    src={account.avatarUrl}
                    alt=""
                    className="rounded-xl object-cover"
                    style={{ width: size, height: size }}
                />
            );
        }
        return (
            <div
                className="rounded-xl flex items-center justify-center font-bold tracking-wider shadow-xs"
                style={{
                    width: size,
                    height: size,
                    fontSize: size * 0.38,
                    background: `hsl(${hue} 45% 90%)`,
                    color: `hsl(${hue} 70% 30%)`,
                }}
            >
                {getInitials(account.name)}
            </div>
        );
    };

    return (
        <main className="min-h-[100dvh] w-full grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] bg-[#FCFAFF] text-slate-900 font-sans selection:bg-[#2890F8] selection:text-white">
            
            {/* ── Left Side: Executive Obsidian Platform Showcase ── */}
            <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-[#060911] via-[#09101F] to-[#04060B] text-white overflow-hidden border-r border-slate-800/60">
                {/* Ambient background texture */}
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

                {/* Top Brand */}
                <div className="relative z-10 flex items-center justify-between">
                    <ElanLogo className="text-[44px]" />
                </div>

                {/* Center Core Message */}
                <div className="relative z-10 my-auto py-12 max-w-lg space-y-6">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Console de prospection
                    </span>

                    <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-[1.15] text-white">
                        Pilotez votre prospection commerciale.
                    </h1>

                    <p className="text-base text-slate-300/90 leading-relaxed font-normal">
                        Campagnes, intelligence artificielle et performance des équipes, réunies dans une seule console.
                    </p>

                    {/* Feature Strips */}
                    <div className="grid grid-cols-1 gap-3 pt-4">
                        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xs">
                            <div className="w-9 h-9 rounded-xl bg-[#2890F8]/20 border border-[#2890F8]/30 flex items-center justify-center text-[#2890F8] flex-shrink-0">
                                <Zap className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-white">Intelligence vocale &amp; IA</h4>
                                <p className="text-[11px] text-slate-400">Mistral AI Scripting &amp; synchronisation Leexi</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xs">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-white">Cadence &amp; prospection en direct</h4>
                                <p className="text-[11px] text-slate-400">Attribution automatisée des flux d&apos;appels et RDV</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Signature */}
                <div className="relative z-10 pt-6 border-t border-slate-800/80 flex items-center justify-between">
                    <CadenceBars count={32} highlightFrom={0.75} dark className="opacity-70" />
                    <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">
                        Suzalink Systems
                    </span>
                </div>
            </aside>

            {/* ── Right Side: Clean Modern Login Console ── */}
            <section className="relative flex flex-col justify-between items-center p-6 sm:p-12 lg:p-16 min-h-[100dvh] bg-[#FCFAFF]">
                
                {/* Top Mobile Brand (visible only on small screens) */}
                <div className="w-full flex lg:hidden items-center mb-8 max-w-md">
                    <ElanLogo tone="petrol" className="text-[34px]" />
                </div>

                {/* Main Card Container */}
                <div className="my-auto w-full max-w-md">
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-xl shadow-slate-900/5 transition-all">

                        {/* View A: Accounts Switcher */}
                        {view === "accounts" && recentAccounts.length > 0 ? (
                            <div className="space-y-6">
                                <div>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2890F8] bg-blue-50 px-2.5 py-1 rounded-md">
                                        Espace de travail
                                    </span>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-3">
                                        Bon retour
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Sélectionnez votre compte pour continuer.
                                    </p>
                                </div>

                                {error && (
                                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-semibold text-red-700">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="space-y-2.5">
                                    {recentAccounts.map((account) => (
                                        <div
                                            key={account.email}
                                            className="group relative flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:border-[#2890F8] hover:bg-blue-50/40 transition-all cursor-pointer shadow-2xs"
                                            onClick={() => openAccount(account)}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <AvatarCell account={account} size={42} />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-[#2890F8] transition-colors">
                                                        {account.name}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 truncate">
                                                        {account.email}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleForgetAccount(e, account.email)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2890F8] group-hover:translate-x-0.5 transition-all" />
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={openFreshForm}
                                        className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all mt-3"
                                    >
                                        <UserCircle2 className="w-4 h-4 text-slate-500" />
                                        Utiliser un autre compte
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* View B: Credentials Form */
                            <div className="space-y-6">
                                <div>
                                    {selectedAccount ? (
                                        <div>
                                            <button
                                                type="button"
                                                onClick={backToAccounts}
                                                className="inline-flex items-center gap-1 text-xs font-bold text-[#2890F8] hover:underline mb-4"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" />
                                                Changer de compte
                                            </button>
                                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                                                <AvatarCell account={selectedAccount} size={40} />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-900 truncate">{selectedAccount.name}</p>
                                                    <p className="text-[11px] text-slate-500 truncate">{selectedAccount.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2890F8] bg-blue-50 px-2.5 py-1 rounded-md">
                                                Connexion
                                            </span>
                                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-3">
                                                Accéder à votre compte
                                            </h2>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Entrez vos identifiants pour accéder à votre console.
                                            </p>
                                            {recentAccounts.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={backToAccounts}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-[#2890F8] hover:underline mt-2"
                                                >
                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                    Comptes récents
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {error && (
                                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-semibold text-red-700">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                                    {!selectedAccount && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                Adresse e-mail
                                            </label>
                                            <div className="relative flex items-center">
                                                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                                <input
                                                    ref={emailInputRef}
                                                    type="email"
                                                    placeholder="nom@entreprise.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                    autoComplete="username"
                                                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2890F8] transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold text-slate-700">
                                                Mot de passe
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => router.push("/forgot-password")}
                                                className="text-[11px] font-semibold text-slate-500 hover:text-[#2890F8] transition-colors"
                                            >
                                                Mot de passe oublié ?
                                            </button>
                                        </div>
                                        <div className="relative flex items-center">
                                            <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                            <input
                                                ref={passwordInputRef}
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onKeyUp={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                                                onKeyDown={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                                                onBlur={() => setCapsOn(false)}
                                                required
                                                autoComplete="current-password"
                                                className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2890F8] transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {capsOn && (
                                            <p className="text-[11px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Verrouillage majuscules activé
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full h-11 rounded-xl bg-[#0B0F19] hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-black/10 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Connexion en cours...
                                            </>
                                        ) : (
                                            <>
                                                Accéder à la console
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Security note */}
                        <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 font-medium">
                            <LockKeyhole className="w-3.5 h-3.5" />
                            <span>Connexion chiffrée &middot; réservée aux équipes Suzalink</span>
                        </div>
                    </div>
                </div>

                {/* Footer Copyright */}
                <footer className="w-full text-center text-xs text-slate-400 font-medium py-4">
                    Suzalink © {new Date().getFullYear()} · Console de Prospection Commerciale
                </footer>
            </section>
        </main>
    );
}
