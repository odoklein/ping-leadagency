"use client";

import { Check, Upload, Building2, ArrowRight, CheckCircle2, Database } from "lucide-react";

export interface StepItem {
    num: 1 | 2 | 3 | 4 | 5;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}

export const IMPORT_STEPS: StepItem[] = [
    { num: 1, label: "Fichier & Mission", description: "CSV & Destination", icon: Upload },
    { num: 2, label: "Type d'import", description: "Sociétés / Contacts", icon: Building2 },
    { num: 3, label: "Mapping", description: "Colonnes & IA", icon: ArrowRight },
    { num: 4, label: "Validation", description: "Contrôle qualité", icon: CheckCircle2 },
    { num: 5, label: "Import", description: "Intégration CRM", icon: Database },
];

interface ImportStepperProps {
    currentStep: 1 | 2 | 3 | 4 | 5;
    maxVisitedStep: number;
    onStepClick: (stepNum: 1 | 2 | 3 | 4 | 5) => void;
}

export function ImportStepper({ currentStep, maxVisitedStep, onStepClick }: ImportStepperProps) {
    return (
        <div className="w-full">
            {/* Desktop Stepper */}
            <div className="hidden md:flex items-center justify-between relative">
                {/* Background Connecting Track */}
                <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200 -z-0">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
                        style={{
                            width: `${((currentStep - 1) / (IMPORT_STEPS.length - 1)) * 100}%`,
                        }}
                    />
                </div>

                {IMPORT_STEPS.map((step) => {
                    const isCompleted = currentStep > step.num;
                    const isActive = currentStep === step.num;
                    const isAccessible = step.num <= maxVisitedStep;
                    const Icon = step.icon;

                    return (
                        <button
                            key={step.num}
                            type="button"
                            onClick={() => isAccessible && onStepClick(step.num)}
                            disabled={!isAccessible}
                            className={`group relative z-10 flex flex-col items-center text-center transition-all ${
                                !isAccessible ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                            }`}
                        >
                            {/* Step Node Circle */}
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                                    isCompleted
                                        ? "bg-emerald-600 text-white shadow-emerald-500/20 group-hover:scale-105"
                                        : isActive
                                        ? "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white ring-4 ring-indigo-100 shadow-indigo-500/30 scale-110"
                                        : "bg-white border-2 border-slate-200 text-slate-400 group-hover:border-slate-300"
                                }`}
                            >
                                {isCompleted ? (
                                    <Check className="w-5 h-5 stroke-[2.5]" />
                                ) : (
                                    <Icon className="w-5 h-5" />
                                )}
                            </div>

                            {/* Step Title & Subtitle */}
                            <div className="mt-2 space-y-0.5">
                                <p
                                    className={`text-xs font-bold transition-colors ${
                                        isActive
                                            ? "text-indigo-900"
                                            : isCompleted
                                            ? "text-slate-800"
                                            : "text-slate-400"
                                    }`}
                                >
                                    {step.label}
                                </p>
                                <p
                                    className={`text-[10px] hidden lg:block ${
                                        isActive
                                            ? "text-indigo-600 font-medium"
                                            : isCompleted
                                            ? "text-emerald-600 font-medium"
                                            : "text-slate-400"
                                    }`}
                                >
                                    {isCompleted ? "Complété" : step.description}
                                </p>
                            </div>

                            {/* Active Pulse Glow */}
                            {isActive && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Mobile Stepper */}
            <div className="md:hidden flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                        Étape {currentStep} / 5 : {IMPORT_STEPS[currentStep - 1].label}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                        {Math.round(((currentStep - 1) / (IMPORT_STEPS.length - 1)) * 100)}%
                    </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                        style={{
                            width: `${(currentStep / IMPORT_STEPS.length) * 100}%`,
                        }}
                    />
                </div>
                <p className="text-[11px] text-slate-500">
                    {IMPORT_STEPS[currentStep - 1].description}
                </p>
            </div>
        </div>
    );
}
