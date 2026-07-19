import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Sleek, minimal background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      <main className="max-w-3xl mx-auto px-6 text-center space-y-8 z-10">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
          The Negotiator
        </h1>
        
        <p className="text-xl text-zinc-400 font-light max-w-xl mx-auto leading-relaxed">
          AI-powered price negotiation. Provide your details, and sit back as we secure the best possible deal over the phone.
        </p>
        
        <div className="pt-10">
          <Link 
            href="/intake"
            className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full bg-indigo-600 px-10 font-medium text-white transition-all hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)]"
          >
            <span className="mr-2 text-lg">Get Started</span>
            <svg 
              className="h-5 w-5 transition-transform group-hover:translate-x-1" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  );
}
