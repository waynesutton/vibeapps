import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { X } from "lucide-react";

interface CreateSubmitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateSubmitFormModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSubmitFormModalProps) {
  const createSubmitForm = useMutation(api.submitForms.createSubmitForm);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    customHiddenTag: "",
    headerText: "",
    submitButtonText: "",
    successMessage: "",
    disabledMessage: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      description: "",
      customHiddenTag: "",
      headerText: "",
      submitButtonText: "",
      successMessage: "",
      disabledMessage: "",
    });
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.customHiddenTag.trim()) {
      setError("Custom hidden tag is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createSubmitForm({
        title: formData.title.trim(),
        slug: formData.slug.trim() || undefined,
        description: formData.description.trim() || undefined,
        customHiddenTag: formData.customHiddenTag.trim(),
        headerText: formData.headerText.trim() || undefined,
        submitButtonText: formData.submitButtonText.trim() || undefined,
        successMessage: formData.successMessage.trim() || undefined,
        disabledMessage: formData.disabledMessage.trim() || undefined,
      });

      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create submit form");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-[#F4F2EE] rounded-lg border border-gray-200 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Create New Submit Form
            </h2>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label
                htmlFor="title"
                className="text-sm font-medium text-gray-700"
              >
                Form Title *
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="e.g., AI Startup Applications"
                disabled={isLoading}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                This will be displayed as the main heading of your form
              </p>
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label
                htmlFor="slug"
                className="text-sm font-medium text-gray-700"
              >
                URL Slug
              </Label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">/</span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange("slug", e.target.value)}
                  placeholder="auto-generated from title"
                  disabled={isLoading}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500">
                Leave empty to auto-generate from title. Only letters, numbers,
                and hyphens allowed.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-gray-700"
              >
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Brief description of what this form is for..."
                disabled={isLoading}
                rows={3}
                className="w-full"
              />
            </div>

            {/* Custom Hidden Tag */}
            <div className="space-y-2">
              <Label
                htmlFor="customHiddenTag"
                className="text-sm font-medium text-gray-700"
              >
                Hidden Tag *
              </Label>
              <Input
                id="customHiddenTag"
                value={formData.customHiddenTag}
                onChange={(e) =>
                  handleChange("customHiddenTag", e.target.value)
                }
                placeholder="e.g., ai-startups-2024"
                disabled={isLoading}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                This tag will be automatically added to all submissions (not
                visible to users)
              </p>
            </div>

            {/* Header Text */}
            <div className="space-y-2">
              <Label
                htmlFor="headerText"
                className="text-sm font-medium text-gray-700"
              >
                Header Text
              </Label>
              <Textarea
                id="headerText"
                value={formData.headerText}
                onChange={(e) => handleChange("headerText", e.target.value)}
                placeholder="Custom header text to display above the form..."
                disabled={isLoading}
                rows={2}
                className="w-full"
              />
            </div>

            {/* Submit Button Text */}
            <div className="space-y-2">
              <Label
                htmlFor="submitButtonText"
                className="text-sm font-medium text-gray-700"
              >
                Submit Button Text
              </Label>
              <Input
                id="submitButtonText"
                value={formData.submitButtonText}
                onChange={(e) =>
                  handleChange("submitButtonText", e.target.value)
                }
                placeholder="Submit App"
                disabled={isLoading}
                className="w-full"
              />
            </div>

            {/* Success Message */}
            <div className="space-y-2">
              <Label
                htmlFor="successMessage"
                className="text-sm font-medium text-gray-700"
              >
                Success Message
              </Label>
              <Textarea
                id="successMessage"
                value={formData.successMessage}
                onChange={(e) => handleChange("successMessage", e.target.value)}
                placeholder="Thanks for sharing!"
                disabled={isLoading}
                rows={2}
                className="w-full"
              />
            </div>

            {/* Disabled Message */}
            <div className="space-y-2">
              <Label
                htmlFor="disabledMessage"
                className="text-sm font-medium text-gray-700"
              >
                Disabled Message
              </Label>
              <Textarea
                id="disabledMessage"
                value={formData.disabledMessage}
                onChange={(e) =>
                  handleChange("disabledMessage", e.target.value)
                }
                placeholder="This form is no longer accepting applications. Please sign up for updates."
                disabled={isLoading}
                rows={2}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Message shown when the form is disabled
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  !formData.title.trim() ||
                  !formData.customHiddenTag.trim()
                }
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? "Creating..." : "Create Form"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Dialog>
  );
}
