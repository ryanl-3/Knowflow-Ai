import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import prisma from '@/lib/prisma';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import type { Index } from "@pinecone-database/pinecone";


export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const projectId = params.id;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // TODO: Re-enable once Pinecone type conflicts are resolved
    if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
      console.error('AI/Pinecone environment variables not set');
      return NextResponse.json(
        { error: 'Vector search temporarily disabled. Please use the main chat interface.' },
        { status: 500 }
      );
    }

    // --- Restore Pinecone vector store creation ---
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY!,
    });

    // Cast index to any to satisfy type mismatch between packages
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index as Index,
      namespace: `project-${projectId}`,
    });

    const results = await vectorStore.maxMarginalRelevanceSearch(query, {
      k: 4,
      fetchK: 20,
      lambda: 0.6,
    });

    const formattedResults = results.map((doc, idx) => ({
      id: idx,
      content: doc.pageContent,
      metadata: doc.metadata,
      relevanceScore: null,
    }));

    return NextResponse.json({
      query,
      results: formattedResults,
      totalResults: formattedResults.length,
    });

  } catch (error) {
    console.error('Error performing semantic search:', error);
    return NextResponse.json(
      { error: 'Failed to perform semantic search' },
      { status: 500 }
    );
  }
}