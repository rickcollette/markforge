import { useRef, useState } from "react";

type Props = {
  /** Called with the pointer's horizontal movement in px since the last event. */
  onDelta: (dx: number) => void;
  /** Double-click resets to the default size. */
  onReset?: () => void;
  label: string;
};

/** Draggable vertical divider between two columns. */
export default function ResizeHandle({ onDelta, onReset, label }: Props) {
  const lastX = useRef(0);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      className="resize-handle"
      data-dragging={dragging || undefined}
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        e.preventDefault();
        lastX.current = e.clientX;
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - lastX.current;
        lastX.current = e.clientX;
        if (dx !== 0) onDelta(dx);
      }}
      onPointerUp={(e) => {
        setDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    />
  );
}
