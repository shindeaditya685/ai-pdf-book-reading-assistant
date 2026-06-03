import { useEffect } from 'react';
import { usePDFStore } from '@/store/use-pdf-store';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

export function SummaryPanel() {
  const {
    showSummarizer,
    setShowSummarizer,
    summaryLoading,
    summaryContent,
    summaryError,
    generateSummaryStart,
    generateSummarySuccess,
    generateSummaryError,
    addSavedSummary,
    clearSummary,
    currentPage,
    ocrText,
    pdfFileName,
  } = usePDFStore();

  const { toast } = useToast();

  // Fetch page text for current page (prefer OCR if available)
  const pageText = ocrText[currentPage]?.text || '';

  const handleGenerate = async () => {
    if (!pageText) return;
    generateSummaryStart();
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pageText, format: 'concise' }),
      });
      const data = await res.json();
      if (data && typeof data.summary === 'string') {
        generateSummarySuccess(data.summary);
        addSavedSummary(data.summary);
      } else {
        generateSummaryError('Invalid response');
      }
    } catch (e) {
      generateSummaryError(e instanceof Error ? e.message : 'Failed to summarize');
    }
  };

  const handleCopy = async () => {
    if (!summaryContent) return;
    try {
      await navigator.clipboard.writeText(summaryContent);
      toast({
        title: 'Copied to clipboard',
        description: 'Summary has been copied.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy summary.',
        variant: 'destructive',
      });
    }
  };

  // Auto‑generate when panel opens
  useEffect(() => {
    if (showSummarizer && !summaryContent && !summaryLoading) {
      handleGenerate();
    }
  }, [showSummarizer]);

  if (!showSummarizer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-xl bg-background p-6 shadow-2xl">
        {/* Close X */}
        <button
          className="absolute right-2 top-2 h-6 w-6 rounded-full bg-muted/50 hover:bg-muted/80 flex items-center justify-center"
          onClick={() => {
            setShowSummarizer(false);
            clearSummary();
          }}
          aria-label="Close summary panel"
        >
          ✕
        </button>
        <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Summarize Page
        </h2>
        {summaryLoading && <p className="text-muted-foreground">Generating summary…</p>}
        {summaryError && <p className="text-red-500">{summaryError}</p>}
        {summaryContent && (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap">{summaryContent}</p>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              onClick={handleCopy}
            >
              Copy to Clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
