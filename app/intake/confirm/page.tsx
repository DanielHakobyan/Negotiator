'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { StepIndicator } from '@/components/StepIndicator';

export default function ConfirmIntakePage() {
  const router = useRouter();
  const [finalData, setFinalData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const pending = sessionStorage.getItem('pendingIntakeData');
    if (!pending) {
      router.push('/intake');
      return;
    }
    try {
      setFinalData(JSON.parse(pending));
    } catch (e) {
      router.push('/intake');
    }
    setIsLoading(false);
  }, [router]);

  if (isLoading || !finalData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  const handleEdit = () => {
    router.push('/intake');
  };

  const handleConfirm = () => {
    sessionStorage.setItem('confirmedIntakeData', JSON.stringify(finalData));
    sessionStorage.removeItem('pendingIntakeData');
    router.push('/dashboard');
  };

  const requiredFields = ['customer_name', 'email', 'phone', 'origin', 'destination', 'move_date'];
  const missingFields = requiredFields.filter(f => !finalData[f] || finalData[f].toString().trim() === "");

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <main className="max-w-3xl mx-auto">
        <StepIndicator currentStep={2} />
        
        <div className="border border-zinc-800 rounded-2xl p-10 bg-zinc-900/50 shadow-xl">
          <div className="flex flex-col items-center text-center mb-8 border-b border-zinc-800 pb-8">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Review & Confirm</h1>
            <p className="text-zinc-400 mt-2 max-w-md">Verify the extracted details below. If anything is missing or incorrect, click Edit.</p>
          </div>

          {missingFields.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl mb-8 flex gap-4">
              <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
              <div>
                <strong className="text-lg text-red-500 block mb-1">Missing Required Fields</strong>
                <p className="text-red-400/80 mb-3">The AI voice extraction did not capture all required fields. Please click <b>Edit</b> to manually provide:</p>
                <ul className="list-disc ml-5 font-mono text-sm text-red-400">
                  {missingFields.map(f => <li key={f}>{f.replace('_', ' ')}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-8 mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Name</span>
                <p className={`text-lg ${!finalData.customer_name ? "text-red-400 font-medium" : "text-zinc-100"}`}>
                  {finalData.customer_name || 'MISSING'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Phone</span>
                <p className={`text-lg ${!finalData.phone ? "text-red-400 font-medium" : "text-zinc-100"}`}>
                  {finalData.phone || 'MISSING'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Email</span>
                <p className={`text-lg ${!finalData.email ? "text-red-400 font-medium" : "text-zinc-100"}`}>
                  {finalData.email || 'MISSING'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Move Date</span>
                <p className={`text-lg ${!finalData.move_date ? "text-red-400 font-medium" : "text-zinc-100"}`}>
                  {finalData.move_date || 'MISSING'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Origin</span>
                <p className={`text-lg ${!finalData.origin ? "text-red-400 font-medium" : "text-zinc-100"}`}>
                  {finalData.origin || 'MISSING'}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Destination</span>
                <p className={`text-lg ${!finalData.destination ? "text-red-400 font-medium" : "text-zinc-100"}`}>
                  {finalData.destination || 'MISSING'}
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-8 space-y-6">
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Home Size</span>
                <p className="text-lg text-zinc-100">{finalData.home_size}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Inventory Summary</span>
                <p className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-zinc-300 leading-relaxed min-h-[80px]">
                  {finalData.item_summary || 'None specified'}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Special Items</span>
                  <p className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-zinc-300 min-h-[60px]">
                    {finalData.special_items || 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Stairs / Access</span>
                  <p className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-zinc-300 min-h-[60px]">
                    {finalData.stairs_info || 'None'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleEdit} 
              className="px-6 py-4 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" /> Edit Details
            </button>
            <button 
              onClick={handleConfirm} 
              disabled={missingFields.length > 0}
              className={`flex-1 px-6 py-4 font-semibold text-lg rounded-xl transition-all ${
                missingFields.length > 0 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              Confirm & Lock Job Spec
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
