'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, Award, AlertTriangle, ChevronDown, ChevronUp, FileText, Clock } from 'lucide-react';
import { StepIndicator } from '@/components/StepIndicator';

type Quote = {
  company_name: string;
  total_price: number;
  rank: number;
  why_this_rank: string;
  conversation_id: string;
  call_duration_seconds?: number;
};

type Analysis = {
  ranked_quotes: Quote[];
  recommended_company: string;
  recommended_price: number;
  recommendation_explanation: string;
  warnings: { company_name: string; reason: string }[];
};

export default function ReportPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTranscripts, setOpenTranscripts] = useState<Record<string, string | null>>({});
  const [loadingTranscripts, setLoadingTranscripts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const confirmed = sessionStorage.getItem('confirmedIntakeData');
    if (!confirmed) {
      router.push('/intake');
      return;
    }
    
    fetchAnalysis();
  }, [router]);

  const fetchAnalysis = async () => {
    try {
      const stored = localStorage.getItem('negotiator_quotes');
      const quotes = stored ? JSON.parse(stored) : [];
      
      if (!quotes || quotes.length === 0) {
        throw new Error("No quotes available to analyze");
      }

      const res = await fetch('/api/analyze-quotes', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotes })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze quotes");
      }
      
      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTranscript = async (conversationId: string) => {
    if (openTranscripts[conversationId] !== undefined) {
      // Toggle off by setting it to undefined/null if we wanted to close, or just track open state.
      // Actually let's just close if it's already open
      setOpenTranscripts(prev => {
        const next = { ...prev };
        if (next[conversationId]) {
          delete next[conversationId];
        }
        return next;
      });
      return;
    }

    setLoadingTranscripts(prev => ({ ...prev, [conversationId]: true }));
    try {
      const res = await fetch(`/api/get-transcript?conversationId=${conversationId}`);
      const data = await res.json();
      if (data.success) {
        setOpenTranscripts(prev => ({ ...prev, [conversationId]: data.transcript }));
      } else {
        setOpenTranscripts(prev => ({ ...prev, [conversationId]: "Failed to load transcript." }));
      }
    } catch (e) {
      setOpenTranscripts(prev => ({ ...prev, [conversationId]: "Error loading transcript." }));
    } finally {
      setLoadingTranscripts(prev => ({ ...prev, [conversationId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
        <h2 className="text-2xl font-bold text-white">Analyzing your quotes...</h2>
        <p className="text-zinc-400 mt-2">Our AI is reviewing transcripts and extracting final pricing.</p>
      </div>
    );
  }

  if (error) {
    // Empty state or actual error
    if (error.includes("No quotes")) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white p-8">
          <main className="max-w-4xl mx-auto">
            <StepIndicator currentStep={4} />
            <div className="border border-zinc-800 rounded-2xl p-10 bg-zinc-900/50 shadow-xl text-center">
              <h1 className="text-3xl font-bold tracking-tight mb-4">No Quotes Yet</h1>
              <p className="text-zinc-400 mb-8">We haven't gathered any quotes for your job spec yet. Start a call from the dashboard to begin negotiations.</p>
              <button 
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </main>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
        <p className="text-red-500 text-lg mb-4">Analysis Failed: {error}</p>
        <button onClick={() => router.push('/dashboard')} className="px-6 py-2 bg-zinc-800 rounded-lg">Back</button>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <main className="max-w-4xl mx-auto pb-20">
        <StepIndicator currentStep={4} />

        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Final Negotiation Report</h1>
          <p className="text-zinc-400 mt-2 text-lg">AI-powered analysis and ranking of your gathered quotes.</p>
        </header>

        {/* Top Recommendation Card */}
        <div className="mb-12 relative overflow-hidden rounded-3xl border-2 border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-zinc-900/80 p-8 shadow-[0_0_50px_-12px_rgba(79,70,229,0.3)]">
          <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest">
            Top Recommendation
          </div>
          
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
              <Award className="w-8 h-8 text-indigo-400" />
            </div>
            
            <div className="flex-1">
              <h2 className="text-3xl font-extrabold text-white mb-1">{analysis.recommended_company}</h2>
              <div className="text-4xl font-black text-indigo-400 mb-6 tracking-tight">
                ${analysis.recommended_price?.toLocaleString() || 'N/A'}
              </div>
              
              <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Why this deal?</h3>
                <p className="text-zinc-200 leading-relaxed text-lg">
                  {analysis.recommendation_explanation}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Warnings Section */}
        {analysis.warnings && analysis.warnings.length > 0 && (
          <div className="mb-12 border border-orange-500/30 bg-orange-500/5 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-orange-500 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-6 h-6" /> Suspicious Quotes Flagged
            </h3>
            <div className="space-y-4">
              {analysis.warnings.map((warn, idx) => (
                <div key={idx} className="bg-zinc-950 border border-orange-500/20 p-4 rounded-xl">
                  <span className="font-bold text-zinc-200 block mb-1">{warn.company_name}</span>
                  <p className="text-orange-400/90 text-sm">{warn.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ranked Quotes */}
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          Quote Rankings
        </h3>
        
        <div className="space-y-6">
          {analysis.ranked_quotes.map((quote) => {
            const isTranscriptOpen = openTranscripts[quote.conversation_id] !== undefined;
            const isLoadingTranscript = loadingTranscripts[quote.conversation_id];

            return (
              <div key={quote.conversation_id} className="border border-zinc-800 bg-zinc-900/40 rounded-2xl overflow-hidden transition-all hover:border-zinc-700">
                <div className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                  
                  {/* Rank Badge */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 ${
                    quote.rank === 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    #{quote.rank}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-1">{quote.company_name}</h4>
                    <p className="text-zinc-400 text-sm mb-3">{quote.why_this_rank}</p>
                    <button 
                      onClick={() => toggleTranscript(quote.conversation_id)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 uppercase tracking-wider"
                    >
                      {isLoadingTranscript ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                      {isTranscriptOpen ? 'Hide Transcript' : 'View Transcript Evidence'}
                    </button>
                    {quote.call_duration_seconds !== undefined && quote.call_duration_seconds > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-zinc-500 bg-zinc-900/50 inline-flex px-2 py-1 rounded-md border border-zinc-800">
                        <Clock className="w-3 h-3" />
                        {Math.floor(quote.call_duration_seconds / 60)}m {quote.call_duration_seconds % 60}s call duration
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold text-zinc-500 uppercase tracking-widest block mb-1">Total</span>
                    <span className="text-2xl font-bold text-white">${quote.total_price?.toLocaleString() || 'N/A'}</span>
                  </div>
                </div>

                {/* Expandable Transcript */}
                {isTranscriptOpen && (
                  <div className="border-t border-zinc-800 bg-zinc-950 p-6">
                    <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Raw Call Transcript</h5>
                    <div className="font-mono text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {openTranscripts[quote.conversation_id]}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-16 flex justify-center border-t border-zinc-800 pt-8">
            <button 
              onClick={async () => {
                if(confirm('Clear all quotes from storage?')) {
                  localStorage.removeItem('negotiator_quotes');
                  window.location.reload();
                }
              }}
              className="px-6 py-3 bg-red-950/40 text-red-400 font-medium rounded-xl border border-red-900/50 hover:bg-red-900/60 transition-colors"
            >
              [DEV] Clear All Quotes
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
