export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  projectId: string;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  editHistory?: Array<{
    content: string;
    editedAt: Date;
  }> | null;
  lastEditedAt?: Date | null;
  metadata?: {
    sources?: DocumentSource[];
    images?: string[];
    timestamp?: string;
    tokens?: number;
    [key: string]: unknown;
  } | null;
  isStreaming?: boolean;
  createdAt: Date;
  updatedAt: Date;
  images?: string[]; // URLs for images - backward compatibility
}

export interface DocumentSource {
  id: string;
  name: string;
  pageContent: string;
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  projectId: string;
  messages: Message[];
  context: ChatContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatContext {
  // Recent conversation context for maintaining memory
  recentMessages: Message[];
  // Document context from current session
  documentContext: DocumentSource[];
  // User preferences and conversation style
  conversationStyle?: 'concise' | 'detailed' | 'technical';
}

export interface StreamChunk {
  type: 'text' | 'image' | 'sources' | 'done' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RAGResponse {
  answer: string;
  sources: DocumentSource[];
  totalTokens?: number;
} 