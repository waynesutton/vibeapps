import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Save, Trash2, Eye } from 'lucide-react';
import type { FormField, FormFieldType } from '../../types';

interface FormBuilderProps {
  onSave: (form: { title: string; fields: FormField[] }) => void;
  initialData?: { title: string; fields: FormField[] };
}

export function FormBuilder({ onSave, initialData }: FormBuilderProps) {
  const navigate = useNavigate();
  const [title, setTitle] = React.useState(initialData?.title || '');
  const [fields, setFields] = React.useState<FormField[]>(initialData?.fields || []);
  const [previewMode, setPreviewMode] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedFormId, setSavedFormId] = React.useState<string | null>(null);

  const addField = (type: FormFieldType) => {
    const newField: FormField = {
      id: Date.now().toString(),
      type,
      label: '',
      required: false,
      options: type === 'dropdown' || type === 'multiSelect' ? [''] : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(field => field.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const formId = Date.now().toString();
      setSavedFormId(formId);
      
      // In a real app, this would be an API call
      onSave({ title, fields });
      
      // Navigate to the form results page
      navigate(`/admin/forms/${formId}/results`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderFieldEditor = (field: FormField) => (
    <div key={field.id} className="border border-[#D5D3D0] rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-start">
        <input
          type="text"
          value={field.label}
          onChange={(e) => updateField(field.id, { label: e.target.value })}
          placeholder="Field Label"
          className="flex-1 px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
        />
        <button
          onClick={() => removeField(field.id)}
          className="ml-2 text-[#787672] hover:text-[#525252]"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {(field.type === 'dropdown' || field.type === 'multiSelect') && (
        <div className="space-y-2">
          {field.options?.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...(field.options || [])];
                  newOptions[index] = e.target.value;
                  updateField(field.id, { options: newOptions });
                }}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
              />
              <button
                onClick={() => {
                  const newOptions = field.options?.filter((_, i) => i !== index);
                  updateField(field.id, { options: newOptions });
                }}
                className="text-[#787672] hover:text-[#525252]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const newOptions = [...(field.options || []), ''];
              updateField(field.id, { options: newOptions });
            }}
            className="text-sm text-[#787672] hover:text-[#525252]"
          >
            + Add Option
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => updateField(field.id, { required: e.target.checked })}
            className="rounded border-[#D5D3D0] text-[#2A2825] focus:ring-[#2A2825]"
          />
          <span className="text-sm text-[#525252]">Required</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin" className="text-[#787672] hover:text-[#525252]">
          ← Back to Admin Dashboard
        </Link>
        {savedFormId && (
          <Link
            to={`/admin/forms/${savedFormId}/results`}
            className="text-[#787672] hover:text-[#525252]"
          >
            View Results
          </Link>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium text-[#525252]">Form Builder</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-[4px] hover:bg-[#e5e1de] transition-colors flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-[4px] hover:bg-[#e5e1de] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Form'}
          </button>
        </div>
      </div>

      {!previewMode ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#525252] mb-1">
              Form Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter form title"
              className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
              required
            />
          </div>

          <div className="space-y-4">
            {fields.map(field => renderFieldEditor(field))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addField('shortText')}
              className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Short Text
            </button>
            <button
              type="button"
              onClick={() => addField('longText')}
              className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Long Text
            </button>
            <button
              type="button"
              onClick={() => addField('url')}
              className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              URL
            </button>
            <button
              type="button"
              onClick={() => addField('email')}
              className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => addField('yesNo')}
              className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Yes/No
            </button>
            <button
              type="button"
              onClick={() => addField('dropdown')}
              className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Dropdown
            </button>
            <button
              type="button"
              onClick={() => addField('multiSelect')}
              className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Multi-Select
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-lg p-6 border border-[#D5D3D0]">
          <h1 className="text-2xl font-bold text-[#2A2825] mb-6">{title}</h1>
          <form className="space-y-6">
            {fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-[#525252] mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'shortText' && (
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
                    required={field.required}
                  />
                )}
                {field.type === 'longText' && (
                  <textarea
                    className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] min-h-[100px]"
                    required={field.required}
                  />
                )}
                {field.type === 'url' && (
                  <input
                    type="url"
                    className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
                    required={field.required}
                  />
                )}
                {field.type === 'email' && (
                  <input
                    type="email"
                    className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
                    required={field.required}
                  />
                )}
                {field.type === 'yesNo' && (
                  <div className="space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name={`field_${field.id}`}
                        value="yes"
                        className="text-[#2A2825] focus:ring-[#2A2825]"
                        required={field.required}
                      />
                      <span className="ml-2">Yes</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name={`field_${field.id}`}
                        value="no"
                        className="text-[#2A2825] focus:ring-[#2A2825]"
                        required={field.required}
                      />
                      <span className="ml-2">No</span>
                    </label>
                  </div>
                )}
                {field.type === 'dropdown' && (
                  <select
                    className="w-full px-3 py-2 bg-white border border-[#D5D3D0] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
                    required={field.required}
                  >
                    <option value="">Select an option</option>
                    {field.options?.map((option, index) => (
                      <option key={index} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === 'multiSelect' && (
                  <div className="space-y-2">
                    {field.options?.map((option, index) => (
                      <label key={index} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          value={option}
                          className="rounded border-[#D5D3D0] text-[#2A2825] focus:ring-[#2A2825]"
                        />
                        <span className="text-[#525252]">{option}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </form>
        </div>
      )}
    </div>
  );
}