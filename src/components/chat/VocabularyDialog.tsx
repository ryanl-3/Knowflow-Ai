"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useTts } from '@/components/TtsProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Loader2, Volume2 } from 'lucide-react';

interface VocabularyWord {
  id: string;
  term: string;
  definition: string;
  createdAt: string;
}

interface VocabularyDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VocabularyDialog({ projectId, open, onOpenChange }: VocabularyDialogProps) {
  const { t } = useTranslation();
  const { playText } = useTts();
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const fetchVocabulary = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/vocabulary`);
        if (response.ok) {
          const data = await response.json();
          setVocabulary(data.vocabulary || []);
        }
      } catch (error) {
        console.error('Error fetching vocabulary:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVocabulary();

    // Listen for vocabulary updates
    const handleVocabularyUpdate = (event: CustomEvent) => {
      if (event.detail?.projectId === projectId) {
        fetchVocabulary();
      }
    };

    window.addEventListener('vocabularyUpdated', handleVocabularyUpdate as EventListener);

    return () => {
      window.removeEventListener('vocabularyUpdated', handleVocabularyUpdate as EventListener);
    };
  }, [projectId, open]);

  const handlePlayVocabulary = (word: VocabularyWord) => {
    const textToPlay = `${word.term}. ${word.definition}`;
    playText({
      text: textToPlay,
      source: 'vocabulary',
      repeat: 1,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t('vocabulary.title')} ({vocabulary.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : vocabulary.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {t('vocabulary.noVocabulary')}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Extract vocabulary from messages to build your term glossary.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vocabulary.map((word) => (
                <Card key={word.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between space-x-3">
                      <div className="space-y-2 flex-1">
                        <h3 className="font-medium text-foreground">{word.term}</h3>
                        <p className="text-sm text-muted-foreground">{word.definition}</p>
                        <div className="text-xs text-muted-foreground">
                          {new Date(word.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePlayVocabulary(word)}
                        className="flex-shrink-0"
                        title={t('tts.playVocabulary')}
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 