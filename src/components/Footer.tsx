import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { SignInButton, useAuth, useClerk } from "@clerk/clerk-react";

export function Footer() {
  const [showAboutModal, setShowAboutModal] = React.useState(false);
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  return (
    <footer className="mt-12">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 text-xs text-[#545454]">
          <span className="text-[#545454]">©{new Date().getFullYear()} Convex, Inc.</span>
          <button onClick={() => setShowAboutModal(true)} className="hover:text-[#525252]">
            About
          </button>
          {/* <a href="#" target="_blank" rel="noopener noreferrer" className="hover:text-[#525252]">
            Submit
          </a> */}
          {isSignedIn ? (
            <button
              onClick={() => signOut()}
              className="bg-transparent border-none p-0 m-0 cursor-pointer hover:text-[#525252]">
              Sign Out
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="bg-transparent border-none p-0 m-0 cursor-pointer hover:text-[#525252]">
                Sign In
              </button>
            </SignInButton>
          )}
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
              <Dialog.Title className="text-lg font-medium text-[#292929]">
                About Vibe Apps
              </Dialog.Title>
              <Dialog.Close className="text-[#545454] hover:text-[#525252]">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
            <div className="prose prose-sm">
              <p>Vibe Apps – The place to share and discover new apps built by vibe coders.</p>

              <p>
                Vibe Apps is a real-time feed of apps built by vibe coders. It’s where you go to
                show off what you’ve built with tools like Convex.dev, Cursor, Bolt, Windsurf,
                Lovable, and Tempo—and see what others are pushing live.{" "}
                <a
                  href="https://convex.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#525252]">
                  Powered by Convex
                </a>
                , the site runs fast, syncs in real time, and makes it easy to:
              </p>
              <ul>
                <li>Submit your app</li>
                <li>Browse and vote on what’s trending</li>
                <li>Leave feedback or get inspired</li>
              </ul>
              <p>
                Whether it’s a weekend build, a fresh SaaS idea, or something weird and
                experimental—drop it here.{" "}
              </p>
              <p>Vibe Apps is for developers who build in public and ship for fun.</p>

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
