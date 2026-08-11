import React, { useState } from "react";

interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  description?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  placeholder = "",
  defaultValue = "",
  confirmButtonText = "OK",
  cancelButtonText = "Cancel",
}) => {
  const [value, setValue] = useState(defaultValue);

  React.useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

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

  const handleConfirm = () => {
    onConfirm(value);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out"
      onClick={handleOverlayClick}
      aria-labelledby="prompt-dialog-title"
      aria-describedby="prompt-dialog-description"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-surface rounded-lg border border-hairline p-6 w-full max-w-md m-4 transform transition-all duration-300 ease-in-out scale-100">
        <h2
          id="prompt-dialog-title"
          className="text-lg font-semibold text-ink mb-2"
        >
          {title}
        </h2>
        {description && (
          <div
            id="prompt-dialog-description"
            className="text-sm text-copy mb-4"
          >
            {description}
          </div>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full px-3 py-2 border border-hairline-strong rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent mb-6"
        />
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-md text-sm font-medium text-copy bg-surface-alt hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:ring-offset-2"
          >
            {cancelButtonText}
          </button>
          <button
            onClick={handleConfirm}
            type="button"
            className="px-4 py-2 rounded-md text-sm font-medium bg-cta hover:bg-cta-hover text-on-cta transition-colors focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptDialog;
