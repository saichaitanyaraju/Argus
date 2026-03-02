import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Command, Loader2 } from 'lucide-react';
import { AI_PLACEHOLDER_PHRASES, useTypewriterPlaceholder } from './TypewriterPlaceholder';
import { checkAgentHealth, getAgentFriendlyErrorMessage } from '../../lib/lyzrAgent';

interface AIAskBarProps {
  autoFocus?: boolean;
  initialValue?: string;
  onSubmit?: (question: string) => void;
}

const QUICK_PROMPTS = [
  'Overall project progress',
  'Manpower variance today',
  'Cost overrun summary',
];

export default function AIAskBar({ autoFocus = false, initialValue = '', onSubmit }: AIAskBarProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState('');

  const placeholderText = useTypewriterPlaceholder(AI_PLACEHOLDER_PHRASES, 50, 2000);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = useCallback(async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isCheckingHealth) return;

    if (onSubmit) {
      onSubmit(trimmedQuestion);
      return;
    }

    setHealthError('');
    setIsCheckingHealth(true);

    const health = await checkAgentHealth();
    setIsCheckingHealth(false);

    if (!health.ok) {
      setHealthError(getAgentFriendlyErrorMessage(health.errorCode));
      return;
    }

    navigate(`/dashboard?q=${encodeURIComponent(trimmedQuestion)}&autoask=true`);
  }, [question, navigate, onSubmit, isCheckingHealth]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleSubmit();
    }
  };

  const handleQuickPromptClick = (prompt: string) => {
    setQuestion(prompt);
    setHealthError('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`flex items-center gap-3 h-14 px-4 bg-[rgba(255,255,255,0.06)] border rounded-2xl transition-all duration-200 ${
          isFocused
            ? 'border-[#FF6A00] ring-2 ring-[#FF6A00]/20'
            : 'border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.2)]'
        }`}
      >
        <div className="flex-shrink-0">
          <Sparkles
            size={20}
            className={`text-[#FF6A00] ${isFocused ? 'animate-pulse' : ''}`}
          />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (healthError) setHealthError('');
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/30 outline-none"
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => inputRef.current?.focus()}
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/40 text-xs hover:bg-white/10 hover:text-white/60 transition-colors"
          >
            <Command size={10} />
            <span>K</span>
          </button>

          <button
            onClick={() => void handleSubmit()}
            disabled={!question.trim() || isCheckingHealth}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6A00] hover:bg-[#FF8C38] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isCheckingHealth ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Checking...
              </>
            ) : (
              <>
                Ask Argus
                <span className="text-xs">→</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleQuickPromptClick(prompt)}
            className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.15)] text-xs px-3 py-1.5 text-white/50 hover:border-[#FF6A00] hover:text-white/70 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {healthError && <p className="mt-3 text-center text-xs text-red-300/90">{healthError}</p>}
    </div>
  );
}
