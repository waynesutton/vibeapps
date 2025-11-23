import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LogIn } from "lucide-react";
import { SignInButton } from "@clerk/clerk-react";

interface AuthRequiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  action: string; // e.g., "vote", "comment", "rate"
  title?: string;
  description?: string;
}

export function AuthRequiredDialog({
  isOpen,
  onClose,
  action,
  title,
  description,
}: AuthRequiredDialogProps) {
  const defaultTitle = `Sign in to ${action}`;
  const defaultDescription = `You need to be signed in to ${action} on apps. Join the community to participate!`;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg border border-gray-200 w-[90vw] max-w-md z-50">
          <div className="flex justify-between items-start mb-4">
            <Dialog.Title className="text-lg font-medium text-[#292929]">
              {title || defaultTitle}
            </Dialog.Title>
            <Dialog.Close className="text-[#545454] hover:text-[#525252] p-1" onClick={onClose}>
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <div className="mb-6">
            <p className="text-[#525252] text-sm leading-relaxed">
              {description || defaultDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <SignInButton mode="modal">
              <button
                className="w-full flex items-center justify-center gap-2 bg-[#292929] text-white px-4 py-2 rounded-md text-sm hover:bg-[#525252] transition-colors"
                type="button">
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            </SignInButton>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-[#545454] hover:text-[#525252] rounded-md text-sm border border-[#D8E1EC] hover:border-[#A8A29E] transition-colors">
              Maybe Later
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
