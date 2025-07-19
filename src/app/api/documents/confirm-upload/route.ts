import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_CONFIG, extractUserIdFromS3Key, generateS3Url } from '@/lib/s3';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    // Get document record
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        project: {
          userId: session.user.id,
        },
      },
    });

    if (!document || !document.s3Key) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 403 }
      );
    }

    // Additional security: verify the S3 key belongs to the current user
    const s3KeyUserId = extractUserIdFromS3Key(document.s3Key);
    if (s3KeyUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied: S3 key does not belong to current user' },
        { status: 403 }
      );
    }

    // Verify file exists in S3 and get metadata
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: S3_CONFIG.bucketName,
        Key: document.s3Key,
      });

      const response = await s3Client.send(headCommand);
      const fileSize = response.ContentLength || 0;

      // Update document status and size
      const updatedDocument = await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'uploaded',
          size: fileSize,
          url: generateS3Url(document.s3Key),
        },
      });

      return NextResponse.json({
        message: 'Upload confirmed',
        document: {
          id: updatedDocument.id,
          name: updatedDocument.name,
          size: updatedDocument.size,
          status: updatedDocument.status,
        },
      });

    } catch (s3Error) {
      console.error('S3 verification error:', s3Error);
      
      // Update document status to failed
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'failed' },
      });

      return NextResponse.json(
        { error: 'File not found in S3 or upload incomplete' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error confirming upload:', error);
    return NextResponse.json(
      { error: 'Failed to confirm upload' },
      { status: 500 }
    );
  }
} 