import { useState, useEffect, useCallback } from 'react';

interface TypewriterPlaceholderProps {
  phrases: string[];
  typingSpeed?: number;
  pauseDuration?: number;
  className?: string;
}

export default function TypewriterPlaceholder({
  phrases,
  typingSpeed = 50,
  pauseDuration = 2000,
  className = '',
}: TypewriterPlaceholderProps) {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const typeNextCharacter = useCallback(() => {
    const currentPhrase = phrases[currentPhraseIndex];
    
    if (isTyping) {
      if (currentText.length < currentPhrase.length) {
        setCurrentText(currentPhrase.slice(0, currentText.length + 1));
      } else {
        // Finished typing, start pause
        setIsTyping(false);
        setIsPaused(true);
      }
    } else {
      // Erasing
      if (currentText.length > 0) {
        setCurrentText(currentText.slice(0, -1));
      } else {
        // Finished erasing, move to next phrase
        setIsTyping(true);
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    }
  }, [currentPhraseIndex, currentText, isTyping, phrases]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPaused) {
      interval = setTimeout(() => {
        setIsPaused(false);
      }, pauseDuration);
    } else {
      interval = setInterval(typeNextCharacter, typingSpeed);
    }

    return () => clearInterval(interval as unknown as number);
  }, [isPaused, pauseDuration, typeNextCharacter, typingSpeed]);

  return (
    <span className={className}>
      {currentText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

// Hook version for use with input elements
export function useTypewriterPlaceholder(phrases: string[], typingSpeed = 50, pauseDuration = 2000) {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const tick = () => {
      const currentPhrase = phrases[currentPhraseIndex];

      if (isPaused) {
        setIsPaused(false);
        setIsTyping(false);
        return;
      }

      if (isTyping) {
        setCurrentText((prev) => {
          if (prev.length < currentPhrase.length) {
            return currentPhrase.slice(0, prev.length + 1);
          }
          // Finished typing, pause then start erasing
          setTimeout(() => setIsPaused(true), pauseDuration);
          return prev;
        });
      } else {
        setCurrentText((prev) => {
          if (prev.length > 0) {
            return prev.slice(0, -1);
          }
          // Finished erasing, move to next phrase
          setIsTyping(true);
          setCurrentPhraseIndex((idx) => (idx + 1) % phrases.length);
          return prev;
        });
      }
    };

    interval = setInterval(tick, typingSpeed);

    return () => clearInterval(interval);
  }, [currentPhraseIndex, isPaused, isTyping, phrases, pauseDuration, typingSpeed]);

  return currentText;
}

// Static placeholder phrases for Argus
export const AI_PLACEHOLDER_PHRASES = [
  'What is the overall project progress this week?',
  'How many workers were on site yesterday?',
  'Which equipment has the highest breakdown rate?',
  'Are we over budget on civil works?',
  'Show me all delayed activities in piping discipline',
  'What is our current SPI and CPI?',
];
