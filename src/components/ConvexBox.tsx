import React from 'react';
import { X } from 'lucide-react';

export function ConvexBox() {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed right-4 bottom-4 bg-[#FDFCFA] border border-[#D5D3D0] rounded-lg p-4 shadow-sm">
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 text-[#787672] hover:text-[#525252]"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
      <a
        href="https://convex.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#525252] hover:text-[#2A2825] font-medium"
      >
        Powered by Convex
      </a>
    </div>
  );
}