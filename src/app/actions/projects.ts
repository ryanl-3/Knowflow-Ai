'use server';

import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

export async function createProject(formData: FormData) {
  const session = await getServerSession(authConfig);
  
  if (!session?.user?.email) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;

  if (!name || name.trim().length === 0) {
    throw new Error('Project name is required');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      userId: user.id,
    }
  });

  revalidatePath('/');
  redirect(`/chat/${project.id}`);
}

export async function getProjects(page: number = 1, limit: number = 12, sortBy: 'recent' | 'usage' = 'recent') {
  const session = await getServerSession(authConfig);
  
  if (!session?.user?.email) {
    return { projects: [], total: 0, hasMore: false };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    return { projects: [], total: 0, hasMore: false };
  }

  const skip = (page - 1) * limit;
  const orderBy = sortBy === 'recent' 
    ? { lastUsedAt: 'desc' as const }
    : { usageCount: 'desc' as const };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy,
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            documents: true,
            messages: true
          }
        }
      }
    }),
    prisma.project.count({
      where: { userId: user.id }
    })
  ]);

  return {
    projects,
    total,
    hasMore: total > skip + limit
  };
}

export async function updateProjectUsage(projectId: string) {
  const session = await getServerSession(authConfig);
  
  if (!session?.user?.email) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    return;
  }

  await prisma.project.update({
    where: {
      id: projectId,
      userId: user.id
    },
    data: {
      lastUsedAt: new Date(),
      usageCount: {
        increment: 1
      }
    }
  });
}

export async function deleteProject(projectId: string) {
  const session = await getServerSession(authConfig);
  
  if (!session?.user?.email) {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if the project has any documents
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: user.id
    },
    include: {
      _count: {
        select: {
          documents: true
        }
      }
    }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Prevent deletion if project has documents
  if (project._count.documents > 0) {
    throw new Error(`PROJECT_HAS_DOCUMENTS:${project._count.documents}`);
  }

  await prisma.project.delete({
    where: {
      id: projectId,
      userId: user.id
    }
  });

  revalidatePath('/');
} 