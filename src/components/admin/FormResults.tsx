import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { CustomForm, FormSubmission, FormField } from "../../types";

// Helper function to format date
const formatDate = (timestamp: number): string => {
  try {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "Invalid Date";
  }
};

// Function to safely access nested data, assuming field labels are keys
const getFieldValue = (data: any, fieldLabel: string): string => {
  // Convert label to the key format used in submission data (e.g., lowercase_with_underscores)
  const key = fieldLabel.toLowerCase().replace(/\s+/g, "_");
  const value = data?.[key];
  if (Array.isArray(value)) return value.join(", "); // Join array values
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value?.toString() || "-"; // Return value or placeholder
};

// Function to generate CSV content
const generateCSV = (fields: FormField[], submissions: FormSubmission[]): string => {
  const headers = ["Submitted At", ...fields.map((f) => f.label)];
  const rows = submissions.map((sub) => {
    const rowData = [
      formatDate(sub._creationTime),
      ...fields.map((field) => `"${getFieldValue(sub.data, field.label).replace(/"/g, '""')}"`), // Escape quotes
    ];
    return rowData.join(",");
  });
  return [headers.join(","), ...rows].join("\n");
};

export function FormResults() {
  const { formId } = useParams<{ formId?: Id<"forms"> }>();

  const formData = useQuery(api.forms.getFormWithFields, formId ? { formId } : "skip");
  const submissions = useQuery(api.forms.listSubmissions, formId ? { formId } : "skip");

  const [sortField, setSortField] = useState<string>("_creationTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (fieldKey: string) => {
    if (sortField === fieldKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(fieldKey);
      setSortDirection("desc"); // Default to descending for new column
    }
  };

  const exportCSV = () => {
    if (!formData || !submissions) return;
    const csvContent = generateCSV(formData.fields, submissions);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${formData.slug}_submissions.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort submissions based on current state
  const sortedSubmissions = React.useMemo(() => {
    if (!submissions) return [];
    return [...submissions].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === "_creationTime") {
        aValue = a._creationTime;
        bValue = b._creationTime;
      } else {
        // sortField is the field label, convert to key
        const fieldKey = sortField.toLowerCase().replace(/\s+/g, "_");
        aValue = a.data?.[fieldKey];
        bValue = b.data?.[fieldKey];
      }

      // Basic comparison, might need refinement for different types
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [submissions, sortField, sortDirection]);

  if (formData === undefined || submissions === undefined) {
    return <div>Loading results...</div>;
  }

  if (!formData) {
    return <div>Form not found.</div>;
  }

  const formFields = formData.fields || []; // Use fields from fetched form data

  return (
    <div className="space-y-6">
      {/* Back Link and Title */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <Link
            to="/admin?tab=forms"
            className="text-sm text-[#787672] hover:text-[#525252] flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Back to Forms List
          </Link>
          <h2 className="text-xl font-medium text-[#525252]">Results for: {formData.title}</h2>
        </div>
        <button
          onClick={exportCSV}
          disabled={!submissions || submissions.length === 0}
          className="px-4 py-2 bg-[#F4F0ED] text-[#525252] rounded-md hover:bg-[#e5e1de] transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <Download className="w-4 h-4" />
          Export CSV ({sortedSubmissions.length} rows)
        </button>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {sortedSubmissions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No submissions received yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {/* Submitted At Column (Sortable) */}
                  <th
                    className="text-left p-3 px-4 text-gray-600 font-medium cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("_creationTime")}>
                    <div className="flex items-center gap-1">
                      Submitted At
                      {sortField === "_creationTime" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  {/* Dynamic Columns based on Form Fields (Sortable) */}
                  {formFields.map((field) => (
                    <th
                      key={field._id}
                      className="text-left p-3 px-4 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                      onClick={() => handleSort(field.label)} // Sort by label
                    >
                      <div className="flex items-center gap-1">
                        {field.label}
                        {sortField === field.label &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSubmissions.map((submission) => (
                  <tr
                    key={submission._id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    {/* Submitted At Data */}
                    <td className="p-3 px-4 text-gray-500 whitespace-nowrap">
                      {formatDate(submission._creationTime)}
                    </td>
                    {/* Dynamic Data based on Form Fields */}
                    {formFields.map((field) => (
                      <td key={field._id} className="p-3 px-4 text-gray-700 align-top">
                        {getFieldValue(submission.data, field.label)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
