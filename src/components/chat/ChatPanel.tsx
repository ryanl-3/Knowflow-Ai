'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, RefreshCw, Trash2, AlertCircle, X } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useSSEChat } from '@/lib/hooks/useSSEChat';
import { Message } from '@/lib/types';
import { toast } from 'sonner';
import { ProjectSettings } from './ProjectSettings';
import { useTranslation } from '@/lib/i18n';

interface SearchResult {
  id: number;
  content: string;
  metadata: {
    documentName?: string;
    [key: string]: unknown;
  };
  relevanceScore: number;
}

interface ChatPanelProps {
  projectId: string;
  messages: Message[];
}

export default function ChatPanel({ projectId, messages: initialMessages }: ChatPanelProps) {
  const { t } = useTranslation();
  
  // Initialize SSE chat hook with existing messages
  const {
    messages,
    isLoading,
    streamingContent,
    sources,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,
  } = useSSEChat({ 
    projectId, 
    initialMessages: initialMessages.map(msg => ({
      ...msg,
      createdAt: new Date(msg.createdAt),
    }))
  });

  // Project settings state
  const [currentSystemPrompt, setCurrentSystemPrompt] = useState<string>('');

  // Semantic search testing states (keeping existing functionality)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showSearchTest, setShowSearchTest] = useState(false);

  // Load project settings on mount
  useEffect(() => {
    const loadProjectSettings = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/settings`);
        if (response.ok) {
          const data = await response.json();
          setCurrentSystemPrompt(data.project?.systemPrompt || '');
        }
      } catch (error) {
        console.error('Failed to load project settings:', error);
      }
    };

    loadProjectSettings();
  }, [projectId]);

  const handleSendMessage = (content: string, options: { contextStyle?: string; images?: string[] }) => {
    sendMessage(content, options);
  };

  // Message management functions
  const handleDeleteMessage = async (messageId: string, permanent = false) => {
    try {
      const response = await fetch(`/api/messages/${messageId}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete message');
      }

      // Update messages list - you might want to refresh from server or update locally
      window.location.reload(); // Simple refresh for now
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  };

  const handleRestoreMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to restore message');
      }

      // Update messages list
      window.location.reload(); // Simple refresh for now
    } catch (error) {
      console.error('Error restoring message:', error);
      throw error;
    }
  };

  const handleEditMessage = (messageId: string) => {
    console.log('Starting edit for message:', messageId);
  };

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newContent
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update message');
      }

      // Refresh the page to show updated message
      // In a more sophisticated implementation, you'd update the local state
      window.location.reload();
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearchLoading) return;

    setIsSearchLoading(true);
    try {
      const response = await fetch(`/api/chat/${projectId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Search failed:', error);
        return;
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Error performing search:', error);
    } finally {
      setIsSearchLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 dark:bg-destructive/20 border-b border-destructive/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{t('common.error')}: {error}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={retryLastMessage}
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {t('chat.retry')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Controls */}
      <div className="border-b bg-muted/50 dark:bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ProjectSettings
              projectId={projectId}
              currentSystemPrompt={currentSystemPrompt}
              onSystemPromptUpdate={(newPrompt) => {
                setCurrentSystemPrompt(newPrompt);
                toast.success('System prompt updated! It will be used in your next conversation.');
              }}
            />
            
            <Button
              onClick={() => setShowSearchTest(!showSearchTest)}
              variant="outline"
              size="sm"
            >
              <Search className="w-4 h-4 mr-1" />
              {showSearchTest ? t('chat.hideSearchTest') : t('chat.showSearchTest')}
            </Button>
            
            {messages.length > 0 && (
              <Button
                onClick={clearMessages}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 w-4 mr-1" />
                {t('chat.clearChat')}
              </Button>
            )}
          </div>

          {isLoading && (
            <Button
              onClick={stopStreaming}
              variant="outline"
              size="sm"
              className="text-orange-600"
            >
              <X className="w-4 h-4 mr-1" />
              {t('chat.stop')}
            </Button>
          )}
        </div>
      </div>

      {/* Semantic Search Testing Section */}
      {showSearchTest && (
        <div className="border-b bg-muted/30 dark:bg-muted/20 p-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-5 h-5" />
                {t('chat.semanticSearchTest')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('chat.searchThroughDocuments')}
                  disabled={isSearchLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={!searchQuery.trim() || isSearchLoading}>
                  {isSearchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </form>

              {isSearchLoading && (
                <div className="text-center text-sm text-muted-foreground">
                  {t('chat.searching')}
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  <h4 className="font-medium text-sm text-foreground">{t('chat.searchResults')}:</h4>
                  {searchResults.map((result) => (
                    <Card key={result.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          {result.relevanceScore !== null ? (
                            <Badge variant="secondary" className="text-xs">
                              {t('chat.score')}: {result.relevanceScore.toFixed(3)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              MMR
                            </Badge>
                          )}
                          {result.metadata?.documentName && (
                            <Badge variant="outline" className="text-xs">
                              {result.metadata.documentName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground line-clamp-3">
                          {result.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {searchQuery && !isSearchLoading && searchResults.length === 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  {t('chat.noResultsFoundVectorize')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        streamingContent={streamingContent}
        sources={sources}
        onDeleteMessage={handleDeleteMessage}
        onRestoreMessage={handleRestoreMessage}
        onEditMessage={handleEditMessage}
        onSaveEdit={handleSaveEdit}
      />

      {/* Input */}
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSendMessage}
        isLoading={isLoading}
        placeholder="Ask me anything about your documents..."
      />
    </div>
  );
} 