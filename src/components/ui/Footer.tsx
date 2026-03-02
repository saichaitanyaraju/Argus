import { useAIHealth } from '../../hooks/useAIHealth';

export default function Footer() {
  const { isOnline } = useAIHealth();

  return (
    <footer className="w-full py-8 border-t border-[rgba(255,255,255,0.06)]">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-center text-xs text-gray-500">
          Argus v1.0 - Built for construction project control
          {isOnline ? ' - Powered by open-source LLM' : ''}
        </p>
      </div>
    </footer>
  );
}

