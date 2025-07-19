import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { getProjects } from '@/app/actions/projects';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectDialog from '@/components/CreateProjectDialog';
import LogoutButton from '@/components/auth/LogoutButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { YourProjectsText, NoProjectsYetText, CreateFirstProjectText, PreviousText, NextText, PageOfText } from '@/components/ui/dashboard-text';

interface HomePageProps {
  searchParams: Promise<{ 
    page?: string; 
    sort?: 'recent' | 'usage';
  }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const session = await getServerSession(authConfig);
  
  if (!session) {
    redirect('/login');
  }

  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const { projects, total, hasMore } = await getProjects(page, 12, 'recent');

  const userInitials = session.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : session.user?.email?.[0].toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">KnowFlow AI</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={session.user?.image || ''} />
                    <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                  </Avatar>
                  <Badge variant="secondary" className="text-xs">
                    {session.user?.name || session.user?.email}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <LanguageToggle />
              <ThemeToggle />
              <CreateProjectDialog />
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold"><YourProjectsText /></h2>
            <Badge variant="outline" className="text-xs">
              {total} project{total !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          {projects.length === 0 ? (
            <Card className="max-w-md mx-auto">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 text-muted-foreground">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <CardTitle><NoProjectsYetText /></CardTitle>
                <CardDescription>
                  <CreateFirstProjectText />
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <CreateProjectDialog />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {projects.map((project: {
                  id: string;
                  name: string;
                  description: string | null;
                  createdAt: Date;
                  lastUsedAt: Date;
                  usageCount: number;
                  _count: { documents: number; messages: number };
                }) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                  />
                ))}
              </div>

              {/* Pagination */}
              {(page > 1 || hasMore) && (
                <Card className="p-4">
                  <div className="flex justify-center items-center gap-4">
                    {page > 1 && (
                      <Button variant="outline" asChild>
                        <a href={`/?page=${page - 1}`}>
                          <PreviousText />
                        </a>
                      </Button>
                    )}
                    
                    <Badge variant="secondary" className="px-3 py-1">
                      <PageOfText current={page} total={Math.ceil(total / 12)} />
                    </Badge>
                    
                    {hasMore && (
                      <Button variant="outline" asChild>
                        <a href={`/?page=${page + 1}`}>
                          <NextText />
                        </a>
                      </Button>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
