"use client";

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import { VocabularyDialog } from './VocabularyDialog';

interface VocabularyButtonProps {
  projectId: string;
}

export function VocabularyButton({ projectId }: VocabularyButtonProps) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsDialogOpen(true)}
        className="flex items-center gap-2"
      >
        <BookOpen className="h-4 w-4" />
        {t('vocabulary.title')}
      </Button>

      <VocabularyDialog
        projectId={projectId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
} 