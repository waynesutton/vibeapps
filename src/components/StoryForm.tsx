import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Github } from "lucide-react";

export function StoryForm() {
  const navigate = useNavigate();
  const [selectedTagIds, setSelectedTagIds] = React.useState<Id<"tags">[]>([]);
  const [formData, setFormData] = React.useState({
    title: "",
    tagline: "",
    url: "",
    image: null as File | null,
    linkedinUrl: "",
    twitterUrl: "",
    githubUrl: "",
    chefShowUrl: "",
    name: "",
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = React.useState(false);

  const availableTags = useQuery(api.tags.list);

  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);
  const submitStory = useMutation(api.stories.submit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedTagIds.length) {
      if (!selectedTagIds.length) {
        setSubmitError("Please select at least one tag.");
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setShowSuccessMessage(false);

    try {
      let screenshotId: Id<"_storage"> | undefined = undefined;

      if (formData.image) {
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": formData.image.type },
          body: formData.image,
        });
        const { storageId } = await result.json();
        if (!storageId) {
          throw new Error("Failed to get storage ID after upload.");
        }
        screenshotId = storageId;
      }

      const result = await submitStory({
        title: formData.title,
        tagline: formData.tagline,
        url: formData.url,
        tagIds: selectedTagIds,
        name: formData.name,
        email: formData.email || undefined,
        screenshotId: screenshotId,
        linkedinUrl: formData.linkedinUrl || undefined,
        twitterUrl: formData.twitterUrl || undefined,
        githubUrl: formData.githubUrl || undefined,
        chefShowUrl: formData.chefShowUrl || undefined,
      });

      setShowSuccessMessage(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Failed to submit story:", error);
      setSubmitError(
        error instanceof Error ? error.message : "An unknown error occurred during submission."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tagId: Id<"tags">) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError("Screenshot file size should not exceed 5MB.");
        e.target.value = ""; // Clear the file input
        setFormData((prev) => ({ ...prev, image: null })); // Reset image state
      } else {
        setSubmitError(null); // Clear error if size is valid
        setFormData((prev) => ({ ...prev, image: file }));
      }
    } else {
      setFormData((prev) => ({ ...prev, image: null })); // Handle case where file is deselected
    }
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
            <label htmlFor="name" className="block text-sm font-medium text-[#525252] mb-1">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#525252] mb-1">
              Contact Email
            </label>
            <div className="text-xs text-[#787672] mb-2">(Optional, for contest use only)</div>
            <input
              type="email"
              id="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[#525252] mb-1">
              App Title
            </label>
            <input
              type="text"
              id="title"
              placeholder="Site name"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              required
              disabled={isSubmitting}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, tagline: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="url" className="block text-sm font-medium text-[#525252] mb-1">
              App Website Link
            </label>
            <div className="text-sm text-[#787672] mb-2">Enter your app url (ex: https://)</div>
            <input
              type="url"
              id="url"
              placeholder="https://"
              value={formData.url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="image" className="block text-sm font-medium text-[#525252] mb-1">
              Upload Screenshot (Optional)
            </label>
            <input
              type="file"
              id="image"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#F4F0ED] file:text-[#525252] hover:file:bg-[#e5e1de]"
              disabled={isSubmitting}
            />
            {formData.image && (
              <div className="text-sm text-[#787672] mt-1">Selected: {formData.image.name}</div>
            )}
          </div>

          <div>
            <label htmlFor="linkedinUrl" className="block text-sm font-medium text-[#525252] mb-1">
              LinkedIn Announcement Post URL (Optional)
            </label>
            <input
              type="url"
              id="linkedinUrl"
              placeholder="https://linkedin.com/post/..."
              value={formData.linkedinUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="twitterUrl" className="block text-sm font-medium text-[#525252] mb-1">
              X (Twitter) or Bluesky Announcement Post URL (Optional)
            </label>
            <input
              type="url"
              id="twitterUrl"
              placeholder="https://twitter.com/..."
              value={formData.twitterUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, twitterUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="githubUrl" className="block text-sm font-medium text-[#525252] mb-1">
              GitHub Repo URL (Optional)
            </label>
            <input
              type="url"
              id="githubUrl"
              placeholder="https://github.com/..."
              value={formData.githubUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, githubUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="chefShowUrl" className="block text-sm font-medium text-[#525252] mb-1">
              Chef.show Project URL (Optional)
            </label>
            <input
              type="url"
              id="chefShowUrl"
              placeholder="https://chef.show/..."
              value={formData.chefShowUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, chefShowUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] border border-[#D5D3D0]"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#525252] mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {availableTags === undefined && (
                <span className="text-sm text-gray-500">Loading tags...</span>
              )}
              {availableTags?.map((tag) => (
                <button
                  key={tag._id}
                  type="button"
                  onClick={() => toggleTag(tag._id)}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    selectedTagIds.includes(tag._id)
                      ? "bg-[#F4F0ED] text-[#2A2825]"
                      : "text-[#787672] hover:text-[#525252] bg-white border border-[#D5D3D0]"
                  }`}>
                  {tag.name}
                </button>
              ))}
            </div>
            {selectedTagIds.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Please select at least one tag.</p>
            )}
          </div>

          <div className="flex gap-4 items-center pt-4 border-t border-[#F4F0ED]">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedTagIds.length ||
                !formData.title ||
                !formData.tagline ||
                !formData.url ||
                !formData.name
              }
              className="px-4 py-2 bg-[#2A2825] text-white rounded-md hover:bg-[#525252] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? "Submitting..." : "Submit App"}
            </button>
            <Link
              to="/"
              className="px-4 py-2 text-[#787672] hover:text-[#525252] rounded-md text-sm">
              Cancel
            </Link>
          </div>

          <div className="text-sm text-[#787672]">
            To maintain quality and prevent spam, you can only submit one project a day.
          </div>

          {submitError && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{submitError}</div>
          )}

          {showSuccessMessage && (
            <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-md text-sm">
              Thanks for cooking! Your submission is pending review.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
