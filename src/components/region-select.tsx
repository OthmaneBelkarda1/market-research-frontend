/**
 * Sélecteur de pays : les 249 codes ISO 3166-1 alpha-2 officiellement assignés.
 *
 * Le back n'accepte plus seulement cinq régions — la restriction de lancement est
 * levée, le pipeline traite tous les codes. Une liste de 249 entrées ne se parcourt
 * pas dans un `<Select>` : on la cherche. D'où la combinaison popover + `Command`,
 * déjà utilisée ailleurs dans shadcn, plutôt qu'un menu déroulant de trois écrans.
 *
 * La recherche porte sur le libellé sans accents et sur le code : « japon »,
 * « Japon » et « jp » mènent au même pays.
 */

import { useState } from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";

import { REGIONS, REGIONS_FREQUENTES, findRegion } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const FREQUENTES = REGIONS_FREQUENTES.map((code) => findRegion(code)).filter(
  (r): r is NonNullable<typeof r> => Boolean(r),
);

// Les marchés fréquents ne figurent pas deux fois : `Command` sélectionne par
// valeur, et un doublon ferait réagir les deux lignes ensemble.
const AUTRES = REGIONS.filter((r) => !REGIONS_FREQUENTES.includes(r.code));

export function RegionSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = findRegion(value);

  const ligne = (r: (typeof REGIONS)[number]) => (
    <CommandItem
      key={r.code}
      value={r.search}
      onSelect={() => {
        onChange(r.code);
        setOpen(false);
      }}
    >
      <span className="mr-2 text-base leading-none">{r.flag}</span>
      <span className="flex-1 truncate">{r.label}</span>
      <span className="ml-2 text-[11px] tabular-nums text-muted-foreground">{r.code}</span>
      <Check className={cn("ml-2 size-4", r.code === value ? "opacity-100" : "opacity-0")} />
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-11 w-full justify-between rounded-xl bg-surface px-3 font-normal"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-base leading-none">{selected.flag}</span>
              <span className="truncate">{selected.label}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                ({selected.code})
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Globe className="size-4" />
              Choisir un pays
            </span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Rechercher un pays…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Aucun pays ne correspond.</CommandEmpty>
            <CommandGroup heading="Marchés fréquents">{FREQUENTES.map(ligne)}</CommandGroup>
            <CommandGroup heading="Tous les pays">{AUTRES.map(ligne)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
