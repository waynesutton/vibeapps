import React, { useState, useEffect, ChangeEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner"; // Assuming you use sonner for toasts

export function ConvexBoxSettingsForm() {
  const currentSettings = useQuery(api.convexBoxConfig.get);
  const updateSettings = useMutation(api.convexBoxConfig.update);
  const generateUploadUrl = useMutation(api.convexBoxConfig.generateUploadUrl);

  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [displayText, setDisplayText] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (currentSettings) {
      setIsEnabled(currentSettings.isEnabled);
      setDisplayText(currentSettings.displayText);
      setLinkUrl(currentSettings.linkUrl);
      setCurrentLogoUrl(currentSettings.logoUrl);
    }
  }, [currentSettings]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    let logoStorageId: Id<"_storage"> | undefined | null = currentSettings?.logoStorageId;

    try {
      if (selectedFile) {
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });
        const { storageId } = await result.json();
        logoStorageId = storageId;
        toast.success("Logo uploaded successfully!");
      }

      await updateSettings({
        isEnabled,
        displayText,
        linkUrl,
        logoStorageId: logoStorageId, // Pass the new or existing ID
      });
      toast.success("ConvexBox settings updated!");
      setSelectedFile(null); // Clear file input after successful upload & save
      // The useQuery for currentSettings will re-fetch and update the logo preview via useEffect
    } catch (error) {
      console.error("Failed to update ConvexBox settings:", error);
      toast.error("Failed to update settings. Check console for details.");
    }
    setIsSubmitting(false);
  };

  const handleRemoveLogo = async () => {
    setIsSubmitting(true);
    try {
      await updateSettings({
        logoStorageId: null, // Signal to remove/unset the logo
      });
      toast.success("Logo removed successfully!");
      setCurrentLogoUrl(null);
      setSelectedFile(null);
    } catch (error) {
      console.error("Failed to remove logo:", error);
      toast.error("Failed to remove logo. Check console for details.");
    }
    setIsSubmitting(false);
  };

  if (currentSettings === undefined) {
    return <div>Loading settings...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow border">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Convex Box Configuration</h3>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isEnabled"
          checked={isEnabled}
          onCheckedChange={(checked) => setIsEnabled(Boolean(checked))}
        />
        <Label htmlFor="isEnabled" className="text-sm font-medium text-gray-700">
          Show Convex Box
        </Label>
      </div>

      <div>
        <Label htmlFor="displayText" className="block text-sm font-medium text-gray-700 mb-1">
          Display Text
        </Label>
        <Input
          id="displayText"
          type="text"
          value={displayText}
          onChange={(e) => setDisplayText(e.target.value)}
          className="w-full"
          required
        />
      </div>

      <div>
        <Label htmlFor="linkUrl" className="block text-sm font-medium text-gray-700 mb-1">
          Link URL
        </Label>
        <Input
          id="linkUrl"
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className="w-full"
          placeholder="https://example.com"
          required
        />
      </div>

      <div>
        <Label htmlFor="logoFile" className="block text-sm font-medium text-gray-700 mb-1">
          Upload Logo (Optional)
        </Label>
        <Input
          id="logoFile"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full text-sm"
        />
        {currentLogoUrl && !selectedFile && (
          <div className="mt-2">
            <p className="text-xs text-gray-600 mb-1">Current logo:</p>
            <img src={currentLogoUrl} alt="Current logo" className="max-h-20 border rounded" />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-red-600 px-0"
              onClick={handleRemoveLogo}
              disabled={isSubmitting}>
              Remove logo
            </Button>
          </div>
        )}
        {selectedFile && (
          <p className="text-xs text-gray-600 mt-1">New logo selected: {selectedFile.name}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Recommended: Small, transparent background PNG.
        </p>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 hover:bg-blue-700 text-white">
        {isSubmitting ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
