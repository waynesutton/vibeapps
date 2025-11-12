import { useState, useCallback } from "react";
import MessageDialog from "../components/ui/MessageDialog";
import AlertDialog from "../components/ui/AlertDialog";

interface DialogState {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  buttonText?: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonVariant?: "default" | "destructive";
  onConfirm: () => void;
}

export const useDialog = () => {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
    buttonText: "OK",
  });

  const [confirmDialogState, setConfirmDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    description: "",
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel",
    confirmButtonVariant: "default",
    onConfirm: () => {},
  });

  // Show a simple message dialog
  const showMessage = useCallback(
    (
      title: string,
      message: React.ReactNode,
      variant: "info" | "success" | "warning" | "error" = "info",
      buttonText: string = "OK"
    ) => {
      setDialogState({
        isOpen: true,
        title,
        message,
        variant,
        buttonText,
      });
    },
    []
  );

  // Show a confirmation dialog
  const showConfirm = useCallback(
    (
      title: string,
      description: React.ReactNode,
      onConfirm: () => void,
      options?: {
        confirmButtonText?: string;
        cancelButtonText?: string;
        confirmButtonVariant?: "default" | "destructive";
      }
    ) => {
      setConfirmDialogState({
        isOpen: true,
        title,
        description,
        confirmButtonText: options?.confirmButtonText || "Confirm",
        cancelButtonText: options?.cancelButtonText || "Cancel",
        confirmButtonVariant: options?.confirmButtonVariant || "default",
        onConfirm,
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    confirmDialogState.onConfirm();
    closeConfirmDialog();
  }, [confirmDialogState, closeConfirmDialog]);

  const DialogComponents = useCallback(
    () => (
      <>
        <MessageDialog
          isOpen={dialogState.isOpen}
          onClose={closeDialog}
          title={dialogState.title}
          message={dialogState.message}
          variant={dialogState.variant}
          buttonText={dialogState.buttonText}
        />
        <AlertDialog
          isOpen={confirmDialogState.isOpen}
          onClose={closeConfirmDialog}
          onConfirm={handleConfirm}
          title={confirmDialogState.title}
          description={confirmDialogState.description}
          confirmButtonText={confirmDialogState.confirmButtonText}
          cancelButtonText={confirmDialogState.cancelButtonText}
          confirmButtonVariant={confirmDialogState.confirmButtonVariant}
        />
      </>
    ),
    [
      dialogState,
      confirmDialogState,
      closeDialog,
      closeConfirmDialog,
      handleConfirm,
    ]
  );

  return {
    showMessage,
    showConfirm,
    DialogComponents,
  };
};

