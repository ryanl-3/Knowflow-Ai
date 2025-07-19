import React, { useState, useRef, KeyboardEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Image as ImageIcon, Settings, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string, options: { contextStyle?: string; images?: string[] }) => void;
  isLoading: boolean;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({ 
  value, 
  onChange, 
  onSubmit, 
  isLoading,
  placeholder = "Ask me anything about your documents..." 
}) => {
  const { t } = useTranslation();
  const [contextStyle, setContextStyle] = useState<'concise' | 'detailed' | 'technical'>('detailed');
  const [images, setImages] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading) return;

    onSubmit(value.trim(), { contextStyle, images });
    onChange('');
    setImages([]);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setImages(prev => [...prev, event.target?.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const contextStyleOptions: Array<{
    value: 'concise' | 'detailed' | 'technical';
    label: string;
    description: string;
  }> = [
    { value: 'concise', label: t('chat.concise'), description: t('chat.conciseDesc') },
    { value: 'detailed', label: t('chat.detailed'), description: t('chat.detailedDesc') },
    { value: 'technical', label: t('chat.technical'), description: t('chat.technicalDesc') },
  ];

  return (
    <div className="border-t bg-background p-4">
      {/* Settings Panel */}
      {showSettings && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">{t('chat.responseStyle')}</h4>
                <div className="grid grid-cols-3 gap-2">
                  {contextStyleOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setContextStyle(option.value)}
                      className={`p-3 text-left border rounded-lg transition-colors ${
                        contextStyle === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Preview */}
      {images.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {images.map((image, index) => (
              <div key={index} className="relative w-20 h-20">
                <Image
                  src={image}
                  alt={`Image preview ${index + 1}`}
                  fill
                  className="object-cover rounded-lg border"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center space-x-2">
          {/* Main Input */}
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="pr-12"
            />
            
            {/* Context Style Badge */}
            <Badge 
              variant="secondary" 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs px-2 py-1"
            >
              {contextStyle}
            </Badge>
          </div>

          {/* Image Upload Button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex-shrink-0"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          {/* Settings Button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            disabled={isLoading}
            className={`flex-shrink-0 ${showSettings ? 'bg-blue-50 border-blue-300' : ''}`}
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Send Button */}
          <Button 
            type="submit" 
            disabled={!value.trim() || isLoading}
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
      </form>
    </div>
  );
}; 