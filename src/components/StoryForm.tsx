import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AVAILABLE_TAGS } from './Layout';

export function StoryForm() {
  const navigate = useNavigate();
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [formData, setFormData] = React.useState({
    title: '',
    tagline: '',
    url: '',
    images: [] as File[],
    linkedinUrl: '',
    twitterUrl: '',
    redditUrl: '',
  });
  const [showSuccess, setShowSuccess] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuccess(true);
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 4) {
      alert('You can only upload up to 4 images');
      return;
    }
    setFormData(prev => ({ ...prev, images: files }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="text-[#787672] hover:text-[#525252] inline-block mb-6">
        ← Back to Apps
      </Link>
      
      <div className="bg-white p-6 rounded-lg border border-[#D5D3D0]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-[#2A2825]">Submit your Vibe Coding app</h2>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[#525252] mb-1">
              App Title
            </label>
            <input
              type="text"
              id="title"
              placeholder="Site name"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              required
            />
          </div>

          <div>
            <label htmlFor="tagline" className="block text-sm font-medium text-[#525252] mb-1">
              App Project Tagline
            </label>
            <input
              type="text"
              id="tagline"
              placeholder="One sentence pitch"
              value={formData.tagline}
              onChange={e => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              required
            />
          </div>

          <div>
            <label htmlFor="url" className="block text-sm font-medium text-[#525252] mb-1">
              App Website Link
            </label>
            <div className="text-sm text-[#787672] mb-2">
              Enter your app url (ex: https://)
            </div>
            <input
              type="url"
              id="url"
              placeholder="https://"
              value={formData.url}
              onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              required
            />
          </div>

          <div>
            <label htmlFor="images" className="block text-sm font-medium text-[#525252] mb-1">
              Upload Screenshot
            </label>
            <input
              type="file"
              id="images"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#F4F0ED] file:text-[#525252] hover:file:bg-[#e5e1de]"
            />
            <div className="text-sm text-[#787672] mt-1">
              Choose file
            </div>
          </div>

          <div>
            <label htmlFor="linkedinUrl" className="block text-sm font-medium text-[#525252] mb-1">
              LinkedIn Announcement Post URL
            </label>
            <input
              type="url"
              id="linkedinUrl"
              placeholder="https://linkedin.com/post/..."
              value={formData.linkedinUrl}
              onChange={e => setFormData(prev => ({ ...prev, linkedinUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
            />
          </div>

          <div>
            <label htmlFor="twitterUrl" className="block text-sm font-medium text-[#525252] mb-1">
              X (Twitter) or Bluesky Announcement Post URL
            </label>
            <input
              type="url"
              id="twitterUrl"
              placeholder="https://twitter.com/..."
              value={formData.twitterUrl}
              onChange={e => setFormData(prev => ({ ...prev, twitterUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
            />
          </div>

          <div>
            <label htmlFor="redditUrl" className="block text-sm font-medium text-[#525252] mb-1">
              Reddit Announcement Post URL
            </label>
            <input
              type="url"
              id="redditUrl"
              placeholder="https://reddit.com/r/..."
              value={formData.redditUrl}
              onChange={e => setFormData(prev => ({ ...prev, redditUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#525252] mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => toggleTag(tag.name)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    selectedTags.includes(tag.name)
                      ? 'bg-[#F4F0ED] text-[#2A2825]'
                      : 'text-[#787672] hover:text-[#525252]'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-[4px] hover:bg-[#e5e1de] transition-colors"
            >
              Submit App
            </button>
            <Link
              to="/"
              className="px-4 py-2 text-[#787672] hover:text-[#525252] rounded-[4px]"
            >
              Cancel
            </Link>
          </div>

          <div className="text-sm text-[#787672]">
            To maintain quality and prevent spam, you can only submit one project a day.
          </div>

          {showSuccess && (
            <div className="mt-4 p-4 bg-[#F4F0ED] text-[#525252] rounded-[4px]">
              Thanks for cooking!
            </div>
          )}
        </form>
      </div>
    </div>
  );
}