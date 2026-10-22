import { useState, useRef } from 'react';
import { uploadImage, getOptimizedUrl } from '../lib/cloudinary';
import type { UploadResult } from '../lib/cloudinary';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ImageUpload({ value, onChange, label = 'Product Image' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error
    setError(null);

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        setPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    setUploading(true);
    const result: UploadResult = await uploadImage(file);
    setUploading(false);

    if (result.success && result.url) {
      onChange(result.url);
      setPreview(result.url);
    } else {
      setError(result.error || 'Upload failed');
      setPreview(value || null);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange('');
    setError(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      
      {!preview ? (
        // Upload area
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors"
        >
          <i className="fas fa-cloud-upload-alt text-4xl text-gray-300 mb-3"></i>
          <p className="text-sm text-gray-400 mb-1">Click to upload image</p>
          <p className="text-xs text-gray-300">JPEG, PNG, WebP, GIF (max 10MB)</p>
        </div>
      ) : (
        // Preview area
        <div className="relative group">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              <i className="fas fa-edit mr-2"></i>
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              <i className="fas fa-trash mr-2"></i>
              Remove
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-indigo-400">
          <i className="fas fa-spinner fa-spin"></i>
          Uploading image...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
