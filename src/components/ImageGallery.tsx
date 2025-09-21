import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageGalleryProps {
  mainImageUrl: string | null;
  additionalImageUrls: string[];
  altText: string;
}

export function ImageGallery({
  mainImageUrl,
  additionalImageUrls,
  altText,
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Combine all images into one array
  const allImages = [
    ...(mainImageUrl ? [mainImageUrl] : []),
    ...additionalImageUrls,
  ].filter(Boolean);

  // Reset current index when images change
  useEffect(() => {
    setCurrentIndex(0);
  }, [mainImageUrl, additionalImageUrls]);

  // Don't render anything if no images
  if (allImages.length === 0) {
    return null;
  }

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
  };

  const handleMainImageClick = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          handleModalClose();
          break;
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  // Focus trap for modal
  useEffect(() => {
    if (!isModalOpen) return;

    const modal = document.getElementById("image-modal");
    if (modal) {
      modal.focus();
    }
  }, [isModalOpen]);

  const currentImage = allImages[currentIndex];

  return (
    <>
      {/* Main Image Display */}
      <div className="mb-4">
        <img
          src={currentImage}
          alt={altText}
          className="w-full h-auto max-h-[500px] object-contain rounded-lg border border-[#D8E1EC] cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handleMainImageClick}
          loading="lazy"
        />
      </div>

      {/* Thumbnail Strip - Only show if there are multiple images */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {allImages.map((imageUrl, index) => (
            <button
              key={index}
              onClick={() => handleThumbnailClick(index)}
              className={`flex-shrink-0 w-20 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                index === currentIndex
                  ? "border-[#292929]"
                  : "border-[#D8E1EC] hover:border-[#A8A29E]"
              }`}
              aria-label={`View ${altText} image ${index + 1}`}
            >
              <img
                src={imageUrl}
                alt={`${altText} thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={handleModalClose}
        >
          <div
            className="relative max-w-4xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleModalClose}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
              aria-label="Close image viewer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation Buttons */}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Main Image in Modal */}
            <img
              src={currentImage}
              alt={altText}
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {/* Image Counter */}
            {allImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {allImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
