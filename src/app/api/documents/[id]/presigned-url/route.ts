import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { generatePresignedUrl, extractUserIdFromS3Key } from '@/lib/s3';
import prisma from '@/lib/prisma';

export async function GET(
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

    // Generate presigned URL
    const presignedUrl = await generatePresignedUrl(document.s3Key);

    return NextResponse.json({
      url: presignedUrl,
      expiresIn: 3600, // 1 hour
    });

  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
} 