import type { ElementType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Titres de l'application.
 *
 * Trois composants couvrent la totalité des niveaux : `Eyebrow` annonce,
 * `PageTitle` ouvre une page, `SectionTitle` ouvre un bloc. Les signes visuels
 * (sérif resserrée, filet vertical, tiret) viennent des utilitaires
 * `title-display` / `title-bar` / `title-rule` définis dans `styles.css` :
 * un seul endroit à toucher pour redessiner tous les titres du produit.
 */

/** Micro-label au-dessus d'un titre : contexte, jamais information neuve. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-px w-5 rounded-full bg-gradient-to-r from-primary to-primary/0"
      />
      {children}
    </span>
  );
}

type Tone = "default" | "accent" | "muted" | "danger";

/**
 * Un ton fixe la couleur du texte, celle de l'icône et la teinte du filet — via
 * `--title-accent`, que lisent les utilitaires `title-bar` et `title-rule`.
 */
const TONE: Record<Tone, { text: string; icon: string; accent?: string }> = {
  default: { text: "text-foreground", icon: "text-primary" },
  accent: { text: "text-primary", icon: "text-primary" },
  muted: {
    text: "text-muted-foreground",
    icon: "text-muted-foreground",
    accent: "[--title-accent:var(--muted-foreground)]",
  },
  danger: {
    text: "text-danger",
    icon: "text-danger",
    accent: "[--title-accent:var(--danger)]",
  },
};

/**
 * Titre de page (h1). `hero` pour une page d'entrée, `page` pour une page de
 * contenu, où le titre partage sa ligne avec les actions.
 */
export function PageTitle({
  eyebrow,
  children,
  description,
  actions,
  align = "left",
  size = "page",
  rule = false,
  className,
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  align?: "left" | "center";
  size?: "hero" | "page";
  rule?: boolean;
  className?: string;
}) {
  const centered = align === "center";

  return (
    <header className={cn(centered && "text-center", className)}>
      {eyebrow ? (
        <div className={cn("mb-3 flex", centered && "justify-center")}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap items-start gap-x-4 gap-y-3",
          actions ? "justify-between" : centered && "justify-center",
        )}
      >
        <h1
          className={cn(
            "title-display",
            size === "hero" ? "text-3xl md:text-[2.5rem]" : "text-2xl md:text-3xl",
            rule && (centered ? "title-rule-center" : "title-rule"),
          )}
        >
          {children}
        </h1>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>

      {description ? (
        <p
          className={cn(
            "mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground",
            centered && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}

/**
 * Titre de section. Le filet vertical marque le début du bloc ; `aside` reçoit
 * ce qui se lit sur la même ligne (compte d'éléments, boutons de la section).
 */
export function SectionTitle({
  as: Tag = "h2",
  icon: Icon,
  aside,
  children,
  size = "md",
  tone = "default",
  bar = true,
  className,
}: {
  as?: ElementType;
  icon?: LucideIcon;
  aside?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md";
  tone?: Tone;
  bar?: boolean;
  /** Posé sur la ligne complète quand il y a un `aside`, sur le titre sinon. */
  className?: string;
}) {
  const heading = (
    <Tag
      className={cn(
        "title-display flex items-center gap-2",
        bar && "title-bar",
        size === "sm" ? "text-base" : "text-lg",
        TONE[tone].text,
        TONE[tone].accent,
        !aside && className,
      )}
    >
      {Icon ? <Icon className={cn("size-4 shrink-0", TONE[tone].icon)} /> : null}
      <span>{children}</span>
    </Tag>
  );

  if (!aside) return heading;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      {heading}
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {aside}
      </div>
    </div>
  );
}
