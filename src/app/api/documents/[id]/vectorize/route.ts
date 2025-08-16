import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_CONFIG, extractUserIdFromS3Key } from '@/lib/s3';
import prisma from '@/lib/prisma';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import pdf from 'pdf-parse';

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
    const documentId = params.id;

    // Get document record and verify ownership
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        project: {
          userId: session.user.id,
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    // Additional security: verify the S3 key belongs to the current user
    if (document.s3Key) {
      const s3KeyUserId = extractUserIdFromS3Key(document.s3Key);
      if (s3KeyUserId !== session.user.id) {
        return NextResponse.json(
          { error: 'Access denied: S3 key does not belong to current user' },
          { status: 403 }
        );
      }
    }

    // Check if document has s3Key
    if (!document.s3Key) {
      return NextResponse.json(
        { error: 'Document has no S3 key for processing' },
        { status: 400 }
      );
    }

    // 🔍 Debug: Log document info
    console.log('Processing document:', {
      id: document.id,
      name: document.name,
      s3Key: document.s3Key,
      status: document.status
    });

    // Update status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    // Download PDF from S3
    console.log('🔍 Downloading from S3:', {
      bucket: S3_CONFIG.bucketName,
      key: document.s3Key
    });
    
    const getObjectCommand = new GetObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: document.s3Key,
    });

    const s3Response = await s3Client.send(getObjectCommand);
    const pdfBuffer = Buffer.from(await s3Response.Body!.transformToByteArray());

    console.log('🔍 PDF downloaded, buffer size:', pdfBuffer.length);

    // Parse PDF to extract text
    const pdfData = await pdf(pdfBuffer);
    const extractedText = pdfData.text;

    if (!extractedText.trim()) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        { error: 'No text content found in PDF' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
      console.error('AI/Pinecone environment variables not set');
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        { error: 'AI/Pinecone environment variables are not properly configured on the server.' },
        { status: 500 }
      );
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);

    // Initialize OpenAI Embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY!,
    });

    // Initialize text splitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Split text into chunks
    const textChunks = await textSplitter.splitText(extractedText);

    // Create LangChain Documents
    const documents = textChunks.map(
      (chunk, index) =>
        new Document({
          pageContent: chunk,
          metadata: {
            documentId: document.id,
            documentName: document.name,
            projectId: document.projectId,
            userId: session.user.id,
            chunkIndex: index,
            totalChunks: textChunks.length,
          },
        })
    );

    // Store in Pinecone
    await PineconeStore.fromDocuments(documents, embeddings, {
      pineconeIndex: index,
      namespace: `project-${document.projectId}`, // Namespace by project for isolation
    });

    // Update status to VECTORIZED
    await prisma.document.update({
      where: { id: documentId },
      data: { 
        status: 'VECTORIZED',
        content: extractedText, // Store extracted text for future use
      },
    });

    return NextResponse.json({
      message: 'Document vectorized successfully',
      documentId: document.id,
      chunksProcessed: textChunks.length,
    });

  } catch (error) {
    console.error('Error vectorizing document:', error);

    // Update status to FAILED if we have the document ID
    try {
      const params = await context.params;
      const documentId = params.id;
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });
    } catch (updateError) {
      console.error('Error updating document status to FAILED:', updateError);
    }

    return NextResponse.json(
      { error: 'Failed to vectorize document' },
      { status: 500 }
    );
  }
} 