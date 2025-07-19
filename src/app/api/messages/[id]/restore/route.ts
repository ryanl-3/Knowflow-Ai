import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import prisma from '@/lib/prisma';

// POST - Restore deleted message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const message = await prisma.message.findFirst({
      where: {
        id,
        project: {
          userId: user.id
        },
        isDeleted: true
      }
    });

    if (!message) {
      return NextResponse.json({ error: 'Deleted message not found' }, { status: 404 });
    }

    const restoredMessage = await prisma.message.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ 
      message: 'Message restored successfully',
      data: restoredMessage
    });
  } catch (error) {
    console.error('Error restoring message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 