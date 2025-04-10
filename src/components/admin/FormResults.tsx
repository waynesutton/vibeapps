import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, ArrowLeft, Copy, ExternalLink, Eye, EyeOff, FileText, ChevronRight } from 'lucide-react';

interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  createdAt: Date;
}

interface FormResultsGroup {
  formId: string;
  formTitle: string;
  slug: string;
  isPublic: boolean;
  submissions: FormSubmission[];
}

// Mock data
const MOCK_RESULTS_GROUPS: FormResultsGroup[] = [
  {
    formId: '1',
    formTitle: 'Feedback Form',
    slug: 'feedback-form-results',
    isPublic: true,
    submissions: [
      {
        id: '1',
        formId: '1',
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          feedback: 'Great service!',
        },
        createdAt: new Date(),
      },
      {
        id: '2',
        formId: '1',
        data: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          feedback: 'Could be better.',
        },
        createdAt: new Date(Date.now() - 3600000),
      },
    ],
  },
];

export function FormResults() {
  const { id } = useParams<{ id: string }>();
  const [resultsGroups, setResultsGroups] = React.useState<FormResultsGroup[]>(MOCK_RESULTS_GROUPS);
  const [sortField, setSortField] = React.useState<string>('createdAt');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleVisibility = (formId: string) => {
    setResultsGroups(groups => groups.map(group =>
      group.formId === formId ? { ...group, isPublic: !group.isPublic } : group
    ));
  };

  const copyResultsUrl = async (group: FormResultsGroup) => {
    const url = `${window.location.origin}/results/${group.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(group.formId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportCSV = (formId: string) => {
    const group = resultsGroups.find(g => g.formId === formId);
    if (!group) return;

    // TODO: Implement CSV export for specific form
    console.log('Exporting CSV for form:', formId);
  };

  const selectedGroup = id ? resultsGroups.find(group => group.formId === id) : null;

  const renderBreadcrumbs = () => (
    <div className="flex items-center gap-2 text-[#787672] mb-6">
      <Link to="/admin" className="hover:text-[#525252]">Admin Dashboard</Link>
      <ChevronRight className="w-4 h-4" />
      <Link to="/admin" className="hover:text-[#525252]">Results</Link>
      {selectedGroup && (
        <>
          <ChevronRight className="w-4 h-4" />
          <span className="text-[#525252]">{selectedGroup.formTitle}</span>
        </>
      )}
    </div>
  );

  if (id && selectedGroup) {
    const sortedSubmissions = [...selectedGroup.submissions].sort((a, b) => {
      const aValue = sortField === 'createdAt' ? a.createdAt : a.data[sortField];
      const bValue = sortField === 'createdAt' ? b.createdAt : b.data[sortField];
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return (
      <div className="space-y-6">
        {renderBreadcrumbs()}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-[#787672] hover:text-[#525252] flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back to Admin Dashboard
            </Link>
          </div>
          <button
            onClick={() => exportCSV(selectedGroup.formId)}
            className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-[4px] hover:bg-[#e5e1de] transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="bg-white rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-medium text-[#525252]">
              {selectedGroup.formTitle} - Results
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyResultsUrl(selectedGroup)}
                className="text-[#787672] hover:text-[#525252]"
                title={copiedId === selectedGroup.formId ? "Copied!" : "Copy Results URL"}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleVisibility(selectedGroup.formId)}
                className="text-[#787672] hover:text-[#525252]"
                title={selectedGroup.isPublic ? "Make Private" : "Make Public"}
              >
                {selectedGroup.isPublic ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F4F0ED]">
                  {Object.keys(selectedGroup.submissions[0]?.data || {}).map(field => (
                    <th
                      key={field}
                      className="text-left p-4 text-[#525252] font-medium cursor-pointer hover:text-[#2A2825]"
                      onClick={() => handleSort(field)}
                    >
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                      {sortField === field && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                  <th
                    className="text-left p-4 text-[#525252] font-medium cursor-pointer hover:text-[#2A2825]"
                    onClick={() => handleSort('createdAt')}
                  >
                    Submitted
                    {sortField === 'createdAt' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSubmissions.map(submission => (
                  <tr key={submission.id} className="border-b border-[#F4F0ED]">
                    {Object.values(submission.data).map((value, index) => (
                      <td key={index} className="p-4 text-[#525252]">
                        {value}
                      </td>
                    ))}
                    <td className="p-4 text-[#787672]">
                      {submission.createdAt.toLocaleDateString()}
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

  return (
    <div className="space-y-6">
      {renderBreadcrumbs()}
      <h2 className="text-xl font-medium text-[#525252] mb-6">Form Results</h2>
      
      <div className="grid gap-6">
        {resultsGroups.map(group => (
          <div key={group.formId} className="bg-white rounded-lg p-6 border border-[#D5D3D0]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-[#525252]">{group.formTitle}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyResultsUrl(group)}
                  className="text-[#787672] hover:text-[#525252]"
                  title={copiedId === group.formId ? "Copied!" : "Copy Results URL"}
                >
                  <Copy className="w-4 h-4" />
                </button>
                <Link
                  to={`/results/${group.slug}`}
                  target="_blank"
                  className="text-[#787672] hover:text-[#525252]"
                  title="View Results"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => toggleVisibility(group.formId)}
                  className="text-[#787672] hover:text-[#525252]"
                  title={group.isPublic ? "Make Private" : "Make Public"}
                >
                  {group.isPublic ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                <Link
                  to={`/admin/forms/${group.formId}/results`}
                  className="text-[#787672] hover:text-[#525252]"
                  title="View Details"
                >
                  <FileText className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => exportCSV(group.formId)}
                  className="text-[#787672] hover:text-[#525252]"
                  title="Export CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-[#787672]">
              {group.submissions.length} submissions
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}