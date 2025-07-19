"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { formatFileSize } from './utils';
import { useTranslation } from '@/lib/i18n';

interface DocumentUploadProps {
  projectId: string;
}

export default function DocumentUpload({ projectId }: DocumentUploadProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setUploadStatus('');
    } else {
      setSelectedFile(null);
      setUploadStatus(t('documents.selectFile'));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !session) {
      setUploadStatus(t('documents.selectFile'));
      return;
    }

    setIsUploading(true);
    setUploadStatus(t('documents.requestingUploadURL'));

    try {
      // Step 1: Get presigned URL
      const response = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          projectId: projectId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const { uploadUrl, documentId } = await response.json();
      setUploadStatus(t('documents.uploadingToS3'));

      // Step 2: Upload to S3 
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to S3');
      }

      setUploadStatus(t('documents.confirmingUpload'));

      // Step 3: Confirm upload completion
      const confirmResponse = await fetch('/api/documents/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.error || 'Failed to confirm upload');
      }

      setUploadStatus(t('documents.uploadSuccessful'));
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh the page to show new document
      router.refresh();

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : t('common.unknownError');
      setUploadStatus(t('documents.uploadFailed').replace('{error}', errorMessage));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 border-b border-border">
      <h2 className="text-lg font-semibold text-foreground mb-3">Documents</h2>
      
      <div className="border-2 border-dashed border-border rounded-lg p-4 mb-2">
        <div className="text-center space-y-2">
          <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
          <div>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="mb-2"
            />
            {selectedFile && (
              <p className="text-sm text-foreground">
                {t('documents.selectedFile')
                  .replace('{filename}', selectedFile.name)
                  .replace('{size}', formatFileSize(selectedFile.size))}
              </p>
            )}
          </div>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? t('documents.uploading') : t('documents.uploadPDF')}
          </Button>
          {uploadStatus && (
            <p className={`text-sm ${uploadStatus.includes('failed') || uploadStatus.includes('error') ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
              {uploadStatus}
            </p>
          )}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground">
        {t('documents.onlyPDFSupported')}
      </p>
    </div>
  );
} 