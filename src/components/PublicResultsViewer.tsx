import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import type { FormField } from "../types"; // Import FormField type

// Helper function to format date (same as in FormResults)
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

// Function to safely access nested data (same as in FormResults)
const getFieldValue = (data: any, fieldLabel: string): string => {
  const key = fieldLabel.toLowerCase().replace(/\s+/g, "_");
  const value = data?.[key];
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value?.toString() || "-";
};

export function PublicResultsViewer() {
  const { slug } = useParams<{ slug: string }>();

  // Fetch form details, fields, and submissions using the slug
  const formData = useQuery(api.forms.getFormResultsBySlug, slug ? { slug } : "skip");

  if (formData === undefined) {
    return <div className="p-4 text-center">Loading results...</div>;
  }

  if (formData === null) {
    return <div className="p-4 text-center text-red-600">Results not found or are private.</div>;
  }

  // Extract data for easier access
  const { title, fields = [], submissions = [] } = formData;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-medium text-[#2A2825] mb-4">Results for: {title}</h1>
      <p className="text-sm text-gray-600">Total Submissions: {submissions.length}</p>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {submissions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No submissions received yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {/* Submitted At Column */}
                  <th className="text-left p-3 px-4 text-gray-600 font-medium whitespace-nowrap">
                    Submitted At
                  </th>
                  {/* Dynamic Columns based on Form Fields */}
                  {fields.map((field: FormField) => (
                    <th
                      key={field._id}
                      className="text-left p-3 px-4 text-gray-600 font-medium whitespace-nowrap">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr
                    key={submission._id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    {/* Submitted At Data */}
                    <td className="p-3 px-4 text-gray-500 whitespace-nowrap">
                      {formatDate(submission._creationTime)}
                    </td>
                    {/* Dynamic Data based on Form Fields */}
                    {fields.map((field: FormField) => (
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
