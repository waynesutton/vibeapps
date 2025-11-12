import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { X, Lock, Eye, BarChart2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";

interface CreateJudgingGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateJudgingGroupModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateJudgingGroupModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: true,
    password: "",
    resultsIsPublic: false,
    resultsPassword: "",
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const createGroup = useMutation(api.judgingGroups.createGroup);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      isPublic: true,
      password: "",
      resultsIsPublic: false,
      resultsPassword: "",
      isActive: true,
    });
    setError("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Validation
    if (!formData.name.trim()) {
      setError("Group name is required");
      setIsSubmitting(false);
      return;
    }

    if (!formData.isPublic && !formData.password.trim()) {
      setError("Password is required for private groups");
      setIsSubmitting(false);
      return;
    }

    if (!formData.resultsIsPublic && !formData.resultsPassword.trim()) {
      setError("Password is required for private results pages");
      setIsSubmitting(false);
      return;
    }

    try {
      await createGroup({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isPublic: formData.isPublic,
        password: !formData.isPublic ? formData.password.trim() : undefined,
        resultsIsPublic: formData.resultsIsPublic,
        resultsPassword: !formData.resultsIsPublic
          ? formData.resultsPassword.trim()
          : undefined,
        isActive: formData.isActive,
      });

      // Success
      resetForm();
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating group:", error);
      setError("Failed to create group. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#F2F4F7] rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-medium text-gray-900">
            Create New Judging Group
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Basic Information
            </h3>

            <div>
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Best App Contest 2024"
                required
                disabled={isSubmitting}
              />
              <p className="mt-1 text-sm text-gray-500">
                This will be displayed to judges and used in the URL
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Provide context about this judging group..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Access Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Access Settings
            </h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPublic"
                  checked={formData.isPublic}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      isPublic: !!checked,
                      password: !!checked ? "" : prev.password,
                    }))
                  }
                  disabled={isSubmitting}
                />
                <Label htmlFor="isPublic" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Public Access
                </Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                {formData.isPublic
                  ? "Anyone with the link can access this judging group"
                  : "Requires a password to access this judging group"}
              </p>
            </div>

            {!formData.isPublic && (
              <div>
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password *
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  placeholder="Enter a secure password"
                  required={!formData.isPublic}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          {/* Results Page Visibility */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              Results Page Visibility
            </h3>
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resultsIsPublic"
                  checked={formData.resultsIsPublic}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      resultsIsPublic: !!checked,
                      resultsPassword: !!checked ? "" : prev.resultsPassword,
                    }))
                  }
                  disabled={isSubmitting}
                />
                <Label
                  htmlFor="resultsIsPublic"
                  className="flex items-center gap-2"
                >
                  <BarChart2 className="w-4 h-4" />
                  Public Results
                </Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                {formData.resultsIsPublic
                  ? "Anyone with the link can view the judging results"
                  : "Requires a password to view the judging results"}
              </p>
            </div>

            {!formData.resultsIsPublic && (
              <div>
                <Label
                  htmlFor="resultsPassword"
                  className="flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Results Password *
                </Label>
                <Input
                  id="resultsPassword"
                  type="password"
                  value={formData.resultsPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      resultsPassword: e.target.value,
                    }))
                  }
                  placeholder="Enter password for results access"
                  required={!formData.resultsIsPublic}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          {/* Status Toggle */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Group Status
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))
                }
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                  formData.isActive
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                {formData.isActive ? (
                  <ToggleRight className="w-5 h-5" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
                {formData.isActive ? "Active" : "Inactive"}
              </button>
              <span className="text-sm text-gray-500">
                {formData.isActive
                  ? "Judges can immediately start scoring submissions"
                  : "Group will be created but judges cannot access it yet"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="bg-[#292929] hover:bg-[#525252]"
            >
              {isSubmitting ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
