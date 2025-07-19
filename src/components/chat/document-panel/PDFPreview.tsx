"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';
import { Eye, FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink, AlertCircle, BookOpen, Volume2 } from 'lucide-react';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Document } from './types';
import { truncateFileName } from './utils';
import { useTranslation } from '@/lib/i18n';
import { useTts } from '@/components/TtsProvider';
import { toast } from 'sonner';

// Polyfill for Promise.withResolvers (required for Node.js < 22)
if (typeof Promise.withResolvers === 'undefined') {
  if (typeof window !== 'undefined') {
    // Browser environment
    (window as unknown as { Promise: PromiseConstructor }).Promise.withResolvers = function <T>() {
      let resolve: (value: T | PromiseLike<T>) => void;
      let reject: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve: resolve!, reject: reject! };
    };
  } else {
    // Server environment
    (global as unknown as { Promise: PromiseConstructor }).Promise.withResolvers = function <T>() {
      let resolve: (value: T | PromiseLike<T>) => void;
      let reject: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve: resolve!, reject: reject! };
    };
  }
}

// Set up PDF.js worker - use legacy version for better compatibility
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  document: Document;
  onPreviewOpen: () => Promise<void>;
  projectId: string;
}

export default function PDFPreview({ document, onPreviewOpen, projectId }: PDFPreviewProps) {
  const { t } = useTranslation();
  const { playText } = useTts();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [pdfWidth, setPdfWidth] = useState<number>(800);
  const [isExtractingVocabulary, setIsExtractingVocabulary] = useState<boolean>(false);
  const [isPlayingPage, setIsPlayingPage] = useState<boolean>(false);

  // Calculate optimal PDF width based on viewport
  useEffect(() => {
    const calculatePdfWidth = () => {
      if (typeof window !== 'undefined') {
        const optimalWidth = Math.min(window.innerWidth * 0.85, 1200);
        setPdfWidth(optimalWidth);
      }
    };

    calculatePdfWidth();
    
    // Add resize listener
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', calculatePdfWidth);
      return () => window.removeEventListener('resize', calculatePdfWidth);
    }
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setPdfLoading(false);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setPdfError('Failed to load PDF document');
    setPdfLoading(false);
  };

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  const extractVocabularyFromCurrentPage = async () => {
    if (!presignedUrl) {
      toast.error(t('vocabulary.extractionFailed'));
      return;
    }

    setIsExtractingVocabulary(true);
    try {
      // First, get the PDF document to extract text
      const response = await fetch(presignedUrl);
      const pdfData = await response.arrayBuffer();
      
      // Use pdf.js to extract text from current page
      const pdf = await pdfjs.getDocument(pdfData).promise;
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      
      // Extract text from textContent
      const pageText = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => item.str)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str)
        .join(' ');

      if (!pageText.trim()) {
        toast.error('No text found on current page');
        return;
      }

      // Call vocabulary extraction API
      const extractResponse = await fetch('/api/extract-vocabulary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: pageText,
          projectId: projectId,
          documentId: document.id,
        }),
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract vocabulary');
      }

      const result = await extractResponse.json();
      
      if (result.count > 0) {
        toast.success(`${t('vocabulary.extractedCount')} ${result.count} ${t('vocabulary.term')}${result.count > 1 ? 's' : ''}`);
        
        // Dispatch custom event to refresh vocabulary dialog if open
        window.dispatchEvent(new CustomEvent('vocabularyUpdated'));
      } else {
        toast.info('No vocabulary terms found on this page');
      }
    } catch (error) {
      console.error('Error extracting vocabulary:', error);
      toast.error(t('vocabulary.extractionFailed'));
    } finally {
      setIsExtractingVocabulary(false);
    }
  };

  const readCurrentPage = async () => {
    if (!presignedUrl) {
      toast.error(t('tts.ttsUnavailable'));
      return;
    }

    setIsPlayingPage(true);
    try {
      // First, get the PDF document to extract text
      const response = await fetch(presignedUrl);
      const pdfData = await response.arrayBuffer();
      
      // Use pdf.js to extract text from current page
      const pdf = await pdfjs.getDocument(pdfData).promise;
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      
      // Extract text from textContent
      const pageText = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => item.str)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str)
        .join(' ');

      if (!pageText.trim()) {
        toast.error('No text found on current page');
        return;
      }

      // Play the page text
      playText({
        text: pageText,
        source: 'document',
        repeat: 1,
      });
      
      toast.success(`Reading page ${pageNumber}`);
    } catch (error) {
      console.error('Error reading page:', error);
      toast.error('Failed to read page content');
    } finally {
      setIsPlayingPage(false);
    }
  };

  const handlePreviewOpen = async () => {
    setPdfLoading(true);
    setPdfError(null);
    setPageNumber(1);
    setScale(1.0);
    setPresignedUrl(null);

    // Calculate optimal PDF width based on viewport
    if (typeof window !== 'undefined') {
      const optimalWidth = Math.min(window.innerWidth * 0.85, 1200);
      setPdfWidth(optimalWidth);
    }

    try {
      // Get presigned URL for secure access
      const response = await fetch(`/api/documents/${document.id}/presigned-url`);
      if (!response.ok) {
        throw new Error('Failed to get document access URL');
      }
      
      const data = await response.json();
      setPresignedUrl(data.url);
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      setPdfError('Failed to load document. Please try again.');
      setPdfLoading(false);
    }

    await onPreviewOpen();
  };

  if (!document.s3Key) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-8 w-8"
          onClick={handlePreviewOpen}
        >
          <Eye className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-[95vw] w-full h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {truncateFileName(document.name, 50)}
          </DialogTitle>
          <DialogDescription>
            Preview and navigate through the PDF document using the controls below.
          </DialogDescription>
        </DialogHeader>
        
        {/* PDF Controls */}
        <div className="flex flex-col border-b bg-gray-50 rounded-t flex-shrink-0">
          <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {pageNumber} / {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= 3.0}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetZoom}
            >
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => presignedUrl && window.open(presignedUrl, '_blank')}
              className="flex items-center gap-1"
              disabled={!presignedUrl}
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={extractVocabularyFromCurrentPage}
              className="flex items-center gap-1"
              disabled={!presignedUrl || isExtractingVocabulary}
              title={t('vocabulary.pageExtractionHint').replace('{page}', pageNumber.toString())}
            >
              <BookOpen className="h-3 w-3" />
              {isExtractingVocabulary ? t('vocabulary.extracting') : t('vocabulary.extractFromCurrentPage')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={readCurrentPage}
              className="flex items-center gap-1"
              disabled={!presignedUrl || isPlayingPage}
              title={`Read page ${pageNumber}`}
            >
              <Volume2 className="h-3 w-3" />
              {isPlayingPage ? t('tts.playing') : t('tts.playDocument')}
            </Button>
            </div>
          </div>
          {/* Feature hints */}
          <div className="px-2 pb-2 space-y-1">
            <p className="text-xs text-gray-600 flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {t('vocabulary.currentPageOnly')}
            </p>
            <p className="text-xs text-gray-600 flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              TTS reads current page content
            </p>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-gray-100 rounded-b">
          {pdfLoading && !pdfError && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading PDF...</p>
              </div>
            </div>
          )}
          
          {pdfError && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-600 mb-2">{pdfError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => presignedUrl && window.open(presignedUrl, '_blank')}
                  disabled={!presignedUrl}
                >
                  Open in new tab
                </Button>
              </div>
            </div>
          )}

          {presignedUrl && !pdfError && (
            <div className="w-full h-full flex justify-center items-start p-2">
              <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                <PDFDocument
                  file={presignedUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading=""
                  error=""
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    width={pdfWidth}
                  />
                </PDFDocument>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 