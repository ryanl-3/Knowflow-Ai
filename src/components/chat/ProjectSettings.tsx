"use client";

import { useState } from 'react';
import { 
  Settings, 
  Save, 
  X, 
  Bot, 
  FileText,
  Lightbulb
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ProjectSettingsProps {
  projectId: string;
  currentSystemPrompt?: string;
  onSystemPromptUpdate?: (newPrompt: string) => void;
}

export function ProjectSettings({
  projectId,
  currentSystemPrompt = '',
  onSystemPromptUpdate
}: ProjectSettingsProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(currentSystemPrompt);
  const [isSaving, setIsSaving] = useState(false);

  const PROMPT_TEMPLATES = [
    {
      name: t('settings.defaultAssistant'),
      description: t('settings.defaultAssistantDesc'),
      prompt: "You are a helpful, harmless, and honest AI assistant. You should be helpful and provide accurate information to the best of your knowledge, while being safe and avoiding harmful content.",
      icon: Bot
    },
    {
      name: t('settings.researchAssistant'),
      description: t('settings.researchAssistantDesc'),
      prompt: "You are a research assistant specialized in academic and scholarly work. Provide detailed, well-researched responses with appropriate citations and references. Focus on accuracy, critical thinking, and comprehensive analysis.",
      icon: FileText
    },
    {
      name: t('settings.creativeWriter'),
      description: t('settings.creativeWriterDesc'),
      prompt: "You are a creative writing assistant. Help with storytelling, creative writing, brainstorming ideas, and literary analysis. Be imaginative, engaging, and supportive of creative expression while maintaining quality standards.",
      icon: Lightbulb
    }
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt: systemPrompt.trim()
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update project settings');
      }

      toast.success(t('settings.projectSettingsUpdated'));
      onSystemPromptUpdate?.(systemPrompt);
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating project settings:', error);
      toast.error(t('settings.projectSettingsUpdateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateSelect = (template: typeof PROMPT_TEMPLATES[0]) => {
    setSystemPrompt(template.prompt);
  };

  const handleReset = () => {
    setSystemPrompt(currentSystemPrompt);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          {t('settings.projectSettings')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('settings.projectSettings')}
          </DialogTitle>
          <DialogDescription>
            {t('settings.configureProject')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Prompt Templates */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('settings.promptTemplates')}</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PROMPT_TEMPLATES.map((template) => (
                <Card 
                  key={template.name}
                  className="cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <template.icon className="h-4 w-4" />
                      {template.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* System Prompt Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="systemPrompt" className="text-base font-medium">
                {t('settings.systemPrompt')}
              </Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {t('settings.charactersCount').replace('{count}', systemPrompt.length.toString())}
                </Badge>
                {systemPrompt !== currentSystemPrompt && (
                  <Badge variant="secondary" className="text-xs">
                    {t('settings.modified')}
                  </Badge>
                )}
              </div>
            </div>
                         <Textarea
               id="systemPrompt"
               value={systemPrompt}
               onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)}
               placeholder={t('settings.systemPromptPlaceholder')}
               className="min-h-[200px] resize-y"
               maxLength={4000}
             />
            <p className="text-xs text-muted-foreground">
              {t('settings.systemPromptDescription')}
            </p>
          </div>

          {/* Current Status */}
          {currentSystemPrompt && (
            <div className="space-y-3">
              <Label className="text-base font-medium">{t('settings.currentSystemPrompt')}</Label>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {currentSystemPrompt || t('settings.noSystemPrompt')}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            {t('settings.reset')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || systemPrompt === currentSystemPrompt}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-foreground" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 