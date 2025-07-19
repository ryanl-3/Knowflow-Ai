"use client";

import { useState } from 'react';
import { 
  Trash2, 
  Edit3, 
  MoreVertical, 
  Undo2, 
  Copy, 
  Share,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Message } from '@/lib/types';

interface MessageActionsProps {
  message: Message;
  onDelete: (messageId: string, permanent?: boolean) => Promise<void>;
  onRestore: (messageId: string) => Promise<void>;
  onEdit: (messageId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function MessageActions({
  message,
  onDelete,
  onRestore,
  onEdit,
  canEdit = true,
  canDelete = true,
}: MessageActionsProps) {
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(t('chat.messageCopied'));
    } catch {
      toast.error(t('chat.messageCopyFailed'));
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('chat.shareMessage'),
          text: message.content,
        });
      } else {
        await navigator.clipboard.writeText(message.content);
        toast.success(t('chat.messageCopied'));
      }
    } catch {
      toast.error(t('chat.messageCopyFailed'));
    }
  };

  const handleDelete = async (permanent = false) => {
    setIsDeleting(true);
    try {
      await onDelete(message.id, permanent);
      setDeleteDialogOpen(false);
      toast.success(permanent ? t('chat.messageDeleted') : t('chat.messageDeleted'));
    } catch {
      toast.error(t('chat.messageDeletionFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async () => {
    try {
      await onRestore(message.id);
      toast.success(t('chat.messageRestored'));
    } catch {
      toast.error(t('chat.messageRestoreFailed'));
    }
  };

  // If message is deleted, show restore option
  if (message.isDeleted) {
    return (
      <div className="flex items-center gap-1 opacity-60">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestore}
          className="h-6 px-2 text-xs"
        >
          <Undo2 className="h-3 w-3 mr-1" />
          {t('chat.restoreMessage')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {t('chat.permanentDelete')}
        </Button>

        {/* Permanent Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {t('chat.permanentDelete')}
              </DialogTitle>
              <DialogDescription>
                {t('chat.confirmPermanentDelete')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(true)}
                disabled={isDeleting}
              >
                {isDeleting ? t('common.loading') : t('chat.permanentDelete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="h-3 w-3" />
            <span className="sr-only">Message actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            {t('chat.copyMessage')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShare}>
            <Share className="h-4 w-4 mr-2" />
            {t('chat.shareMessage')}
          </DropdownMenuItem>
          
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(message.id)}>
                <Edit3 className="h-4 w-4 mr-2" />
                {t('chat.editMessage')}
              </DropdownMenuItem>
            </>
          )}
          
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-red-600 focus:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('chat.deleteMessage')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? You can restore it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(false)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 