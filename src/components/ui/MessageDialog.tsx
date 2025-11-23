import React from "react";

interface MessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  buttonText?: string;
}

const MessageDialog: React.FC<MessageDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  variant = "info",
  buttonText = "OK",
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleGlobalKeyDown);
      return () => document.removeEventListener("keydown", handleGlobalKeyDown);
    }
  }, [isOpen, onClose]);

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return {
          iconColor: "text-green-600",
          buttonClass: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
        };
      case "warning":
        return {
          iconColor: "text-yellow-600",
          buttonClass:
            "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
        };
      case "error":
        return {
          iconColor: "text-red-600",
          buttonClass: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
        };
      default:
        return {
          iconColor: "text-blue-600",
          buttonClass: "bg-black hover:bg-gray-800 focus:ring-gray-700",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out"
      onClick={handleOverlayClick}
      aria-labelledby="message-dialog-title"
      aria-describedby="message-dialog-description"
      role="alertdialog"
    >
      <div className="bg-[#F4F2EE] rounded-lg border border-gray-200 p-6 w-full max-w-md m-4 transform transition-all duration-300 ease-in-out scale-100">
        <div className="flex flex-col">
          <h2
            id="message-dialog-title"
            className="text-lg font-semibold text-gray-900 mb-2"
          >
            {title}
          </h2>
          <div
            id="message-dialog-description"
            className="text-sm text-gray-600 mb-6"
          >
            {message}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            onKeyDown={handleKeyDown}
            autoFocus
            type="button"
            className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.buttonClass}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageDialog;
