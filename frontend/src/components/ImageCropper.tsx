"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

type AspectPreset = "free" | "1:1" | "4:3" | "16:9" | "3:4" | "9:16";

const ASPECT_MAP: Record<AspectPreset, number | undefined> = {
  free: undefined,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "3:4": 3 / 4,
  "9:16": 9 / 16,
};

const ASPECT_LABELS: Record<AspectPreset, string> = {
  free: "自由",
  "1:1": "1:1",
  "4:3": "4:3",
  "16:9": "16:9",
  "3:4": "3:4",
  "9:16": "9:16",
};

const PRESETS: AspectPreset[] = ["free", "1:1", "4:3", "16:9", "3:4", "9:16"];

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );
  return canvas.toDataURL("image/jpeg", 0.9);
}

interface ImageCropperProps {
  file: File;
  onCrop: (dataUrl: string) => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function ImageCropper({ file, onCrop, onSkip, onClose }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<AspectPreset>("free");
  const croppedAreaPixelsRef = useRef<Area | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    croppedAreaPixelsRef.current = croppedPixels;
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixelsRef.current) {
      onSkip();
      return;
    }
    setIsProcessing(true);
    try {
      const result = await getCroppedImg(imageSrc, croppedAreaPixelsRef.current);
      onCrop(result);
    } catch {
      onSkip();
    } finally {
      setIsProcessing(false);
    }
  }, [imageSrc, onCrop, onSkip]);

  if (!imageSrc) return null;

  return (
    <div className="image-cropper-overlay" onClick={onClose}>
      <div className="image-cropper-panel" onClick={(e) => e.stopPropagation()}>
        <div className="image-cropper-aspect-bar">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={aspect === p ? "image-cropper-aspect-active" : ""}
              onClick={() => setAspect(p)}
            >
              {ASPECT_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="image-cropper-stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT_MAP[aspect]}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="image-cropper-zoom-bar">
          <span className="image-cropper-zoom-label">缩放</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>

        <div className="image-cropper-actions">
          <button type="button" onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? "处理中..." : "裁剪"}
          </button>
          <button type="button" onClick={onSkip}>
            跳过（使用原图）
          </button>
        </div>
      </div>
    </div>
  );
}
