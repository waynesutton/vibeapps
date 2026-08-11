import React from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonVariant?: "default" | "destructive";
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmButtonText = "Confirm",
  cancelButtonText = "Cancel",
  confirmButtonVariant = "default",
}) => {
  // Close on Escape while open.
  useEscapeKey(isOpen, onClose);

  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

  // Move focus into the dialog when it opens. Cancel is the safe default for
  // destructive confirms; Enter then confirms only after Tab to the action.
  React.useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Keep Tab / Shift+Tab cycling between the two buttons while open.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const cancel = cancelButtonRef.current;
    const confirm = confirmButtonRef.current;
    if (!cancel || !confirm) return;
    e.preventDefault();
    if (document.activeElement === cancel) {
      confirm.focus();
    } else {
      cancel.focus();
    }
  };

  let confirmButtonClasses =
    "px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  if (confirmButtonVariant === "destructive") {
    confirmButtonClasses +=
      " bg-red-600 hover:bg-red-700 text-white focus:ring-red-500";
  } else {
    confirmButtonClasses +=
      " bg-cta hover:bg-cta-hover text-on-cta focus:ring-ink";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      aria-modal="true"
      role="alertdialog"
    >
      <div className="bg-canvas rounded-lg border border-hairline p-6 w-full max-w-md m-4 transform transition-all duration-300 ease-in-out scale-100">
        <h2
          id="alert-dialog-title"
          className="text-lg font-semibold text-ink mb-2"
        >
          {title}
        </h2>
        <div
          id="alert-dialog-description"
          className="text-sm text-copy mb-6"
        >
          {description}
        </div>
        <div className="flex justify-end space-x-3">
          <button
            ref={cancelButtonRef}
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-md text-sm font-medium text-copy bg-surface-alt hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:ring-offset-2"
          >
            {cancelButtonText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            type="button"
            className={confirmButtonClasses}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
