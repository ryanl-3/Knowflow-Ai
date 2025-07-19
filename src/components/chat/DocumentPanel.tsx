"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DocumentPanelProps, Document } from './document-panel/types';
import DocumentUpload from './document-panel/DocumentUpload';
import DocumentList from './document-panel/DocumentList';
import DeleteConfirmDialog from './document-panel/DeleteConfirmDialog';

export default function DocumentPanel({ 
  projectId,
  documents
}: DocumentPanelProps) {
  const router = useRouter();
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (document: Document) => {
    setDeletingDocument(document);
  };

  const confirmDelete = async () => {
    if (!deletingDocument) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/documents/${deletingDocument.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      toast.success('Document deleted successfully');
      setDeletingDocument(null);
      
      // Refresh the page to remove deleted document
      router.refresh();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeletingDocument(null);
  };

  return (
    <div className="h-full flex flex-col bg-muted/30 dark:bg-muted/20">
      <DocumentUpload projectId={projectId} />

      <div className="flex-1 overflow-y-auto p-4 bg-background">
        <DocumentList 
          documents={documents} 
          onDelete={handleDelete}
          projectId={projectId}
        />
      </div>

      <DeleteConfirmDialog
        document={deletingDocument}
        isDeleting={isDeleting}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
      />
    </div>
  );
} 