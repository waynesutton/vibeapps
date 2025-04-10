import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function Footer() {
  const [showAboutModal, setShowAboutModal] = React.useState(false);

  return (
    <footer className="mt-12">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 text-sm text-[#787672]">
          <button
            onClick={() => setShowAboutModal(true)}
            className="hover:text-[#525252]"
          >
            About
          </button>
          <a
            href="https://github.com/stackblitz/vibe-submissions"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#525252]"
          >
            GitHub
          </a>
          <a
            href="https://convex.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#525252]"
          >
            Powered by Convex
          </a>
          <a
            href="https://flow.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#525252]"
          >
            Built with Flow
          </a>
        </div>
      </div>

      <Dialog.Root open={showAboutModal} onOpenChange={setShowAboutModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl w-[90vw] max-w-md">
            <div className="flex justify-between items-start mb-4">
              <Dialog.Title className="text-lg font-medium text-[#2A2825]">
                About Vibe Apps
              </Dialog.Title>
              <Dialog.Close className="text-[#787672] hover:text-[#525252]">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
            <div className="prose prose-sm">
              <p>
                Vibe Apps is a community platform for discovering and sharing vibe coding applications.
                Built with React, TypeScript, and Tailwind CSS, it provides a space for developers to
                showcase their work and engage with others in the community.
              </p>
              <p>
                Features include app submissions, commenting, voting, and a comprehensive admin
                dashboard for content moderation and site management.
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </footer>
  );
}