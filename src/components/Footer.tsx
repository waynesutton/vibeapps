import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { SignInButton } from "@clerk/clerk-react";

export function Footer() {
  const [showAboutModal, setShowAboutModal] = React.useState(false);

  return (
    <footer className="mt-12">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 text-xs text-[#787672]">
          <span className="text-[#787672]">©{new Date().getFullYear()} Convex, Inc.</span>
          <button onClick={() => setShowAboutModal(true)} className="hover:text-[#525252]">
            About
          </button>
          {/* <a href="#" target="_blank" rel="noopener noreferrer" className="hover:text-[#525252]">
            Submit
          </a> */}
          <SignInButton mode="modal">
            <button className="bg-transparent border-none p-0 m-0 cursor-pointer hover:text-[#525252]">
              Sign In
            </button>
          </SignInButton>
          <a
            href="https://convex.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#525252]">
            Powered by Convex
          </a>
          {/*<a
            href="https://chef.convex.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#525252]">
            Cooked with Chef
          </a> */}
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
                Vibe Apps – The place to share and discover new apps built by thevibe coding
                community..
              </p>

              <p>
                Discover and share vibe coding apps built with Convex Chef, Cursor, Bolt, Windsurf,
                Tempo and more.{" "}
                <a
                  href="https://convex.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#525252]">
                  Powered by Convex
                </a>
                .
              </p>

              <p>
                Vibe Apps is the place to discover and share vibe coding apps from anywhere on the
                web — a real-time community platform where vibe coders, developers can share and
                explore apps built with platforms like Convex Chef, Cursor, Bolt, Windsurf, Lovable,
                Tempo and more. Submit your app, vote on others, rank submissions, drop comments,
                and discover what the community is cooking. Built on Convex for real-time
                interaction.
              </p>
              <p>
                <a
                  href="https://github.com/waynesutton/vibeapps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#525252]">
                  Vibe Apps is Open-Source on GitHub
                </a>
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </footer>
  );
}
