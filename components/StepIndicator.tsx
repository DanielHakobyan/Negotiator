import { Check } from 'lucide-react';

const steps = [
  { id: 1, name: 'Details' },
  { id: 2, name: 'Confirm' },
  { id: 3, name: 'Calls' },
  { id: 4, name: 'Report' }
];

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="flex items-center justify-center">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
            {step.id < currentStep ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-indigo-600" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700">
                  <Check className="h-5 w-5 text-white" aria-hidden="true" />
                  <span className="sr-only">{step.name}</span>
                </div>
              </>
            ) : step.id === currentStep ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-zinc-800" />
                </div>
                <div
                  className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-zinc-950"
                  aria-current="step"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" aria-hidden="true" />
                  <span className="sr-only">{step.name}</span>
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-zinc-800" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-800 bg-zinc-950 hover:border-zinc-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-transparent" aria-hidden="true" />
                  <span className="sr-only">{step.name}</span>
                </div>
              </>
            )}
            {/* Step Label */}
            <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium ${step.id <= currentStep ? 'text-indigo-500' : 'text-zinc-500'}`}>
              {step.name}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
