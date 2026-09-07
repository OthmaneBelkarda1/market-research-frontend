/**
 * Rendu Markdown minimal du rapport F7, en éléments React (jamais de HTML injecté).
 * Couvre ce que le pipeline produit : titres, listes, tableaux, code, citations, liens,
 * blocs repliables et commentaires de traçabilité.
 *
 * Deux constructions du gabarit v2 sont traitées ici, et pas par confort :
 *
 * - les **commentaires HTML** (`<!-- f7:v2 -->`, `<!-- sources: … -->`,
 *   `<!-- extrait: … -->`, `<!-- widget:extraits … -->`) servent l'audit du rapport,
 *   pas son lecteur. Ils sont retirés du rendu et **restent dans le fichier
 *   téléchargé**, qui part de `rapport_markdown` brut ;
 * - les blocs `<details>` portent les contenus secondaires — annexe de méthode,
 *   détail des besoins, actions suivantes. Sans traitement, le parseur les affichait
 *   comme du texte et dépliait tout : or le repli est ce qui rend le rapport court.
 */

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { VERDICT_META, verdictFromDecisionTitle } from "@/lib/verdict";

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

/**
 * Commentaires HTML, multilignes compris.
 *
 * Retirés de la SOURCE avant tout découpage : un commentaire posé en fin de ligne ne
 * doit pas davantage se retrouver dans le texte rendu.
 */
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={key} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
            {part.slice(1, -1)}
          </code>
        );
      }
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link) {
        const href = link[2] ?? "";
        const safe = /^https?:\/\//i.test(href);
        return safe ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {link[1]}
          </a>
        ) : (
          <Fragment key={key}>{link[1]}</Fragment>
        );
      }
      return <Fragment key={key}>{part}</Fragment>;
    });
}

/**
 * Titres du rapport : la même grammaire que le reste de l'application
 * (cf. `components/heading.tsx`), déclinée sur quatre niveaux. Chaque niveau
 * porte un seul signe de rupture — tiret, filet, ou rien — pour que la
 * profondeur se lise d'un coup d'œil sur un document long.
 */
const HEADING_CLASS: Record<number, string> = {
  1: "title-display title-rule mt-10 text-2xl first:mt-0",
  2: "title-display title-bar mt-8 text-xl first:mt-0",
  3: "title-display mt-6 text-base first:mt-0",
  4: "mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:mt-0",
};

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableSeparator = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

const isDetailsOpen = (line: string) => /^\s*<details\b[^>]*>\s*$/i.test(line);
const isDetailsClose = (line: string) => /^\s*<\/details>\s*$/i.test(line);
const SUMMARY = /^\s*<summary>(.*)<\/summary>\s*$/i;

/**
 * Bloc repliable, replié par défaut.
 *
 * Le motif — bouton pleine largeur, chevron qui pivote, contenu séparé par une bordure
 * haute — est celui de « Détail de la collecte ». Le rapport n'introduit pas une
 * seconde grammaire de repli dans la même page.
 */
function DetailsBlock({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-foreground/90">{summary}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? <div className="border-t border-border px-4 py-3">{children}</div> : null}
    </section>
  );
}

/**
 * Découpe une source Markdown en blocs React.
 *
 * Extraite de `Markdown` pour être réentrante : le contenu d'un `<details>` est du
 * Markdown complet — tableaux et listes compris — et se rend par le même chemin.
 */
