import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_CONFIG, generateS3Key } from '@/lib/s3';
import prisma from '@/lib/prisma';
import cuid from 'cuid';

// get, post, put, delete => RESTful API route
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, contentType, projectId } = body;

    // Validate input
    if (!fileName || !contentType || !projectId) {
      return NextResponse.json(
        { error: 'fileName, contentType, and projectId are required' },
        { status: 400 }
      );
    }

    // Validate content type (only PDF allowed)
    if (contentType !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

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

    // Get user name for S3 key generation
    const userName = session.user.name || session.user.email || 'user';
    
    // Generate S3 key
    const s3Key = generateS3Key(userName, session.user.id, projectId, fileName);

    // Create document record in database
    const document = await prisma.document.create({
      data: {
        id: cuid(),
        name: fileName,
        type: 'pdf',
        size: 0, // Will be updated after upload
        projectId: projectId,
        s3Key: s3Key,
        status: 'pending_upload',
      },
    });

    // Generate presigned URL for S3 upload
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: s3Key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: S3_CONFIG.signedUrlExpiry,
      // Exclude all checksum and content sha256 related headers
      unsignableHeaders: new Set([
        'x-amz-checksum-crc32',
        'x-amz-sdk-checksum-algorithm',
        'x-amz-content-sha256'
      ]),
    });

    return NextResponse.json({
      uploadUrl,
      documentId: document.id,
      s3Key,
    });

  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
} 