import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import { useAppStore } from "@/state/appStore";
import { editorBridge } from "@/state/documentStore";
import { pickImageFile } from "@/lib/tauri/dialogs";

/** Insert Link and Insert Image dialogs (shared shell). */
export default function LinkDialog({ mode }: { mode: "link" | "image" }) {
  const open = useAppStore((s) => s.activeDialog === mode);
  const closeDialog = useAppStore((s) => s.closeDialog);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) {
      setText(editorBridge()?.getSelection() ?? "");
      setUrl("");
    }
  }, [open]);

  const insert = () => {
    const bridge = editorBridge();
    if (!bridge) return;
    if (mode === "link") {
      bridge.insertText(`[${text || url}](${url})`);
    } else {
      bridge.insertText(`![${text}](${url.replace(/\\/g, "/")})`);
    }
    closeDialog();
    bridge.focus();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          style={{ width: 440 }}
          aria-describedby={undefined}
        >
          <form
            className="flex flex-col gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) insert();
            }}
          >
            <Dialog.Title className="text-sm font-semibold">
              {mode === "link" ? "Insert Link" : "Insert Image"}
            </Dialog.Title>
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {mode === "link" ? "Link text" : "Alt text"}
              <input
                className="input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus={!text}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {mode === "link" ? "URL or relative path" : "Image URL or relative path"}
              <div className="flex gap-1">
                <input
                  className="input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={mode === "link" ? "https://… or ./notes.md" : "./assets/image.png"}
                  autoFocus={Boolean(text)}
                />
                {mode === "image" && (
                  <button
                    type="button"
                    className="btn shrink-0"
                    onClick={async () => {
                      const file = await pickImageFile();
                      if (file) setUrl(file);
                    }}
                  >
                    Browse…
                  </button>
                )}
              </div>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={closeDialog}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!url.trim()}>
                Insert
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
