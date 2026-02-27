import { Upload, Zap, MessageCircle, ArrowRight } from 'lucide-react';

interface StepCardProps {
  number: string;
  icon: React.ElementType;
  title: string;
  lines: string[];
}

function StepCard({ number, icon: Icon, title, lines }: StepCardProps) {
  return (
    <div className="relative bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl p-6 flex-1 min-w-[240px]">
      {/* Step number - faint background */}
      <span className="absolute top-3 left-4 text-5xl font-display font-bold text-white/[0.08] select-none">
        {number}
      </span>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Icon size={18} className="text-[#FF6A00]" />
          <h3 className="text-base font-display font-semibold text-white">{title}</h3>
        </div>
        <div className="space-y-1">
          {lines.map((line, i) => (
            <p key={i} className="text-sm text-white/50 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      icon: Upload,
      title: 'Upload',
      lines: ['Drop your site Excel.', 'Any format. Any column names. Any sheets.'],
    },
    {
      number: '02',
      icon: Zap,
      title: 'Auto-Analyse',
      lines: ['KPIs computed automatically.', 'Dashboards in seconds.'],
    },
    {
      number: '03',
      icon: MessageCircle,
      title: 'Ask Anything',
      lines: ['Plain English questions. Answered', 'from your real data.'],
    },
  ];

  return (
    <section className="py-16">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-2xl font-display font-semibold text-white text-center mb-10">
          How Argus Works
        </h2>

        <div className="flex flex-col md:flex-row items-stretch gap-4">
          {steps.map((step, index) => (
            <div key={step.number} className="contents">
              <StepCard
                number={step.number}
                icon={step.icon}
                title={step.title}
                lines={step.lines}
              />
              {/* Arrow connector - hidden on mobile */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex items-center justify-center flex-shrink-0">
                  <ArrowRight size={24} className="text-white/20" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
