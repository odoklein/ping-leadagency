import Image from "next/image";
import { cn } from "@/lib/utils";

interface ElanLogoProps {
    className?: string;
    compact?: boolean;
    tone?: "paper" | "ink" | "petrol";
}

export function ElanLogo({
    className,
    compact = false,
    tone = "paper",
}: ElanLogoProps) {
    const asset = compact
        ? "/brand/ping-icon.png"
        : tone === "petrol"
        ? "/brand/ping-logo-blue.png"
        : "/brand/ping-logo-white.png";
    
    const dimensions = compact
        ? { width: 32, height: 32 }
        : { width: 120, height: 40 };

    return (
        <span
            className={cn("elan-logo", `elan-logo-${tone}`, compact && "elan-logo-compact", className)}
            role="img"
            aria-label="Ping"
        >
            <Image
                aria-hidden="true"
                alt="Ping Logo"
                className="elan-logo-image"
                height={dimensions.height}
                src={asset}
                unoptimized
                width={dimensions.width}
            />
        </span>
    );
}

export default ElanLogo;
