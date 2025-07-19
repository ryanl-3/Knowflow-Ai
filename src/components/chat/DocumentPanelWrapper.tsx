"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status?: string | null;
  url?: string | null;
  createdAt: Date | string;
}

interface DocumentPanelProps {
  projectId: string;
  documents: Document[];
}

const DocumentPanel = dynamic(() => import('./DocumentPanel'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <Skeleton className="h-6 w-32 mb-3" />
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-2">
          <div className="text-center space-y-2">
            <Skeleton className="h-6 w-6 mx-auto" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
});

export default function DocumentPanelWrapper(props: DocumentPanelProps) {
  return <DocumentPanel {...props} />;
} 