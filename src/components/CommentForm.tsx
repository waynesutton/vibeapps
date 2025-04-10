import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface CommentFormProps {
  onSubmit: (content: string, author: string) => void;
  parentId?: string;
}

export function CommentForm({ onSubmit, parentId }: CommentFormProps) {
  const [content, setContent] = React.useState('');
  const [author, setAuthor] = React.useState('');
  const [showNameDialog, setShowNameDialog] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!author) {
      setShowNameDialog(true);
      return;
    }
    onSubmit(content, author);
    setContent('');
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowNameDialog(false);
    onSubmit(content, author);
    setContent('');
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your comment... (Markdown supported)"
          className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] min-h-[100px]"
          required
        />
        <div className="mt-2 text-sm text-[#787672]">
          Comments are held for moderation before appearing on the site.
        </div>
        <button
          type="submit"
          className="mt-2 px-4 py-2 bg-[#2A2825] text-white rounded-md hover:bg-[#525252] transition-colors"
        >
          {parentId ? 'Reply' : 'Comment'}
        </button>
      </form>

      <Dialog.Root open={showNameDialog} onOpenChange={setShowNameDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl w-[90vw] max-w-md">
            <Dialog.Title className="text-lg font-medium text-[#2A2825] mb-4">
              Enter Your Name
            </Dialog.Title>
            <form onSubmit={handleNameSubmit}>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 bg-white border border-[#F4F0ED] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
                required
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowNameDialog(false)}
                  className="px-4 py-2 text-[#787672] hover:text-[#525252]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2A2825] text-white rounded-md hover:bg-[#525252] transition-colors"
                >
                  Submit
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}