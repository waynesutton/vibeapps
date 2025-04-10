import React from 'react';
import { Plus, X, Eye, EyeOff, Save } from 'lucide-react';
import { AVAILABLE_TAGS } from '../Layout';
import type { Tag } from '../../types';

export function TagManagement() {
  const [tags, setTags] = React.useState<Tag[]>(AVAILABLE_TAGS);
  const [newTag, setNewTag] = React.useState('');
  const [hasChanges, setHasChanges] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim() && !tags.find(tag => tag.name.toLowerCase() === newTag.trim().toLowerCase())) {
      setTags(prevTags => [...prevTags, { name: newTag.trim(), showInHeader: true }]);
      setNewTag('');
      setHasChanges(true);
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(prevTags => prevTags.filter(tag => tag.name !== tagName));
    setHasChanges(true);
  };

  const toggleHeaderVisibility = (tagName: string) => {
    setTags(prevTags => prevTags.map(tag => 
      tag.name === tagName 
        ? { ...tag, showInHeader: !tag.showInHeader }
        : tag
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update the global tags
      // In a real app, this would be an API call
      console.log('Saving tags:', tags);
      
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium text-[#525252]">Manage Tags</h2>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-[4px] hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
        
        <form onSubmit={handleAddTag} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Enter new tag"
            className="flex-1 px-3 py-2 border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] focus:border-[#2A2825]"
          />
          <button
            type="submit"
            disabled={!newTag.trim()}
            className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-[4px] hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Tag
          </button>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tags.map((tag) => (
            <div
              key={tag.name}
              className="flex items-center justify-between bg-[#F4F0ED] px-3 py-2 rounded-md"
            >
              <span className="text-[#525252]">{tag.name}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleHeaderVisibility(tag.name)}
                  className="text-[#787672] hover:text-[#525252]"
                  title={tag.showInHeader ? "Hide from header" : "Show in header"}
                >
                  {tag.showInHeader ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleRemoveTag(tag.name)}
                  className="text-[#787672] hover:text-[#525252]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm text-[#787672]">
          <p>Click the eye icon to toggle tag visibility in the header. All tags remain available for posts.</p>
        </div>
      </div>
    </div>
  );
}