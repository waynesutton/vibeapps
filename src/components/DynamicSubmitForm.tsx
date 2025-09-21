import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
// import { Textarea } from "./ui/textarea"; // Unused for now
import { CheckCircle, AlertCircle } from "lucide-react";
import { Doc } from "../../convex/_generated/dataModel";

type FormField = Doc<"storyFormFields">;

interface FormData {
  [key: string]: string;
}

export function DynamicSubmitForm() {
  const { slug } = useParams<{ slug: string }>();
  const form = useQuery(api.submitForms.getPublicSubmitForm, {
    slug: slug || "",
  });
  const submitFormData = useMutation(api.stories.submitDynamic);
  // const generateUploadUrl = useMutation(api.stories.generateUploadUrl); // Unused - file upload removed

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set()); // Unused for now

  // Initialize form data when form loads
  useEffect(() => {
    if (form?.fields) {
      const initialData: FormData = {};
      form.fields.forEach((field) => {
        initialData[field.key] = "";
      });
      setFormData(initialData);
    }
  }, [form]);

  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Invalid Form URL</h1>
          <p className="text-gray-600 mt-2">
            The form URL appears to be invalid.
          </p>
        </div>
      </div>
    );
  }

  if (form === undefined) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (form === null) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Form Not Found</h1>
          <p className="text-gray-600 mt-2">
            The form you're looking for doesn't exist or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  if (!form.isEnabled) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center p-8">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {form.title}
          </h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800 whitespace-pre-line">
              {form.disabledMessage ||
                "This form is no longer accepting applications. Please sign up for updates."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center p-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h1>
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <p className="text-green-800 whitespace-pre-line">
              {form.successMessage || "Thanks for sharing!"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (fieldKey: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
    // Clear error when user starts typing
    if (errors[fieldKey]) {
      setErrors((prev) => ({ ...prev, [fieldKey]: "" }));
    }
  };

  // File upload functionality removed for now - only text/email/url fields supported

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    form.fields?.forEach((field: FormField) => {
      const value = formData[field.key];

      if (field.isRequired && (!value || value === "")) {
        newErrors[field.key] = `${field.label} is required`;
      } else if (value && typeof value === "string") {
        // Validate email format
        if (field.fieldType === "email" && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            newErrors[field.key] = "Please enter a valid email address";
          }
        }

        // Validate URL format
        if (field.fieldType === "url" && value) {
          try {
            new URL(value);
          } catch {
            newErrors[field.key] = "Please enter a valid URL";
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await submitFormData({
        formData,
        customHiddenTag: form.customHiddenTag,
      });

      setSubmitted(true);
    } catch (error: any) {
      setErrors({
        submit: error.message || "Failed to submit form. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.key] || "";
    const error = errors[field.key];
    // const isUploading = uploadingFiles.has(field.key); // Unused - file upload removed

    return (
      <div key={field._id} className="space-y-2">
        <Label
          htmlFor={field.key}
          className="text-sm font-medium text-gray-700"
        >
          {field.label}
          {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {field.description && (
          <p className="text-sm text-gray-600">{field.description}</p>
        )}

        {/* Special handling for longDescription - render as textarea */}
        {field.key === "longDescription" ? (
          <textarea
            id={field.key}
            value={value as string}
            onChange={(e) => handleInputChange(field.key, e.target.value)}
            placeholder={field.placeholder?.replace(/\\n/g, "\n") || ""}
            rows={4}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? "border-red-500" : ""
            }`}
          />
        ) : (
          <Input
            id={field.key}
            type={
              field.fieldType === "email"
                ? "email"
                : field.fieldType === "url"
                  ? "url"
                  : "text"
            }
            value={value as string}
            onChange={(e) => handleInputChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`w-full ${error ? "border-red-500" : ""}`}
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Form Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {form.title}
          </h1>
          {form.headerText && (
            <div className="text-gray-600 whitespace-pre-line mb-6">
              {form.headerText}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white shadow-lg rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {form.fields?.sort((a, b) => a.order - b.order).map(renderField)}

            {/* Screenshot Upload Section */}
            <div className="space-y-2">
              <Label
                htmlFor="screenshot"
                className="text-sm font-medium text-gray-700"
              >
                Upload Screenshot (Optional)
              </Label>
              <input
                type="file"
                id="screenshot"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      setErrors((prev) => ({
                        ...prev,
                        screenshot:
                          "Screenshot file size should not exceed 5MB.",
                      }));
                      e.target.value = "";
                      setFormData((prev) => ({ ...prev, screenshot: "" }));
                    } else {
                      setErrors((prev) => ({ ...prev, screenshot: "" }));
                      setFormData((prev) => ({
                        ...prev,
                        screenshot: file.name,
                      }));
                    }
                  } else {
                    setFormData((prev) => ({ ...prev, screenshot: "" }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              {formData.screenshot && (
                <div className="text-sm text-gray-600">
                  Selected: {formData.screenshot}
                </div>
              )}
              {errors.screenshot && (
                <p className="text-sm text-red-600">{errors.screenshot}</p>
              )}
            </div>

            <div className="pt-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 text-lg font-medium"
              >
                {isSubmitting
                  ? "Submitting..."
                  : form.submitButtonText || "Submit App"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
