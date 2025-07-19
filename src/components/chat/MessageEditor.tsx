"use client";

import { useState, useRef, useEffect } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Message } from '@/lib/types';
import { toast } from 'sonner';

interface MessageEditorProps {
  message: Message;
  onSave: (messageId: string, newContent: string) => Promise<void>;
  onCancel: () => void;
  isEditing: boolean;
}

export function MessageEditor({
  message,
  onSave,
  onCancel,
  isEditing
}: MessageEditorProps) {
  const [content, setContent] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Position cursor at end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Message cannot be empty');
      return;
    }

    if (content.trim() === message.content.trim()) {
      // No changes made
      onCancel();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(message.id, content.trim());
      toast.success('Message updated successfully');
    } catch (error) {
      toast.error('Failed to update message');
      console.error('Error updating message:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  if (!isEditing) {
    return null;
  }

  return (
    <div className="space-y-3 p-3 border rounded-md bg-muted/50">
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground font-medium">
          Editing {message.role} message
        </div>
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[80px] resize-y"
          placeholder="Edit your message..."
          disabled={isSaving}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Press Ctrl+Enter to save, Esc to cancel
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-3 w-3 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 