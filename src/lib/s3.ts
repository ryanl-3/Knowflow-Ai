import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configure S3 client with environment variables
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  // Disable request checksums completely to avoid permission issues
  requestChecksumCalculation: 'WHEN_REQUIRED',
  forcePathStyle: false, // Use virtual hosted-style URLs
});

// S3 configuration constants
export const S3_CONFIG = {
  bucketName: process.env.AWS_S3_BUCKET_NAME || '',
  region: process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-west-2',
  signedUrlExpiry: 3600, // 1 hour
};

// Generate S3 key for uploaded files with user-level isolation
export function generateS3Key(userName: string, userId: string, projectId: string, fileName: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  // Clean userName to be S3-safe (remove spaces, special chars)
  const safeUserName = userName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  
  // Structure: {userName}-{userId}/{projectId}/documents/{timestamp}-{random}-{fileName}
  return `${safeUserName}-${userId}/${projectId}/documents/${timestamp}-${randomSuffix}-${fileName}`;
}

// Helper function to extract user ID and name from S3 key for validation
// Helper function to extract user ID and name from S3 key for validation
export function extractUserInfoFromS3Key(s3Key: string): { userId: string; userName: string } | null {
  const firstSegment = s3Key.split("/")[0]; // e.g. "john-doe-abc123"
  const lastDashIndex = firstSegment.lastIndexOf("-");
  if (lastDashIndex === -1) return null;

  const userName = firstSegment.slice(0, lastDashIndex); // "john-doe"
  const userId = firstSegment.slice(lastDashIndex + 1);  // "abc123"

  return { userId, userName };
}

// Helper function to extract just user ID from S3 key (for backward compatibility)
export function extractUserIdFromS3Key(s3Key: string): string | null {
  const userInfo = extractUserInfoFromS3Key(s3Key);
  return userInfo ? userInfo.userId : null;
}

// Generate S3 URL for accessing uploaded files
export function generateS3Url(s3Key: string): string {
  return `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${s3Key}`;
}

// Generate presigned URL for secure access to private S3 objects
export async function generatePresignedUrl(s3Key: string, expiresIn: number = S3_CONFIG.signedUrlExpiry): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_CONFIG.bucketName,
    Key: s3Key,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
} 