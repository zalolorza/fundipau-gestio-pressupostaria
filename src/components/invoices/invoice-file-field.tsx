"use client";

import { upload } from "@vercel/blob/client";
import { FileIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  INVOICE_FILE_MAX_BYTES,
  INVOICE_FILE_PREFIX,
  INVOICE_FILE_TYPES,
  invoiceFileHref,
} from "@/lib/invoice-file";

export type InvoiceFileValue = { filePathname: string; fileName: string };

export function InvoiceFileField({
  value,
  onChange,
  /** Pathname ja desat a la BD: no s'esborra fins a desar la factura */
  committedPathname,
}: {
  value: InvoiceFileValue | null;
  onChange: (next: InvoiceFileValue | null) => void;
  committedPathname?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (file.size > INVOICE_FILE_MAX_BYTES) {
      toast.error("L'arxiu supera els 20 MB");
      return;
    }
    if (
      !INVOICE_FILE_TYPES.includes(
        file.type as (typeof INVOICE_FILE_TYPES)[number],
      )
    ) {
      toast.error("Només s'admeten PDF o imatges (JPEG, PNG, WebP)");
      return;
    }

    setUploading(true);
    try {
      const previous = value;
      const blob = await upload(`${INVOICE_FILE_PREFIX}${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/invoices/upload",
      });
      onChange({ filePathname: blob.pathname, fileName: file.name });
      // Neteja només uploads orfes d'aquesta sessió (no el que ja hi ha a la BD)
      if (
        previous?.filePathname &&
        previous.filePathname !== blob.pathname &&
        previous.filePathname !== committedPathname
      ) {
        void fetch(
          `/api/invoices/file?pathname=${encodeURIComponent(previous.filePathname)}`,
          {
            method: "DELETE",
          },
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No s'ha pogut pujar l'arxiu",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Field>
      <FieldLabel>Arxiu de la factura</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={INVOICE_FILE_TYPES.join(",")}
        disabled={uploading}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <a
            href={invoiceFileHref(value.filePathname)}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
          >
            {value.fileName}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={uploading}
            aria-label="Canvia l'arxiu"
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <UploadIcon />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={uploading}
            aria-label="Treu l'arxiu"
            className="text-destructive"
            onClick={() => onChange(null)}
          >
            <Trash2Icon />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <UploadIcon />
          )}
          {uploading ? "Pujant…" : "Puja PDF o imatge"}
        </Button>
      )}
      <FieldDescription>Opcional (màx. 20 MB)</FieldDescription>
    </Field>
  );
}
