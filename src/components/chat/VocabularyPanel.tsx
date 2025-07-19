"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Loader2 } from 'lucide-react';

interface VocabularyWord {
  id: string;
  term: string;
  definition: string;
  createdAt: string;
}

interface VocabularyPanelProps {
  projectId: string;
}

export function VocabularyPanel({ projectId }: VocabularyPanelProps) {
  const { t } = useTranslation();
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVocabulary = async () => {
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
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (vocabulary.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            {t('vocabulary.noVocabulary')}
          </p>
          <p className="text-sm text-muted-foreground">
            Extract vocabulary from messages to build your term glossary.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div className="mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {t('vocabulary.title')} ({vocabulary.length})
        </h2>
      </div>
      
      {vocabulary.map((word) => (
        <Card key={word.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">{word.term}</h3>
              <p className="text-sm text-muted-foreground">{word.definition}</p>
              <div className="text-xs text-muted-foreground">
                {new Date(word.createdAt).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 