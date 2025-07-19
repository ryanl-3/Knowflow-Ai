import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import prisma from '@/lib/prisma';
import OpenAI from 'openai';
import { StreamChunk, DocumentSource } from '@/lib/types';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const params = await context.params;
    const projectId = params.id;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Get last 10 messages for context
        },
      },
    });

    if (!project) {
      return new Response('Project not found or access denied', { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { message, sessionId, contextStyle = 'detailed' } = body;

    if (!message || typeof message !== 'string') {
      return new Response('Message is required', { status: 400 });
    }

    // Set up SSE headers
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const sendChunk = (chunk: StreamChunk) => {
          const data = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        const sendError = (error: string) => {
          sendChunk({ type: 'error', content: error });
          controller.close();
        };

        const sendDone = () => {
          sendChunk({ type: 'done', content: '' });
          controller.close();
        };

        try {
          // Check OpenAI API key
          if (!process.env.OPENAI_API_KEY) {
            sendError('OpenAI API key not configured');
            return;
          }

          // Build conversation context from recent messages
          const recentMessages = project.messages.slice(0, 6).reverse(); // Last 6 messages for context

          // ------------------ RAG Retrieval ------------------
          if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
            sendError('Pinecone environment variables not configured');
            return;
          }

          const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
          const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
          const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY! });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pineconeIndex: index as any,
            namespace: `project-${projectId}`,
          });

          const scored = await vectorStore.similaritySearchWithScore(message, 4);

          const SIM_THRESHOLD = 0.75; // adjust as needed
          const filtered = scored.filter(([, score]) => score >= SIM_THRESHOLD);

          const sources: DocumentSource[] = filtered.map(([doc], idx) => ({
            id: `src-${idx}`,
            name: doc.metadata?.documentName || 'Document',
            pageContent: doc.pageContent,
            metadata: doc.metadata,
          }));

          // Send sources to frontend
          sendChunk({ type: 'sources', content: JSON.stringify(sources) });

          const contextText = sources
            .map((s, i) => `[${i + 1}] ${s.pageContent}`)
            .join('\n---\n');

          // ---------------------------------------------------

          // Build base system guidelines
          const baseSystem = `You are an AI assistant with broad knowledge. When an additional CONTEXT section is supplied, use it to improve accuracy, resolve ambiguity, or cite sources. If the context contradicts general knowledge, follow the context. If the context does not relate to the question, rely on your own knowledge. Respond in a ${contextStyle} style.`;

          const messagesForLLM: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: baseSystem },
          ];

          if (sources.length > 0) {
            messagesForLLM.push({ role: 'system', content: `Context:\n${contextText}` });
          }

          // Add conversation history directly to messages array
          for (const m of recentMessages) {
            messagesForLLM.push({ role: m.role as 'user' | 'assistant', content: m.content });
          }

          // current user question
          messagesForLLM.push({ role: 'user', content: message });

          // Stream OpenAI response
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messagesForLLM,
            stream: true,
            temperature: 0.7,
            max_tokens: 5000,
          });

          let fullResponse = '';

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content;
            
            if (content) {
              fullResponse += content;
              
              // Send text chunk
              sendChunk({
                type: 'text',
                content: content,
              });
            }
          }

          // Save the conversation to database
          try {
            await prisma.message.createMany({
              data: [
                {
                  id: sessionId + '-user',
                  projectId: projectId,
                  content: message,
                  role: 'user',
                },
                {
                  id: sessionId + '-assistant',
                  projectId: projectId,
                  content: fullResponse,
                  role: 'assistant',
                },
              ],
            });
          } catch (dbError) {
            console.error('Failed to save messages to database:', dbError);
            // Don't fail the request if database save fails
          }

          sendDone();

        } catch (error) {
          console.error('Error in chat stream:', error);
          sendError('An error occurred while processing your message');
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error) {
    console.error('Error setting up chat stream:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 