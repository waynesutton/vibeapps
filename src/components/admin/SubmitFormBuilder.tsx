import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { ArrowLeft, Settings, ListChecks, Eye, FileText } from "lucide-react";
import { EditSubmitFormModal } from "./EditSubmitFormModal";
import { SubmitFormFieldManagement } from "./SubmitFormFieldManagement";

interface SubmitFormBuilderProps {
  formId: Id<"submitForms">;
  onBack: () => void;
}

type BuilderTab = "settings" | "fields" | "preview";

export function SubmitFormBuilder({ formId, onBack }: SubmitFormBuilderProps) {
  const formWithFields = useQuery(api.submitForms.getSubmitFormWithFields, {
    formId,
  });

  const [activeTab, setActiveTab] = useState<BuilderTab>("settings");
  const [showEditModal, setShowEditModal] = useState(false);

  if (formWithFields === undefined) {
    return (
      <div className="space-y-6">
        <div className="bg-[#F2F4F7] rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          Loading form builder...
        </div>
      </div>
    );
  }

  if (formWithFields === null) {
    return (
      <div className="space-y-6">
        <div className="bg-[#F2F4F7] rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <p className="text-red-600">Form not found</p>
          <Button onClick={onBack} className="mt-4">
            Back to Forms
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: "settings" as const,
      label: "Form Settings",
      icon: Settings,
      description: "Configure form metadata and messages",
    },
    {
      id: "fields" as const,
      label: "Form Fields",
      icon: ListChecks,
      description: "Add and configure form fields",
    },
    {
      id: "preview" as const,
      label: "Preview",
      icon: Eye,
      description: "Preview how the form will look",
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "settings":
        return (
          <div className="bg-[#F2F4F7] rounded-lg border border-gray-200 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Form Settings
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Configure the basic settings, messages, and behavior of your
                  form.
                </p>
              </div>

              {/* Form Info Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Form Title
                  </label>
                  <div className="p-3 bg-gray-50 rounded-md border">
                    {formWithFields.title}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Slug
                  </label>
                  <div className="p-3 bg-gray-50 rounded-md border">
                    /{formWithFields.slug}
                  </div>
                </div>

                {formWithFields.description && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <div className="p-3 bg-gray-50 rounded-md border">
                      {formWithFields.description}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hidden Tag
                  </label>
                  <div className="p-3 bg-gray-50 rounded-md border">
                    {formWithFields.customHiddenTag}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Submit Button Text
                  </label>
                  <div className="p-3 bg-gray-50 rounded-md border">
                    {formWithFields.submitButtonText || "Submit App"}
                  </div>
                </div>

                {formWithFields.headerText && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Header Text
                    </label>
                    <div className="p-3 bg-gray-50 rounded-md border">
                      {formWithFields.headerText}
                    </div>
                  </div>
                )}

                {formWithFields.successMessage && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Success Message
                    </label>
                    <div className="p-3 bg-gray-50 rounded-md border">
                      {formWithFields.successMessage}
                    </div>
                  </div>
                )}

                {formWithFields.disabledMessage && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Disabled Message
                    </label>
                    <div className="p-3 bg-gray-50 rounded-md border">
                      {formWithFields.disabledMessage}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200">
                <Button
                  onClick={() => setShowEditModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Form Settings
                </Button>
              </div>
            </div>
          </div>
        );

      case "fields":
        return (
          <SubmitFormFieldManagement
            formId={formId}
            onBack={() => setActiveTab("settings")}
          />
        );

      case "preview":
        return (
          <div className="bg-[#F2F4F7] rounded-lg border border-gray-200 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Form Preview
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  This is how your form will appear to users.
                </p>
              </div>

              {/* Form Preview */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <div className="max-w-2xl mx-auto">
                  {/* Form Header */}
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                      {formWithFields.title}
                    </h1>
                    {formWithFields.headerText && (
                      <p className="text-gray-600 whitespace-pre-line">
                        {formWithFields.headerText}
                      </p>
                    )}
                  </div>

                  {/* Form Fields Preview */}
                  <div className="space-y-6">
                    {formWithFields.fields?.length > 0 ? (
                      formWithFields.fields
                        .filter((field) => field.isEnabled)
                        .sort((a, b) => a.order - b.order)
                        .map((field) => (
                          <div key={field._id} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {field.label}
                              {field.isRequired && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </label>

                            {field.description && (
                              <p className="text-sm text-gray-500">
                                {field.description}
                              </p>
                            )}

                            {/* Field Preview - render based on field key and type */}
                            {field.key === "longDescription" ? (
                              <textarea
                                placeholder={
                                  field.placeholder?.replace(/\\n/g, "\n") || ""
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                rows={4}
                                disabled
                              />
                            ) : (
                              <input
                                type={
                                  field.fieldType === "email"
                                    ? "email"
                                    : field.fieldType === "url"
                                      ? "url"
                                      : "text"
                                }
                                placeholder={field.placeholder || ""}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                disabled
                              />
                            )}
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Loading form fields...</p>
                      </div>
                    )}

                    {/* Screenshot Upload Preview */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Upload Screenshot (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700"
                        disabled
                      />
                    </div>

                    {/* Submit Button Preview */}
                    <div className="pt-6">
                      <button
                        type="button"
                        className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg font-medium bg-gray-50 cursor-not-allowed"
                        disabled
                      >
                        {formWithFields.submitButtonText || "Submit App"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Actions */}
              <div className="flex items-center justify-center gap-4 pt-4">
                <Button
                  onClick={() =>
                    window.open(`/submit/${formWithFields.slug}`, "_blank")
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Live Form
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={onBack}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {formWithFields.title}
            </h2>
            <p className="text-sm text-gray-600">
              /{formWithFields.slug}
              {formWithFields.isBuiltIn && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                  Built-in
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Edit Modal */}
      <EditSubmitFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => setShowEditModal(false)}
        form={formWithFields}
      />
    </div>
  );
}
