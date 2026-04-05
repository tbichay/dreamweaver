"use client";

import { useState, useCallback, useRef } from "react";
import Cropper, { Area } from "react-easy-crop";
import Image from "next/image";

interface Props {
  currentImage?: string | null;
  fallback: React.ReactNode; // Initialen oder Emoji als Fallback
  size?: number; // Pixel, default 80
  onUpload: (file: Blob) => Promise<void>;
  onRemove?: () => Promise<void>;
}

async function getCroppedImage(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = 512; // Output-Größe
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, size, size
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, "image/png", 0.9);
  });
}

export default function AvatarUpload({ currentImage, fallback, size = 80, onUpload, onRemove }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Bild darf maximal 5MB sein.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setShowCropper(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedArea) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImage(imageSrc, croppedArea);
      await onUpload(croppedBlob);
      setShowCropper(false);
      setImageSrc(null);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      alert("Upload fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setShowCropper(false);
    setImageSrc(null);
  };

  return (
    <>
      {/* Avatar Display */}
      <div className="relative group" style={{ width: size, height: size }}>
        <div
          className="w-full h-full rounded-full overflow-hidden cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {currentImage ? (
            <Image
              src={currentImage}
              alt="Avatar"
              width={size}
              height={size}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#3d6b4a] text-[#f5eed6]">
              {fallback}
            </div>
          )}
        </div>

        {/* Camera overlay */}
        <div
          className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        {/* Remove button */}
        {currentImage && onRemove && (
          <button
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Avatar entfernen"
          >
            ✕
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Crop Modal */}
      {showCropper && imageSrc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          {/* Crop Area */}
          <div className="flex-1 relative">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Zoom Slider */}
          <div className="px-8 py-3 bg-[#1a2e1a]">
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[#4a7c59]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#1a2e1a] border-t border-white/10">
            <button
              onClick={handleCancel}
              className="text-white/60 hover:text-white transition-colors text-sm"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={uploading}
              className="btn-primary text-sm px-6 py-2 disabled:opacity-50"
            >
              {uploading ? "Wird hochgeladen..." : "Speichern"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
