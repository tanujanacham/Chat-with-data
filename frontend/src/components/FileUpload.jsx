import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle } from 'lucide-react';
import axios from 'axios';

export default function FileUpload({ onUploadSuccess }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress for premium feel
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        onUploadSuccess({
          csvData: response.data.data,
          schema: response.data.schema,
          sessionId: response.data.sessionId,
        });
        setIsUploading(false);
      }, 800);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
      setIsUploading(false);
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        {...getRootProps()}
        className={`relative overflow-hidden rounded-3xl p-10 transition-all duration-500 ease-out cursor-pointer flex flex-col items-center justify-center text-center group
          ${isDragActive
            ? 'border-2 border-indigo-500 bg-indigo-50/50 scale-[1.02] shadow-xl shadow-indigo-100'
            : 'border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80 bg-white/50 backdrop-blur-sm shadow-sm'
          }
          ${isUploading ? 'pointer-events-none opacity-90 scale-[0.98]' : ''}
        `}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="flex flex-col items-center space-y-6 w-full">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20 transform scale-150"></div>
              <div className="w-20 h-20 border-[3px] border-slate-100 rounded-full"></div>
              <div
                className="absolute top-0 left-0 w-20 h-20 border-[3px] border-indigo-600 rounded-full border-t-transparent animate-[spin_1s_cubic-bezier(0.55,0.085,0.68,0.53)_infinite]"
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-8 h-8 text-indigo-600 animate-pulse" />
              </div>
            </div>
            <div className="space-y-3 w-full max-w-[200px]">
              <p className="text-sm font-semibold text-slate-700 animate-pulse">Initializing data engine...</p>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden self-center mx-auto">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`p-5 rounded-2xl mb-5 transition-all duration-500 
              ${isDragActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110 rotate-3'
                : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100 group-hover:-translate-y-1'
              }`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">
              {isDragActive ? 'Drop dataset here' : 'Upload your dataset'}
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-[250px] leading-relaxed">
              Drag & drop a CSV file to begin analysis, or click to browse
            </p>
            <div className="flex items-center justify-center space-x-2 text-xs font-medium text-slate-500 bg-slate-100/80 px-4 py-2 rounded-full border border-slate-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>Supports .csv up to 50MB</span>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50/80 backdrop-blur-md border border-red-100 rounded-2xl text-sm text-red-600 flex items-start shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <svg className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="leading-relaxed font-medium">{error}</span>
        </div>
      )}
    </div>
  );
}
