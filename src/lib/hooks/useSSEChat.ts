import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, StreamChunk, DocumentSource } from '@/lib/types';

interface UseSSEChatOptions {
  projectId: string;
  initialMessages?: Message[];
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  sources: DocumentSource[];
  error: string | null;
}

export const useSSEChat = ({ projectId, initialMessages = [] }: UseSSEChatOptions) => {
  const [state, setState] = useState<ChatState>({
    messages: initialMessages,
    isLoading: false,
    streamingContent: '',
    sources: [],
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const generateSessionId = useCallback(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const sendMessage = useCallback(async (
    content: string, 
    options: { contextStyle?: string; images?: string[] } = {}
  ) => {
    if (!content.trim() || state.isLoading) return;

    // Add user message immediately
    const userMessage: Message = {
      id: generateSessionId() + '_user',
      role: 'user',
      content: content.trim(),
      images: options.images,
      createdAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      streamingContent: '',
      sources: [],
      error: null,
    }));

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/chat/${projectId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          sessionId: generateSessionId(),
          contextStyle: options.contextStyle || 'detailed',
          images: options.images || [],
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let fullAssistantContent = '';
      let currentSources: DocumentSource[] = [];
      let readerReleased = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                const data: StreamChunk = JSON.parse(jsonStr);

                switch (data.type) {
                  case 'sources':
                    currentSources = JSON.parse(data.content);
                    setState(prev => ({
                      ...prev,
                      sources: currentSources,
                    }));
                    break;

                  case 'text':
                    fullAssistantContent += data.content;
                    setState(prev => ({
                      ...prev,
                      streamingContent: fullAssistantContent,
                    }));
                    break;

                  case 'image':
                    // Handle image content (placeholder for future implementation)
                    console.log('Received image:', data.content);
                    break;

                  case 'done':
                    // Create final assistant message
                    const assistantMessage: Message = {
                      id: generateSessionId() + '_assistant',
                      role: 'assistant',
                      content: fullAssistantContent,
                      metadata: {
                        sources: currentSources,
                        timestamp: new Date().toISOString(),
                      },
                      createdAt: new Date(),
                    };

                    setState(prev => ({
                      ...prev,
                      messages: [...prev.messages, assistantMessage],
                      isLoading: false,
                      streamingContent: '',
                      sources: [],
                    }));
                    
                    // Release reader and return
                    if (!readerReleased) {
                      reader.releaseLock();
                      readerReleased = true;
                    }
                    return;

                  case 'error':
                    setState(prev => ({
                      ...prev,
                      error: data.content,
                      isLoading: false,
                      streamingContent: '',
                    }));
                    
                    // Release reader and return
                    if (!readerReleased) {
                      reader.releaseLock();
                      readerReleased = true;
                    }
                    return;
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        // Only release if not already released
        if (!readerReleased) {
          try {
            reader.releaseLock();
          } catch (error) {
            console.warn('Failed to release reader lock:', error);
          }
        }
      }

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        setState(prev => ({
          ...prev,
          isLoading: false,
          streamingContent: '',
        }));
      } else {
        console.error('Error in SSE chat:', error);
        let errorMessage = 'An error occurred while sending your message';
        
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            errorMessage = 'Request timed out. Please try again.';
          } else if (error.message.includes('network')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          } else {
            errorMessage = error.message;
          }
        }
        
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          streamingContent: '',
        }));
      }
    } finally {
      // Clean up abort controller
      abortControllerRef.current = null;
    }
  }, [projectId, state.isLoading, generateSessionId]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isLoading: false,
      streamingContent: '',
      error: null, // Clear any existing errors
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      streamingContent: '',
      sources: [],
      error: null,
    }));
  }, []);

  const retryLastMessage = useCallback(() => {
    const lastUserMessage = state.messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'user');
    
    if (lastUserMessage) {
      // Remove the last assistant message if it exists
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => 
          !(msg.role === 'assistant' && msg.createdAt > lastUserMessage.createdAt)
        ),
        error: null,
      }));
      
      // Resend the message
      sendMessage(lastUserMessage.content, {
        images: lastUserMessage.images,
      });
    }
  }, [state.messages, sendMessage]);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    streamingContent: state.streamingContent,
    sources: state.sources,
    error: state.error,
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,
  };
}; 