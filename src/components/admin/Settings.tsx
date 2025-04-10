import React from 'react';
import { Save } from 'lucide-react';

export function Settings() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [settings, setSettings] = React.useState({
    viewMode: 'grid',
    submissionsPerPage: 20,
    allowAnonymousSubmissions: true,
    allowAnonymousComments: true
  });

  const handleChange = (field: string, value: string | number | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Save settings to backend
      console.log('Saving settings:', settings);
      
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium text-[#525252]">Site Settings</h2>
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
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#525252] mb-1">
              Default View Mode
            </label>
            <select
              value={settings.viewMode}
              onChange={(e) => handleChange('viewMode', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#525252] mb-1">
              Submissions Per Page
            </label>
            <input
              type="number"
              value={settings.submissionsPerPage}
              onChange={(e) => handleChange('submissionsPerPage', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.allowAnonymousSubmissions}
                onChange={(e) => handleChange('allowAnonymousSubmissions', e.target.checked)}
                className="rounded border-[#D5D3D0] text-[#2A2825] focus:ring-[#2A2825]"
              />
              <span className="text-sm text-[#525252]">Allow anonymous submissions</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.allowAnonymousComments}
                onChange={(e) => handleChange('allowAnonymousComments', e.target.checked)}
                className="rounded border-[#D5D3D0] text-[#2A2825] focus:ring-[#2A2825]"
              />
              <span className="text-sm text-[#525252]">Allow anonymous comments</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}