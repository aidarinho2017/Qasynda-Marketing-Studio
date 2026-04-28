'use client';

import { useRef, useState, useCallback } from 'react';
import { UploadCloud, X } from 'lucide-react';

interface UploadFormProps {
  onFile: (file: File) => void;
  /** Pass the currently selected file to let the parent reset the preview. */
  currentFile?: File | null;
}

export default function UploadForm({ onFile, currentFile }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        setError('Only JPEG, PNG, and WebP images are supported.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File is too large. Maximum size is 10 MB.');
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      onFile(file);
    },
    [onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const clear = () => {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Product photo</label>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-56 object-contain p-4"
          />
          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 shadow-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={[
            'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50',
          ].join(' ')}
        >
          <UploadCloud className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">
            Drag & drop or{' '}
            <span className="text-indigo-600 font-medium">browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · max 10 MB</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
