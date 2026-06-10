import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

type Props = {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export default function PromptModal({
  open,
  title,
  label,
  initialValue = "",
  confirmLabel = "OK",
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, initialValue]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          style={{ width: 420 }}
          aria-describedby={undefined}
        >
          <form
            className="flex flex-col gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) onConfirm(value.trim());
            }}
          >
            <Dialog.Title className="text-sm font-semibold">
              {title}
            </Dialog.Title>
            <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              {label}
              <input
                ref={inputRef}
                className="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!value.trim()}
              >
                {confirmLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
