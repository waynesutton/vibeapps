import React from "react";

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

  let confirmButtonClasses =
    "px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  if (confirmButtonVariant === "destructive") {
    confirmButtonClasses +=
      " bg-red-600 hover:bg-red-700 text-white focus:ring-red-500";
  } else {
    confirmButtonClasses +=
      " bg-black hover:bg-gray-800 text-white focus:ring-gray-700";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out"
      onClick={handleOverlayClick}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      role="alertdialog"
    >
      <div className="bg-[#F4F2EE] rounded-lg border border-gray-200 p-6 w-full max-w-md m-4 transform transition-all duration-300 ease-in-out scale-100">
        <h2
          id="alert-dialog-title"
          className="text-lg font-semibold text-gray-900 mb-2"
        >
          {title}
        </h2>
        <div
          id="alert-dialog-description"
          className="text-sm text-gray-600 mb-6"
        >
          {description}
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            {cancelButtonText}
          </button>
          <button
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
