import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Download, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react';
import type { CustomForm } from '../../types';

// Mock data
const MOCK_FORMS: CustomForm[] = [
  {
    id: '1',
    title: 'Feedback Form',
    slug: 'feedback-form',
    fields: [],
    isPublic: true,
    createdAt: new Date(),
  },
];

export function Forms() {
  const [forms, setForms] = React.useState<CustomForm[]>(MOCK_FORMS);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const toggleVisibility = (formId: string) => {
    setForms(forms.map(form =>
      form.id === formId ? { ...form, isPublic: !form.isPublic } : form
    ));
  };

  const copyFormUrl = async (form: CustomForm) => {
    const url = `${window.location.origin}/${form.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(form.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportFormData = (formId: string) => {
    // TODO: Implement CSV export for specific form
    console.log('Exporting data for form:', formId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium text-[#525252]">Forms</h2>
        <Link
          to="/admin/forms/new"
          className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-[4px] hover:bg-[#e5e1de] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Form
        </Link>
      </div>

      <div className="bg-white rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F4F0ED]">
                <th className="text-left p-4 text-[#525252] font-medium">Form</th>
                <th className="text-left p-4 text-[#525252] font-medium">Created</th>
                <th className="text-left p-4 text-[#525252] font-medium">Status</th>
                <th className="text-left p-4 text-[#525252] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(form => (
                <tr key={form.id} className="border-b border-[#F4F0ED]">
                  <td className="p-4">
                    <Link
                      to={`/admin/forms/${form.id}`}
                      className="text-[#525252] hover:text-[#2A2825] font-medium flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      {form.title}
                    </Link>
                  </td>
                  <td className="p-4 text-[#787672]">
                    {form.createdAt.toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      form.isPublic
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {form.isPublic ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyFormUrl(form)}
                        className="text-[#787672] hover:text-[#525252]"
                        title={copiedId === form.id ? "Copied!" : "Copy URL"}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <Link
                        to={`/${form.slug}`}
                        target="_blank"
                        className="text-[#787672] hover:text-[#525252]"
                        title="Visit Form"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => toggleVisibility(form.id)}
                        className="text-[#787672] hover:text-[#525252]"
                        title={form.isPublic ? "Make Private" : "Make Public"}
                      >
                        {form.isPublic ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <Link
                        to={`/admin/forms/${form.id}/results`}
                        className="text-[#787672] hover:text-[#525252]"
                        title="View Results"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => exportFormData(form.id)}
                        className="text-[#787672] hover:text-[#525252]"
                        title="Export CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}