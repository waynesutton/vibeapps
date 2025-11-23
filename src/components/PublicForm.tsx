import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CustomForm, FormField } from "../types";

interface PublicFormProps {
  form: CustomForm;
  fields: FormField[];
}

export function PublicForm({ form, fields }: PublicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const submitFormMutation = useMutation(api.forms.submitForm);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checkbox = e.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checkbox.checked,
      }));
    } else if ("multiple" in e.target && e.target.multiple) {
      // Handle multi-select
      const select = e.target as HTMLSelectElement;
      const selectedOptions = Array.from(select.selectedOptions).map(
        (option) => option.value,
      );
      setFormData((prev) => ({
        ...prev,
        [name]: selectedOptions,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      await submitFormMutation({ slug: form.slug, data: formData });
      setSubmitStatus("success");
      setFormData({}); // Clear form on success
    } catch (error) {
      console.error("Failed to submit form:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const commonProps = {
      id: field._id,
      name: field.label.toLowerCase().replace(/\s+/g, "_"), // Generate name from label
      onChange: handleChange,
      required: field.required,
      className:
        "w-full px-3 py-2 bg-white rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] border border-[#D8E1EC]",
      disabled: isSubmitting,
      value: formData[field.label.toLowerCase().replace(/\s+/g, "_")] || "",
    };

    switch (field.fieldType) {
      case "shortText":
      case "url":
      case "email":
        return (
          <input
            type={
              field.fieldType === "email"
                ? "email"
                : field.fieldType === "url"
                  ? "url"
                  : "text"
            }
            {...commonProps}
            placeholder={field.placeholder}
          />
        );
      case "longText":
        return (
          <textarea {...commonProps} placeholder={field.placeholder} rows={4} />
        );
      case "yesNo":
        return (
          <select
            {...commonProps}
            value={
              formData[field.label.toLowerCase().replace(/\s+/g, "_")] || ""
            }
          >
            <option value="" disabled>
              {field.placeholder || "Select..."}
            </option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        );
      case "dropdown":
        return (
          <select
            {...commonProps}
            value={
              formData[field.label.toLowerCase().replace(/\s+/g, "_")] || ""
            }
          >
            <option value="" disabled>
              {field.placeholder || "Select..."}
            </option>
            {(field.options || []).map((opt: string) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "multiSelect":
        return (
          <select
            {...commonProps}
            multiple
            value={
              formData[field.label.toLowerCase().replace(/\s+/g, "_")] || []
            }
            size={Math.min(5, (field.options || []).length)} // Show scroll after 5 options
          >
            {/* No placeholder for multi-select */}
            {(field.options || []).map((opt: string) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg border border-[#D8E1EC]">
      <h1 className="text-xl font-medium text-[#292929] mb-6">{form.title}</h1>
      {submitStatus === "success" ? (
        <div className="p-4 bg-green-100 text-green-800 rounded-md">
          Form submitted successfully! Thank you.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {fields.map((field) => (
            <div key={field._id}>
              <label
                htmlFor={field._id}
                className="block text-sm font-medium text-[#525252] mb-1"
              >
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              {renderField(field)}
            </div>
          ))}

          {submitStatus === "error" && (
            <div className="p-4 bg-red-100 text-red-800 rounded-md">
              Failed to submit form. Please try again.
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-[#525252] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
