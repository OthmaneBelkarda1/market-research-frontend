import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/heading";

export function Strip({
  title,
  subtitle,
  children,
  extra,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  const scrollBy = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 640, behavior: "smooth" });
  };

  return (
    <section
      className="group relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <SectionTitle as="h3" aside={subtitle} className="mb-3">
        {title}
      </SectionTitle>
      <div className="relative">
        <div ref={ref} className="strip-scroll flex gap-3 overflow-x-auto pb-1">
          {children}
          {extra}
        </div>
        {(["left", "right"] as const).map((side) => (
          <button
            key={side}
            type="button"
            aria-label={side === "left" ? "Défiler à gauche" : "Défiler à droite"}
            onClick={() => scrollBy(side === "left" ? -1 : 1)}
            className={cn(
              "absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface shadow-soft transition-opacity md:flex",
              side === "left" ? "-left-4" : "-right-4",
              hover ? "opacity-100" : "opacity-0",
            )}
          >
            {side === "left" ? (
              <ChevronLeft className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export function StripImage({
  src,
  alt,
  fallbackLabel,
}: {
  src?: string | null;
  alt: string;
  fallbackLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (fallbackLabel || "?").trim().charAt(0).toUpperCase();

  if (!src || failed) {
    return (
      <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-accent to-surface">
        <span className="font-serif text-3xl text-primary/50">{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-36 w-full bg-muted object-cover"
    />
  );
}

export function StripCard({ href, children }: { href?: string | null; children: ReactNode }) {
  const className =
    "block w-[200px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-shadow hover:shadow-soft";
  if (!href) return <div className={className}>{children}</div>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
      {children}
    </a>
  );
}

export function StripSkeletons() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-64 w-[200px] shrink-0 animate-pulse rounded-xl border border-border bg-surface"
        />
      ))}
    </>
  );
}

export function StripNotice({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-3">
      <SectionTitle as="h3" size="sm" tone="muted" aside={message}>
        {title}
      </SectionTitle>
    </section>
  );
}

export function MoreChip({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex w-[120px] shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-surface/60 text-xs text-muted-foreground">
      +{count} autres
    </div>
  );
}