function parseBlocks(source: string, keyPrefix = "b"): ReactNode[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let i = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const key = `${keyPrefix}-p-${blocks.length}`;
    // Un saut de ligne dur (deux espaces en fin de ligne) est conservé : l'en-tête du
    // rapport F7 s'en sert pour empiler marché / catégorie / date.
    const body: ReactNode[] = [];
    paragraph.forEach((raw, n) => {
      const hardBreak = /\s{2,}$/.test(raw) && n < paragraph.length - 1;
      if (n > 0 && !/\s{2,}$/.test(paragraph[n - 1] ?? "")) body.push(" ");
      body.push(...renderInline(raw.trim(), `${key}-${n}`));
      if (hardBreak) body.push(<br key={`${key}-br-${n}`} />);
    });
    blocks.push(
      <p key={key} className="mt-3 text-sm leading-relaxed text-foreground/85 first:mt-0">
        {body}
      </p>,
    );
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const key = `${keyPrefix}-${blocks.length}`;

    if (!line.trim()) {
      flushParagraph();
      i += 1;
      continue;
    }

    // Bloc repliable. La profondeur est comptée pour qu'un `<details>` imbriqué ne
    // referme pas son parent au premier `</details>` rencontré.
    if (isDetailsOpen(line)) {
      flushParagraph();
      let depth = 1;
      let summary = "Détail";
      const body: string[] = [];
      i += 1;
      while (i < lines.length) {
        const current = lines[i] ?? "";
        if (isDetailsClose(current)) {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        } else if (isDetailsOpen(current)) {
          depth += 1;
        }
        const titre = SUMMARY.exec(current);
        if (titre && depth === 1 && !body.length) {
          summary = titre[1]?.trim() || summary;
        } else {
          body.push(current);
        }
        i += 1;
      }
      blocks.push(
        <DetailsBlock key={key} summary={summary}>
          {parseBlocks(body.join("\n"), `${key}-d`)}
        </DetailsBlock>,
      );
      continue;
    }

    // Bloc de code délimité par ```
    if (/^\s*```/.test(line)) {
      flushParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={key}
          className="mt-4 overflow-x-auto rounded-xl border border-border bg-muted/60 p-3 text-[11px] leading-relaxed"
        >
          {body.join("\n")}
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1]?.length ?? 1, 4);
      const Tag = `h${Math.min(level + 1, 6)}` as "h2" | "h3" | "h4" | "h5";
      const texte = heading[2] ?? "";
      // « Décision : Go conditionnel — … » est la seule ligne du rapport qui porte
      // un jugement : elle se lit à la couleur avant de se lire au mot. Les autres
      // titres gardent l'accent de l'application.
      const verdict = verdictFromDecisionTitle(texte);
      blocks.push(
        <Tag
          key={key}
          className={cn(
            HEADING_CLASS[level] ?? HEADING_CLASS[4],
            verdict && [VERDICT_META[verdict].text, VERDICT_META[verdict].accent],
          )}
        >
          {renderInline(texte, key)}
        </Tag>,
      );
      i += 1;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph();
      blocks.push(<hr key={key} className="my-6 border-border" />);
      i += 1;
      continue;
    }

    // Tableau : au moins un en-tête et sa ligne de séparation
    if (isTableRow(line) && isTableSeparator(lines[i + 1] ?? "")) {
      flushParagraph();
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i] ?? "")) {
        rows.push(splitRow(lines[i] ?? ""));
        i += 1;
      }
      blocks.push(
        <div key={key} className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-muted/60">
              <tr>
                {header.map((cell, c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {renderInline(cell, `${key}-h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-border align-top">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 text-foreground/85">
                      {renderInline(cell, `${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Citation
    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i] ?? "")) {
        body.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={key}
          className="mt-4 border-l-2 border-primary/40 bg-accent/40 px-4 py-2 text-sm leading-relaxed text-foreground/80"
        >
          {renderInline(body.join(" "), key)}
        </blockquote>,
      );
      continue;
    }

    // Listes
    const bullet = /^\s*[-*+]\s+/;
    const ordered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || ordered.test(line)) {
      flushParagraph();
      const isOrdered = ordered.test(line);
      const marker = isOrdered ? ordered : bullet;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(marker, ""));
        i += 1;
      }
      const ListTag = isOrdered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={key}
          className={`mt-3 space-y-1 pl-5 text-sm leading-relaxed text-foreground/85 ${
            isOrdered ? "list-decimal" : "list-disc"
          }`}
        >
          {items.map((item, n) => (
            <li key={n} className="pl-1">
              {renderInline(item, `${key}-${n}`)}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    paragraph.push(line);
    i += 1;
  }

  flushParagraph();
  return blocks;
}

export function Markdown({ source }: { source: string }) {
  // Les commentaires partent AVANT le découpage : ils portent la traçabilité du
  // rapport, qui reste dans le fichier téléchargé mais n'a rien à faire à l'écran.
  return <div className="markdown-body">{parseBlocks(source.replace(HTML_COMMENT, ""))}</div>;
}
