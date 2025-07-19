'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, MessageSquare, Clock, Trash2 } from 'lucide-react';
import { deleteProject } from '@/app/actions/projects';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    lastUsedAt: Date;
    usageCount: number;
    _count: {
      documents: number;
      messages: number;
    };
  };
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success('Project deleted successfully');
      setShowDeleteDialog(false);
      
      // Refresh the page to update the project list
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete project:', error);
      
      // Handle specific error for projects with documents
      if (error instanceof Error && error.message.startsWith('PROJECT_HAS_DOCUMENTS:')) {
        const documentCount = error.message.split(':')[1];
        toast.error(
          `Cannot delete project "${project.name}". Please delete all ${documentCount} document${parseInt(documentCount) > 1 ? 's' : ''} first.`,
          { duration: 5000 }
        );
      } else {
        toast.error('Failed to delete project. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow cursor-pointer">
        <Link href={`/chat/${project.id}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg leading-6 group-hover:text-blue-600 transition-colors">
                {project.name}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className={`opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 ${
                  project._count.documents > 0 ? 'cursor-not-allowed' : ''
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setShowDeleteDialog(true);
                }}
                title={
                  project._count.documents > 0 
                    ? `Cannot delete: project contains ${project._count.documents} document${project._count.documents > 1 ? 's' : ''}`
                    : 'Delete project'
                }
              >
                <Trash2 className={`h-4 w-4 ${
                  project._count.documents > 0 ? 'text-gray-400' : 'text-red-500'
                }`} />
              </Button>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {project.description}
              </p>
            )}
          </CardHeader>
        </Link>
        
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                <FileText className="h-3 w-3 mr-1" />
                {project._count.documents}
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                <MessageSquare className="h-3 w-3 mr-1" />
                {project._count.messages}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(project.lastUsedAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>&ldquo;{project.name}&rdquo;</strong>?
              {project._count.documents > 0 ? (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-center gap-2 text-amber-800">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">
                      This project contains {project._count.documents} document{project._count.documents > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    You must delete all documents first before deleting the project.
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-red-600">
                  This action cannot be undone and will permanently delete all associated messages.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || project._count.documents > 0}
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 