import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Message } from '@/lib/types';
import { User, Bot, Clock, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { MessageActions } from './MessageActions';
import { MessageEditor } from './MessageEditor';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  streamingContent?: string;
  sources?: Array<{ id: string; name: string; relevanceScore?: number; }>;
  onDeleteMessage?: (messageId: string, permanent?: boolean) => Promise<void>;
  onRestoreMessage?: (messageId: string) => Promise<void>;
  onEditMessage?: (messageId: string) => void;
  onSaveEdit?: (messageId: string, newContent: string) => Promise<void>;
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  streamingContent = '',
  sources = [],
  onDeleteMessage,
  onRestoreMessage,
  onEditMessage,
  onSaveEdit
}) => {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center p-8 bg-background">
        <div className="text-center">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            Ready to help you explore your documents
          </p>
          <p className="text-sm text-muted-foreground">
            Ask me anything about the uploaded documents and I&apos;ll find the relevant information for you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`group flex max-w-[80%] gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600 border'
            }`}>
              {message.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Message Content */}
            <div className="flex-1">
              <Card className={`relative ${
                message.role === 'user' 
                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' 
                  : 'bg-card dark:bg-card'
              } ${message.isDeleted ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  {/* Message Actions */}
                  {(onDeleteMessage || onRestoreMessage || onEditMessage) && editingMessageId !== message.id && (
                    <div className="absolute top-2 right-2">
                      <MessageActions
                        message={message}
                        onDelete={onDeleteMessage || (async () => {})}
                        onRestore={onRestoreMessage || (async () => {})}
                        onEdit={(messageId) => {
                          setEditingMessageId(messageId);
                          onEditMessage?.(messageId);
                        }}
                        canEdit={!!onEditMessage && !!onSaveEdit}
                        canDelete={!!onDeleteMessage}
                      />
                    </div>
                  )}
                  {/* Message Editor or Content */}
                  {editingMessageId === message.id ? (
                    <MessageEditor
                      message={message}
                      onSave={async (messageId, newContent) => {
                        await onSaveEdit?.(messageId, newContent);
                        setEditingMessageId(null);
                      }}
                      onCancel={() => setEditingMessageId(null)}
                      isEditing={true}
                    />
                  ) : (
                    <>
                      {/* Message text */}
                      {message.role === 'assistant' ? (
                        <MarkdownRenderer 
                          content={message.content} 
                          className="text-sm"
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm text-foreground">
                          {message.content}
                        </div>
                      )}
                    </>
                  )}

                  {/* Images if any */}
                  {message.images && message.images.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {message.images.map((imageUrl, index) => (
                        <div key={index} className="relative w-full h-32">
                          <Image
                            src={imageUrl}
                            alt={`Message image ${index + 1}`}
                            fill
                            className="rounded-lg object-cover border"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sources for assistant messages */}
                  {message.role === 'assistant' && message.metadata?.sources && message.metadata.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Sources</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {message.metadata.sources.map((source, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {source.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamp and Edit Status */}
                  <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.createdAt)}
                      {message.lastEditedAt && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (edited)
                        </span>
                      )}
                      {message.isDeleted && (
                        <span className="ml-2 text-xs text-destructive">
                          (deleted)
                        </span>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ))}

      {/* Streaming Message */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="flex max-w-[80%] gap-3">
            {/* Assistant Avatar */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-600 border flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>

            {/* Streaming Content */}
            <div className="flex-1">
              <Card className="bg-card dark:bg-card">
                <CardContent className="p-4">
                  {/* Show sources first if available */}
                  {sources.length > 0 && (
                    <div className="mb-3 pb-3 border-b border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Found in documents</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {sources.map((source, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {source.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Streaming text */}
                  <div className="text-sm">
                    <MarkdownRenderer 
                      content={streamingContent}
                      className="inline"
                    />
                    {/* Blinking cursor */}
                    <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}; 