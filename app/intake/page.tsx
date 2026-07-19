'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2, Plus, X, Mic, Square } from 'lucide-react';
import { useConversation, ConversationProvider } from '@elevenlabs/react';
import { StepIndicator } from '@/components/StepIndicator';

const extractFramesFromVideo = (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    video.onloadeddata = async () => {
      try {
        const frames: string[] = [];
        const duration = video.duration;
        const numFrames = 8;
        const interval = duration / numFrames;
        
        const canvas = document.createElement('canvas');
        const maxDim = 512;
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.floor(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.floor(width * (maxDim / height));
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("No canvas context"));

        for (let i = 1; i <= numFrames; i++) {
          const time = Math.min(i * interval, duration - 0.1);
          video.currentTime = time;
          
          await new Promise<void>((r) => {
            video.onseeked = () => r();
          });
          
          ctx.drawImage(video, 0, 0, width, height);
          frames.push(canvas.toDataURL('image/jpeg', 0.8));
        }
        URL.revokeObjectURL(url);
        resolve(frames);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video load error"));
    };
  });
};

function IntakeContent() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'edit-inventory' | 'voice' | 'processing-voice'>('form');
  const [isUploading, setIsUploading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  
  // Voice SDK
  const conversation = useConversation({
    onConnect: () => console.log('[Voice Intake] Connected to agent'),
    onDisconnect: () => console.log('[Voice Intake] Disconnected from agent'),
    onError: (error) => console.error('[Voice Intake] Error:', error),
  });

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    origin: '',
    destination: '',
    moveDate: '',
    homeSize: '1BR',
    textInventory: '',
    specialItems: '',
    stairsInfo: '',
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [extractedItems, setExtractedItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState('');

  // Load existing pending data if we came back from Confirm screen
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingIntakeData');
    if (pending) {
      try {
        const d = JSON.parse(pending);
        setFormData(prev => ({
          ...prev,
          firstName: d.customer_name?.split(' ')[0] || '',
          lastName: d.customer_name?.split(' ').slice(1).join(' ') || '',
          email: d.email || '',
          phone: d.phone || '',
          origin: d.origin || '',
          destination: d.destination || '',
          moveDate: d.move_date || '',
          homeSize: d.home_size || '1BR',
          textInventory: d.item_summary || '',
          specialItems: d.special_items || '',
          stairsInfo: d.stairs_info || ''
        }));
      } catch (e) {}
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: {'video/*': ['.mp4', '.mov', '.avi']} 
  });

  const handleChange = (e: any) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = async (e: any) => {
    e.preventDefault();
    setVisionError(null);

    if (videoFile) {
      setIsUploading(true);
      try {
        const frames = await extractFramesFromVideo(videoFile);
        const res = await fetch('/api/vision-intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frames })
        });
        
        const data = await res.json();
        setIsUploading(false);

        if (!res.ok) {
          setVisionError(data.error || "Failed to process video");
          return;
        }

        if (data.items && Array.isArray(data.items)) {
          setExtractedItems(data.items);
          setStep('edit-inventory');
        } else {
          setVisionError("Invalid response format from Vision API");
        }
      } catch (err: any) {
        setIsUploading(false);
        setVisionError(err.message || "An error occurred extracting frames.");
        console.error("Frame extraction/API failed", err);
      }
    } else {
      generateFinalData([]);
    }
  };

  const removeItem = (idx: number) => {
    setExtractedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    if (newItemText.trim()) {
      setExtractedItems(prev => [...prev, newItemText.trim()]);
      setNewItemText('');
    }
  };

  const generateFinalData = (videoInventoryArray: string[]) => {
    const videoInventoryStr = videoInventoryArray.join(', ');
    const mergedInventory = [formData.textInventory.trim(), videoInventoryStr.trim()].filter(Boolean).join(', ');

    const finalJson = {
      customer_name: `${formData.firstName} ${formData.lastName}`.trim() || formData.firstName,
      email: formData.email,
      phone: formData.phone,
      origin: formData.origin,
      destination: formData.destination,
      distance_miles: "", 
      move_date: formData.moveDate,
      home_size: formData.homeSize,
      item_summary: mergedInventory,
      special_items: formData.specialItems,
      stairs_info: formData.stairsInfo,
      best_quote_so_far: ""
    };

    sessionStorage.setItem('pendingIntakeData', JSON.stringify(finalJson));
    router.push('/intake/confirm');
  };

  const handleConfirmEdit = () => {
    generateFinalData(extractedItems);
  };

  const startVoice = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_INTAKE_AGENT_ID,
      });
      setStep('voice');
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Microphone access is required for the voice interview.');
    }
  };

  const endVoice = async () => {
    const cid = conversation.getId();
    await conversation.endSession();
    
    if (cid) {
      setStep('processing-voice');
      try {
        await new Promise(r => setTimeout(r, 2000));
        const res = await fetch('/api/parse-intake-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: cid })
        });
        
        const result = await res.json();
        
        if (result.success && result.data) {
          const d = result.data;
          const voiceData = {
            ...d,
            distance_miles: "",
            best_quote_so_far: ""
          };
          sessionStorage.setItem('pendingIntakeData', JSON.stringify(voiceData));
          router.push('/intake/confirm');
        } else {
          alert("Failed to parse transcript: " + (result.error || "Unknown Error"));
          setStep('form');
        }
      } catch (e) {
        console.error("Failed to fetch transcript parse", e);
        alert("An error occurred extracting data from your voice interview.");
        setStep('form');
      }
    } else {
      setStep('form');
    }
  };

  // --- Render Steps ---

  if (step === 'processing-voice') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8 flex flex-col items-center justify-center">
        <StepIndicator currentStep={1} />
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-indigo-500 mb-4" />
          <h2 className="text-2xl font-bold">Extracting Data...</h2>
          <p className="text-zinc-400 mt-2">Our AI is parsing your voice interview into structured intake data.</p>
        </div>
      </div>
    );
  }

  if (step === 'voice') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-3xl mb-8"><StepIndicator currentStep={1} /></div>
        <div className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-10 text-center shadow-xl">
          <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
             <div className="absolute inset-0 rounded-full border-2 border-indigo-500 animate-ping opacity-20"></div>
             <Mic className="w-10 h-10 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Listening...</h2>
          <p className="text-zinc-400 mb-8">
            Speak naturally with our assistant about your move. Describe your origin, destination, items, and any special requirements.
          </p>
          <div className="mb-8">
             <p className="text-sm font-semibold text-indigo-400">Agent Status: {conversation.status}</p>
          </div>
          <button 
            type="button"
            onClick={endVoice}
            className="w-full py-4 bg-zinc-100 text-black font-semibold rounded-xl hover:bg-zinc-300 transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <Square className="w-5 h-5" fill="currentColor" /> Finish Interview
          </button>
        </div>
      </div>
    );
  }

  if (step === 'edit-inventory') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8">
        <div className="max-w-3xl mx-auto"><StepIndicator currentStep={1} /></div>
        <main className="max-w-2xl mx-auto border border-zinc-800 rounded-2xl p-8 bg-zinc-900/50 shadow-xl">
          <div className="mb-6 border-b border-zinc-800 pb-4">
            <h1 className="text-2xl font-bold">Verify Extracted Inventory</h1>
            <p className="text-zinc-400 mt-2">Our AI analyzed your video. Please remove any incorrect items or add missing ones before proceeding.</p>
          </div>
          
          <div className="space-y-3 mb-8">
            {extractedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-zinc-800/50 px-4 py-3 rounded-lg border border-zinc-700">
                <span>{item}</span>
                <button type="button" onClick={() => removeItem(idx)} className="text-zinc-400 hover:text-red-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
            {extractedItems.length === 0 && <p className="text-zinc-500 italic">No items found.</p>}
          </div>

          <div className="flex gap-2 mb-8">
            <input 
              value={newItemText} 
              onChange={e => setNewItemText(e.target.value)} 
              placeholder="Add another item..." 
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 outline-none focus:border-indigo-500"
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
            <button type="button" onClick={addItem} className="px-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-4">
            <button type="button" onClick={() => setStep('form')} className="flex-1 px-4 py-3 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors">
              Back to Form
            </button>
            <button type="button" onClick={handleConfirmEdit} className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
              Confirm Inventory
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <main className="max-w-3xl mx-auto">
        <StepIndicator currentStep={1} />
        
        <div className="border border-zinc-800 rounded-2xl p-10 bg-zinc-900/50 shadow-xl">
          <header className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Job Details</h1>
            <p className="text-zinc-400 mt-2">Provide the details of your move so we can begin negotiations.</p>
          </header>

          <div className="mb-10 p-8 border border-indigo-500/20 bg-indigo-500/5 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
              <Mic className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Too much to type?</h2>
            <p className="text-zinc-400 mb-6 max-w-md">Have a quick 2-minute voice conversation with our AI intake assistant instead.</p>
            <button 
              type="button" 
              onClick={startVoice}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              <Mic className="w-5 h-5" /> Start Voice Interview
            </button>
          </div>
          
          <div className="relative flex py-8 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink-0 mx-4 text-sm text-zinc-500 font-medium tracking-widest uppercase">Or Fill Manually</span>
              <div className="flex-grow border-t border-zinc-800"></div>
          </div>

          {visionError && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl mb-8 flex items-center gap-3">
              <X className="w-5 h-5 shrink-0" />
              <span><strong>Vision Error:</strong> {visionError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-10">
            
            <section>
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs">1</span>
                Contact Info
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">First Name <span className="text-red-500">*</span></label>
                  <input required name="firstName" value={formData.firstName} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Last Name <span className="text-red-500">*</span></label>
                  <input required name="lastName" value={formData.lastName} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Email <span className="text-red-500">*</span></label>
                  <input required name="email" type="email" value={formData.email} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Phone Number <span className="text-red-500">*</span></label>
                  <input required name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs">2</span>
                Move Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Origin (City, State) <span className="text-red-500">*</span></label>
                  <input required name="origin" value={formData.origin} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Destination (City, State) <span className="text-red-500">*</span></label>
                  <input required name="destination" value={formData.destination} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Move Date <span className="text-red-500">*</span></label>
                  <input required name="moveDate" placeholder="e.g. Aug 15th" value={formData.moveDate} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Home Size <span className="text-red-500">*</span></label>
                  <select name="homeSize" value={formData.homeSize} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors">
                    <option value="Studio">Studio</option>
                    <option value="1BR">1 Bedroom</option>
                    <option value="2BR">2 Bedroom</option>
                    <option value="3BR">3 Bedroom</option>
                    <option value="4BR+">4+ Bedroom</option>
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs">3</span>
                Inventory & Access
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Text Inventory</label>
                  <textarea name="textInventory" placeholder="sofa, queen bed, 15 boxes..." value={formData.textInventory} onChange={handleChange} rows={3} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Video Walkthrough (AI Extracted)</label>
                  <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30'}`}>
                    <input {...getInputProps()} />
                    <UploadCloud className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                    {videoFile ? (
                      <p className="font-medium text-indigo-400">{videoFile.name}</p>
                    ) : (
                      <p className="text-zinc-400">Drag & drop a video, or click to browse</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Special/Heavy Items</label>
                    <textarea name="specialItems" placeholder="e.g. Piano, Safe" value={formData.specialItems} onChange={handleChange} rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Stairs / Elevator Access</label>
                    <textarea name="stairsInfo" placeholder="e.g. 2 flights of stairs" value={formData.stairsInfo} onChange={handleChange} rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
              </div>
            </section>

            <div className="pt-6">
              <button type="submit" disabled={isUploading} className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 text-lg">
                {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing Media...</> : 'Continue to Confirmation'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function IntakePageWrapper() {
  return (
    <ConversationProvider>
      <IntakeContent />
    </ConversationProvider>
  );
}
