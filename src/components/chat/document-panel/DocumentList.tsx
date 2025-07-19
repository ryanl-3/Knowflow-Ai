"use client";

import React from 'react';
import { FileText } from 'lucide-react';
import { Document } from './types';
import DocumentItem from './DocumentItem';
import { useTranslation } from '@/lib/i18n';

interface DocumentListProps {
  documents: Document[];
  onDelete: (document: Document) => void;
  projectId: string;
}

export default function DocumentList({ documents, onDelete, projectId }: DocumentListProps) {
  const { t } = useTranslation();
  
  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground mb-4">
          <FileText className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-foreground text-sm">
          {t('documents.noDocumentsYet')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <DocumentItem 
          key={doc.id} 
          document={doc} 
          onDelete={onDelete}
          projectId={projectId}
        />
      ))}
    </div>
  );
} 