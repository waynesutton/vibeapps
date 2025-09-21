import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Save } from "lucide-react";

interface SubmitFormFieldManagementProps {
  formId: Id<"submitForms">;
  onBack: () => void;
}

interface SortableFieldItemProps {
  field: Doc<"storyFormFields">;
  isSelected: boolean;
  onToggle: (fieldId: Id<"storyFormFields">) => void;
}

function SortableFieldItem({
  field,
  isSelected,
  onToggle,
}: SortableFieldItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: field._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-3 bg-white border-b"
    >
      <div {...listeners} {...attributes} className="cursor-grab p-2">
        <GripVertical className="w-5 h-5 text-gray-400" />
      </div>
      <Checkbox
        id={field._id}
        checked={isSelected}
        onCheckedChange={() => onToggle(field._id)}
      />
      <div className="flex-1">
        <label htmlFor={field._id} className="font-medium text-gray-800">
          {field.label}
        </label>
        <p className="text-sm text-gray-500">{field.description}</p>
        <code className="text-xs text-gray-400">{field.key}</code>
      </div>
    </div>
  );
}

export function SubmitFormFieldManagement({
  formId,
}: SubmitFormFieldManagementProps) {
  const allGlobalFields = useQuery(api.storyFormFields.listAdmin);
  const formWithFields = useQuery(api.submitForms.getSubmitFormWithFields, {
    formId,
  });
  const updateFieldsMutation = useMutation(
    api.submitForms.updateSubmitFormFields,
  );

  const [selectedFieldIds, setSelectedFieldIds] = useState<
    Set<Id<"storyFormFields">>
  >(new Set());
  const [orderedFields, setOrderedFields] = useState<Doc<"storyFormFields">[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (formWithFields && allGlobalFields) {
      const selectedIds = new Set(formWithFields.fields.map((f) => f._id));
      setSelectedFieldIds(selectedIds);

      const currentSelectedFields = formWithFields.fields;
      const unselectedFields = allGlobalFields.filter(
        (gf) => !selectedIds.has(gf._id),
      );

      setOrderedFields([...currentSelectedFields, ...unselectedFields]);
    }
  }, [formWithFields, allGlobalFields]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleToggleField = (fieldId: Id<"storyFormFields">) => {
    setSelectedFieldIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setOrderedFields((items) => {
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Filter out core fields (they have string IDs starting with "core-")
      // and only include real database field IDs
      const finalOrderedSelectedIds = orderedFields
        .filter((f) => selectedFieldIds.has(f._id))
        .filter((f) => typeof f._id === "string" && !f._id.startsWith("core-")) // Only real field IDs
        .map((f) => f._id as Id<"storyFormFields">); // Type assertion since we filtered out string IDs

      await updateFieldsMutation({
        formId,
        fieldIds: finalOrderedSelectedIds,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save fields");
    } finally {
      setIsLoading(false);
    }
  };

  if (!allGlobalFields || !formWithFields) {
    return <div>Loading fields...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Info section about core fields */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          Core Fields Included Automatically
        </h4>
        <p className="text-sm text-blue-700">
          Every submit form automatically includes these core fields: App Title,
          App/Project Tagline, Description, App Website Link, Video Demo, Your
          Name, Email, and Upload Screenshot.
        </p>
        <p className="text-sm text-blue-700 mt-1">
          Select additional fields below to add to this form.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedFields.map((f) => f._id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="bg-[#F2F4F7] rounded-lg border border-gray-200">
            <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-lg">
              <h4 className="text-sm font-medium text-gray-700">
                Additional Fields
              </h4>
              <p className="text-xs text-gray-600">
                Drag to reorder, toggle to enable/disable
              </p>
            </div>
            {orderedFields.map((field) => (
              <SortableFieldItem
                key={field._id}
                field={field}
                isSelected={selectedFieldIds.has(field._id)}
                onToggle={handleToggleField}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Saving..." : "Save Field Configuration"}
        </Button>
      </div>
    </div>
  );
}
