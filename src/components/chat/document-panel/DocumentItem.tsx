"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Trash2, AlertCircle, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { Document } from './types';
import { formatFileSize, formatDate, truncateFileName } from './utils';
import PDFPreview from './PDFPreview';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

interface DocumentItemProps {
  document: Document;
  onDelete: (document: Document) => void;
  projectId: string;
}

export default function DocumentItem({ document, onDelete, projectId }: DocumentItemProps) {
  const { t } = useTranslation();
  const [isVectorizing, setIsVectorizing] = useState(false);
  const router = useRouter();

  const handlePreviewOpen = async () => {
    // This is handled by PDFPreview component
  };

  const handleVectorize = async () => {
    setIsVectorizing(true);
    try {
      const response = await fetch(`/api/documents/${document.id}/vectorize`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Vectorization failed:', error);
        // You could add toast notification here
      }
      
      // Refresh the page/component to show updated status
      router.refresh();
    } catch (error) {
      console.error('Error vectorizing document:', error);
    } finally {
      setIsVectorizing(false);
    }
  };

  const renderVectorizeButton = () => {
    if (document.status === 'VECTORIZED') {
      return (
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          <span className="text-xs">{t('documents.ready')}</span>
        </div>
      );
    }

    if (document.status === 'PROCESSING' || isVectorizing) {
      return (
        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-xs">{t('documents.processing')}</span>
        </div>
      );
    }

    // 支持两种大小写格式
    if (document.status === 'UPLOADED' || document.status === 'uploaded') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-8 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50"
          onClick={handleVectorize}
          disabled={isVectorizing}
        >
          <Zap className="w-3 h-3 mr-1" />
          {t('documents.vectorize')}
        </Button>
      );
    }

    return null;
  };

  return (
    <Card className="border border-border hover:shadow-sm transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-medium text-foreground" title={document.name}>
                {truncateFileName(document.name, 35)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(document.size)} • {formatDate(document.createdAt)}
              </p>
              <div className="flex items-center justify-between mt-1">
                <div>
                  {document.status && 
                   document.status !== 'UPLOADED' && 
                   document.status !== 'uploaded' && 
                   document.status !== 'VECTORIZED' && (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-orange-500 dark:text-orange-400" />
                      <span className="text-xs text-orange-600 dark:text-orange-400">{document.status}</span>
                    </div>
                  )}
                </div>
                {renderVectorizeButton()}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <PDFPreview document={document} onPreviewOpen={handlePreviewOpen} projectId={projectId} />
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
              onClick={() => onDelete(document)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
} 