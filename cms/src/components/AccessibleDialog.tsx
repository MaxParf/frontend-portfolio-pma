import { useEffect, useRef } from "react";

interface AccessibleDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const focusable = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AccessibleDialog({ title, description, confirmLabel, cancelLabel = "Cancel", busy = false, error, onCancel, onConfirm }: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const previousFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab") return;
      const nodes = [...(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? [])];
      if (!nodes.length) { event.preventDefault(); return; }
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!dialogRef.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus.current?.focus(); };
  }, [busy, onCancel]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section ref={dialogRef} className="publish-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description">
      <h2 id="dialog-title">{title}</h2><p id="dialog-description">{description}</p>
      {error ? <p ref={errorRef} className="editor-error" role="alert" tabIndex={-1}>{error}</p> : null}
      <div className="dialog-actions"><button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button><button type="button" onClick={onConfirm} disabled={busy}>{busy ? "Working..." : confirmLabel}</button></div>
    </section>
  </div>;
}
