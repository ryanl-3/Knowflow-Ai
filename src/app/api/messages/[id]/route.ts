import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import prisma from '@/lib/prisma';

// GET - Get single message
export async function GET(
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
        }
      },
      include: {
        project: true
      }
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update message (for editing)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content, role } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get current message to save to edit history
    const currentMessage = await prisma.message.findFirst({
      where: {
        id,
        project: {
          userId: user.id
        }
      }
    });

    if (!currentMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Only allow editing user messages or assistant messages
    if (role && role !== currentMessage.role) {
      return NextResponse.json({ error: 'Cannot change message role' }, { status: 400 });
    }

    // Prepare edit history
    let currentEditHistory: Array<{ content: string; editedAt: Date }> = [];
    if (Array.isArray(currentMessage.editHistory)) {
      currentEditHistory = (currentMessage.editHistory as unknown) as Array<{ content: string; editedAt: Date }>;
    }
    
    const newEditHistory = [
      ...currentEditHistory,
      {
        content: currentMessage.content,
        editedAt: new Date()
      }
    ];

    // Update message
    const updatedMessage = await prisma.message.update({
      where: { id },
      data: {
        content,
        editHistory: newEditHistory,
        lastEditedAt: new Date(),
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ message: updatedMessage });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete message (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';

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
        }
      }
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (permanent) {
      // Permanent deletion
      await prisma.message.delete({
        where: { id }
      });
      
      return NextResponse.json({ 
        message: 'Message permanently deleted',
        deleted: true,
        permanent: true
      });
    } else {
      // Soft deletion
      const deletedMessage = await prisma.message.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      });

      return NextResponse.json({ 
        message: 'Message deleted',
        deleted: true,
        permanent: false,
        data: deletedMessage
      });
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 