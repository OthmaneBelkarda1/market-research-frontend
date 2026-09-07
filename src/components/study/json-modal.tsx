import { useState } from "react";
import { Download, FileJson } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MAX_CHARS = 200_000;

export function JsonModal({
  open,
  onOpenChange,
  title,
  payload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  payload: unknown;
}) {
  const [full] = useState(() => "");
  void full;
  const text = payload === undefined ? "" : JSON.stringify(payload, null, 2);
  const truncated = text.length > MAX_CHARS;
  const shown = truncated ? `${text.slice(0, MAX_CHARS)}\n…` : text;

  const download = () => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <FileJson className="size-4 text-primary" />
            JSON brut — {title}
          </DialogTitle>
          <DialogDescription>
            {truncated
              ? "Aperçu tronqué à 200 Ko. Téléchargez le fichier pour le contenu complet."
              : "Contenu complet de la charge utile renvoyée par le collecteur."}
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-[55vh] overflow-auto rounded-xl border border-border bg-muted/60 p-3 text-[11px] leading-relaxed">
          {shown || "Aucune donnée."}
        </pre>
        <div className="flex justify-end">
          <Button variant="outline" onClick={download} className="gap-2">
            <Download className="size-4" />
            Télécharger le JSON
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
