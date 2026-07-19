'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PhoneCall, Loader2, ArrowRight, Activity, Search, MapPin, Star, Plus, Target } from 'lucide-react';
import { StepIndicator } from '@/components/StepIndicator';

export default function Dashboard() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [intakeData, setIntakeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bestQuote, setBestQuote] = useState<{ price: number, company: string } | null>(null);

  // Company Search State
  const [searchLocation, setSearchLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  
  // Dev Override State
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPhone, setCustomPhone] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('confirmedIntakeData');
    if (!stored) {
      router.push('/intake');
      return;
    }
    const parsed = JSON.parse(stored);
    setIntakeData(parsed);
    if (parsed.origin) {
      // Basic extraction of city if origin is full address, else use as is
      const parts = parsed.origin.split(',');
      setSearchLocation(parts[0].trim());
    }
    setIsLoading(false);
    fetchQuotes();
  }, [router]);

  const fetchQuotes = async () => {
    try {
      const res = await fetch('/api/quotes');
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        // Find the lowest price quote with NO red flags
        const validQuotes = data.data.filter((q: any) => !q.red_flags || q.red_flags.length === 0);
        if (validQuotes.length > 0) {
          const best = validQuotes.reduce((prev: any, current: any) => {
            return (prev.total_price < current.total_price) ? prev : current;
          });
          setBestQuote({ price: best.total_price, company: best.company_name });
        } else {
          setBestQuote(null);
        }
      } else {
        setBestQuote(null);
      }
    } catch (e) {
      console.error("Failed to fetch quotes for leverage", e);
    }
  };

  const handleStartCall = async (targetPhone?: string) => {
    setIsProcessing(true);
    setCallStatus(`Initiating secure outbound call ${targetPhone ? `to ${targetPhone}` : ''}...`);
    try {
      const payload = intakeData ? { ...intakeData } : {};
      if (targetPhone) {
        payload.to_number = targetPhone;
      }
      
      if (bestQuote) {
        payload.best_quote_so_far = `$${bestQuote.price.toLocaleString()} from ${bestQuote.company}`;
      }
      
      const response = await fetch('/api/twilio/outbound', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (response.ok) {
        setCallStatus(`Call initiated successfully! Monitoring stream (SID: ${data.callSid})`);
      } else {
        setCallStatus(`Error: ${data.error}`);
      }
    } catch (error: any) {
      setCallStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncCall = async () => {
    setIsSyncing(true);
    setCallStatus('Fetching latest call from ElevenLabs and extracting quote...');
    try {
      const response = await fetch('/api/sync-latest-call', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        setCallStatus(`Sync complete! Quote saved for: ${data.quote?.company_name || 'Unknown Company'}`);
        fetchQuotes(); // Refresh leverage baseline after syncing a new quote
      } else {
        setCallStatus(`Sync Error: ${data.error} - ${data.details || ''}`);
      }
    } catch (error: any) {
      setCallStatus(`Sync Error: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearchCompanies = async () => {
    if (!searchLocation.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/find-companies?location=${encodeURIComponent(searchLocation)}`);
      const data = await res.json();
      if (data.success) {
        setCompanies(data.companies);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddCustomCompany = () => {
    if (!customName || !customPhone) return;
    const newCompany = {
      name: customName,
      phone: customPhone,
      displayPhone: customPhone,
      rating: null,
      review_count: 0,
      address: 'Custom Dev Entry',
      place_id: `custom_${Date.now()}`,
      isCustom: true
    };
    setCompanies(prev => [newCompany, ...prev]);
    setShowCustomForm(false);
    setCustomName('');
    setCustomPhone('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <main className="max-w-4xl mx-auto">
        <StepIndicator currentStep={3} />

        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Active Operations</h1>
          <p className="text-zinc-400 mt-2">Job spec locked. Ready to dispatch our AI to negotiate on your behalf.</p>
        </header>

        {bestQuote && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-3 text-emerald-400"
          >
            <Target className="w-5 h-5 shrink-0" />
            <p className="font-semibold text-sm sm:text-base">
              Active Leverage: Using <span className="text-emerald-300 font-bold">${bestQuote.price.toLocaleString()} ({bestQuote.company})</span> as baseline for next call.
            </p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-zinc-800 rounded-2xl p-10 bg-zinc-900/50 flex flex-col items-center justify-center text-center shadow-xl"
          >
            <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6 relative">
              {isProcessing && (
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500 animate-ping opacity-20"></div>
              )}
              <PhoneCall className={`w-10 h-10 text-indigo-500 ${isProcessing ? 'animate-pulse' : ''}`} />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Live Negotiation</h2>
            <p className="text-zinc-400 max-w-md mb-8">
              We will call local moving companies, provide your verified inventory, and negotiate the lowest possible rate.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
              <button 
                onClick={() => handleStartCall()}
                disabled={isProcessing || isSyncing}
                className="flex-1 py-4 px-6 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                {isProcessing ? 'Dispatching...' : 'TEST DIRECT CALL'}
              </button>
              
              <button 
                onClick={handleSyncCall}
                disabled={isProcessing || isSyncing}
                className="flex-1 py-4 px-6 bg-zinc-800 text-white font-semibold rounded-xl hover:bg-zinc-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                {isSyncing ? 'Syncing...' : 'SYNC COMPLETED CALL'}
              </button>
            </div>

            {callStatus && (
              <div className="mt-8 p-6 bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-lg flex items-start gap-4 text-left">
                <Activity className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-zinc-200 mb-1">System Status</h3>
                  <p className="text-sm text-zinc-400 font-mono break-words">
                    {callStatus}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Find Companies Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border border-zinc-800 rounded-2xl p-8 bg-zinc-900/30 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-1">Local Call List</h3>
                <p className="text-zinc-400 text-sm">Find real moving companies in your area to negotiate with.</p>
              </div>
              <MapPin className="w-8 h-8 text-zinc-500 opacity-50" />
            </div>

            <div className="flex gap-3 mb-8">
              <input 
                type="text" 
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                placeholder="City (e.g. Los Angeles, CA)"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-transparent text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleSearchCompanies()}
              />
              <button 
                onClick={handleSearchCompanies}
                disabled={isSearching}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Search
              </button>
            </div>

            {/* Dev Only Override */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-6 border-b border-zinc-800 pb-6">
                {!showCustomForm ? (
                  <button 
                    onClick={() => setShowCustomForm(true)}
                    className="text-sm font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> [DEV] Add Custom Company Override
                  </button>
                ) : (
                  <div className="flex gap-3 items-end bg-purple-900/10 p-4 rounded-xl border border-purple-500/20">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-zinc-400 block mb-1">Company Name</label>
                      <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm" placeholder="My Test Co" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-zinc-400 block mb-1">Phone Number</label>
                      <input type="text" value={customPhone} onChange={e => setCustomPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm" placeholder="+1234567890" />
                    </div>
                    <button onClick={handleAddCustomCompany} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm">Add</button>
                    <button onClick={() => setShowCustomForm(false)} className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm">Cancel</button>
                  </div>
                )}
              </div>
            )}

            {/* Results List */}
            <div className="space-y-4">
              {companies.map((company) => (
                <div key={company.place_id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-xl border ${company.isCustom ? 'bg-purple-900/10 border-purple-500/30' : 'bg-zinc-950 border-zinc-800'} gap-4`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-lg">{company.name}</h4>
                      {company.isCustom && <span className="text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded-full">Custom</span>}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      {company.rating ? (
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="font-medium text-zinc-300">{company.rating}</span>
                          <span>({company.review_count})</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500">No ratings</span>
                      )}
                      <span className="font-mono text-zinc-300">{company.displayPhone}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleStartCall(company.phone)}
                    disabled={isProcessing}
                    className="shrink-0 px-5 py-2.5 bg-zinc-800 hover:bg-indigo-600 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Call This Company
                  </button>
                </div>
              ))}
              
              {companies.length === 0 && !isSearching && (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  Search a city above to find real companies, or use the dev override to add your own phone number.
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="mt-12 flex justify-end">
          <button 
            onClick={() => router.push('/report')}
            className="px-6 py-3 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors flex items-center gap-2"
          >
            View Final Report <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
