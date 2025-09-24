import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { SignInButton, useAuth, useClerk } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";

export function Footer() {
  const [showAboutModal, setShowAboutModal] = React.useState(false);
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  return (
    <footer className="mt-12">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-xs text-[#545454]">
          <span className="text-[#545454]">
            {" "}
            © {new Date().getFullYear()}{" "}
          </span>
          <button
            onClick={() => setShowAboutModal(true)}
            className="hover:text-[#525252]"
          >
            About
          </button>
          {/* <a href="#" target="_blank" rel="noopener noreferrer" className="hover:text-[#525252]">
            Submit
          </a> */}

          <a
            href="https://convex.dev?utm_source=vibeapps-dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#525252]"
          >
            Powered by Convex
          </a>

          <a
            href="https://github.com/waynesutton/vibeapps"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#525252]"
          >
            Open-Source Project
          </a>

          <a
            href="https://www.convex.dev/legal/tos/v2022-03-02"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#525252]"
          >
            Privacy Policy | Terms
          </a>
        </div>
      </div>

      <Dialog.Root open={showAboutModal} onOpenChange={setShowAboutModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl w-[90vw] max-w-md z-50">
            <div className="flex justify-between items-start mb-4">
              <Dialog.Title className="text-lg font-medium text-[#292929]">
                About Vibe Apps
              </Dialog.Title>
              <Dialog.Close className="text-[#545454] hover:text-[#525252]">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
            <div className="prose prose-sm">
              <p>Vibe Apps – The place to share and discover new apps.</p>

              <p>
                Vibe Apps is a real-time feed of apps. It's where you go to show
                off what you've built, and see what others are building.{" "}
                <a
                  href="https://convex.dev?utm_source=vibeapps-dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#525252]"
                >
                  Powered by Convex
                </a>
                , the site runs fast, syncs in real time, and makes it easy to:
              </p>
              <ul>
                <li>Submit your app</li>
                <li>Browse and vote on what's trending</li>
                <li>Leave feedback or get inspired</li>
              </ul>
              <p>
                Whether it's a weekend build, for a hackathon, or just vibe
                coding, drop it here.{" "}
              </p>
              <p></p>

              <p>
                <a
                  href="https://github.com/waynesutton/vibeapps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#525252]"
                >
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
