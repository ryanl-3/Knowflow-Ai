import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_CONFIG, extractUserIdFromS3Key } from '@/lib/s3';
import prisma from '@/lib/prisma';
import { Pinecone } from '@pinecone-database/pinecone';

export async function DELETE(
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
        { status: 403 }
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

        let s3DeleteSuccess = false;
    let s3FileNotFound = false;

    // Delete from S3 if s3Key exists
    if (document.s3Key) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: S3_CONFIG.bucketName,
          Key: document.s3Key,
        });
        await s3Client.send(deleteCommand);
        s3DeleteSuccess = true;
        console.log(`S3 file deleted successfully: ${document.s3Key}`);
      } catch (s3Error) {
        console.error('S3 deletion error:', s3Error);
        
        // Check if it's a "file not found" or permission error by converting to string
        const errorString = String(s3Error);
        if (errorString.includes('NoSuchKey') || errorString.includes('404')) {
          s3FileNotFound = true;
          console.log('S3 file not found, proceeding with database deletion');
        } else if (errorString.includes('403') || errorString.includes('Forbidden') || errorString.includes('AccessDenied')) {
          s3FileNotFound = true; // Treat 403 as "file effectively not accessible"
          console.log('S3 access denied (403), treating as missing file and proceeding with database deletion');
        } else {
          console.warn('S3 deletion failed but continuing with database deletion');
        }
      }
    } else {
      console.log('No S3 key found, only deleting database record');
    }

    // Delete from Pinecone vector database
    let pineconeDeleteSuccess = false;
    try {
      if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX_NAME) {
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
        
        // Query for all vectors with this documentId
        const queryResponse = await index.namespace(`project-${document.projectId}`).query({
          vector: new Array(1536).fill(0), // Dummy vector, we only care about metadata
          filter: { documentId: documentId },
          topK: 10000, // Large number to get all matching vectors
          includeMetadata: true,
        });

        // Extract vector IDs to delete
        const vectorIds = queryResponse.matches?.map(match => match.id) || [];
        
        if (vectorIds.length > 0) {
          // Delete vectors from Pinecone
          await index.namespace(`project-${document.projectId}`).deleteMany(vectorIds);
          console.log(`Deleted ${vectorIds.length} vectors from Pinecone for document: ${documentId}`);
          pineconeDeleteSuccess = true;
        } else {
          console.log(`No vectors found in Pinecone for document: ${documentId}`);
          pineconeDeleteSuccess = true; // No vectors to delete = success
        }
      } else {
        console.log('Pinecone not configured, skipping vector deletion');
        pineconeDeleteSuccess = true; // Skip if not configured
      }
    } catch (pineconeError) {
      console.error('Pinecone deletion error:', pineconeError);
      console.warn('Pinecone deletion failed but continuing with database deletion');
    }

    // Always delete from database regardless of S3/Pinecone deletion result
    try {
      await prisma.document.delete({
        where: { id: documentId },
      });
      console.log(`Database record deleted successfully: ${documentId}`);
    } catch (dbError) {
      console.error('Database deletion error:', dbError);
      throw new Error('Failed to delete document from database');
    }

    // Prepare response message
    let message = 'Document deleted successfully';
    if (document.s3Key && !s3DeleteSuccess) {
      if (s3FileNotFound) {
        message = 'Document deleted successfully (S3 file was not accessible)';
      } else {
        message = 'Document deleted from database, but S3 deletion failed';
      }
    }
    if (!pineconeDeleteSuccess) {
      message += ' (Pinecone cleanup may have failed)';
    }

    return NextResponse.json({
      message,
      details: {
        databaseDeleted: true,
        s3Deleted: s3DeleteSuccess,
        s3FileNotFound,
        pineconeDeleted: pineconeDeleteSuccess,
        s3Key: document.s3Key || null,
      }
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
} 