/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { updateProjectUsage } from '@/app/actions/projects';
import DocumentPanelWrapper from '@/components/chat/DocumentPanelWrapper';
import ChatPanel from '@/components/chat/ChatPanel';
import { VocabularyButton } from '@/components/chat/VocabularyButton';
import Link from 'next/link';
import { ArrowLeft, FileText, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageToggle } from '@/components/ui/language-toggle';
import prisma from '@/lib/prisma';

interface ChatPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const resolvedParams = await params;
  const session = await getServerSession(authConfig);
  
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    redirect('/login');
  }

  const project = await prisma.project.findFirst({
    where: {
      id: resolvedParams.id,
      userId: user.id
    },
    include: {
      documents: {
        orderBy: { createdAt: 'desc' }
      },
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!project) {
    notFound();
  }

  // Update project usage
  await updateProjectUsage(project.id);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <Card className="rounded-none border-b border-t-0 border-l-0 border-r-0">
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-lg font-semibold">{project.name}</h1>
                  {project.description && (
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {project.documents.length}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {project.messages.length}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <VocabularyButton projectId={project.id} />
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Documents */}
        <Card className="w-1/3 rounded-none border-t-0 border-l-0 border-b-0">
          <CardContent className="p-0 h-full">
            <DocumentPanelWrapper 
              projectId={project.id} 
              documents={project.documents} 
            />
          </CardContent>
        </Card>

        <Separator orientation="vertical" />

        {/* Right Panel - Chat */}
        <Card className="flex-1 rounded-none border-0">
          <CardContent className="p-0 h-full">
            <ChatPanel 
              projectId={project.id} 
              messages={project.messages.map((msg: any) => ({
                ...msg,
                role: msg.role as 'user' | 'assistant'
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 