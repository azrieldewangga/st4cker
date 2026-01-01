import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop as CropType, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";

// Helper to center crop with 1:1 aspect ratio
function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 80,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    );
}

interface ImageCropperProps {
    imageSrc: string;
    onCancel: () => void;
    onApply: (base64: string) => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCancel, onApply }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<CropType>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const initialCrop = centerAspectCrop(width, height, 1);
        setCrop(initialCrop);
        // Set initial completed crop in pixels
        setCompletedCrop({
            unit: 'px',
            x: (initialCrop.x / 100) * width,
            y: (initialCrop.y / 100) * height,
            width: (initialCrop.width / 100) * width,
            height: (initialCrop.height / 100) * height,
        });
    }, []);

    const handleApply = useCallback(() => {
        if (!imgRef.current || !completedCrop) return;

        const image = imgRef.current;
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        // Use a reasonable output size (256x256 for profile pic)
        const outputSize = 256;
        canvas.width = outputSize;
        canvas.height = outputSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(
            image,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            outputSize,
            outputSize
        );

        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        onApply(base64);
    }, [completedCrop, onApply]);

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-muted/50 p-2 rounded-lg border border-border flex items-center justify-center min-h-[300px] bg-black/20">
                <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1}
                    circularCrop
                    className="max-h-[60vh] overflow-hidden"
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Crop preview"
                        onLoad={onImageLoad}
                        style={{ maxHeight: '60vh', maxWidth: '100%', objectFit: 'contain' }}
                    />
                </ReactCrop>
            </div>

            <p className="text-xs text-muted-foreground text-center">
                Drag to adjust the crop area.
            </p>

            <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" onClick={onCancel}>
                    <X size={16} className="mr-2" />
                    Cancel
                </Button>
                <Button onClick={handleApply} disabled={!completedCrop}>
                    <Check size={16} className="mr-2" />
                    Apply
                </Button>
            </div>
        </div>
    );
};

export default ImageCropper;
