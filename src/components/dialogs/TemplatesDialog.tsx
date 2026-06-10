import * as Dialog from "@radix-ui/react-dialog";
import { FileText, X } from "lucide-react";

import { useAppStore } from "@/state/appStore";
import { useDocumentStore } from "@/state/documentStore";
import { DOCUMENT_TEMPLATES, instantiateTemplate } from "@/lib/templates";

export default function TemplatesDialog() {
  const open = useAppStore((s) => s.activeDialog === "templates");
  const closeDialog = useAppStore((s) => s.closeDialog);
  const newDocument = useDocumentStore((s) => s.newDocument);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" style={{ width: 600 }}>
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title className="text-sm font-semibold">
              New From Template
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-btn" aria-label="Close templates">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Create a document from a template
          </Dialog.Description>
          <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto p-3">
            {DOCUMENT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                className="flex flex-col gap-1 rounded-lg border p-3 text-left hover:!border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
                onClick={() => {
                  newDocument(instantiateTemplate(template), template.filename);
                  closeDialog();
                }}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <FileText size={13} color="var(--accent)" />
                  {template.name}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {template.description}
                </span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
