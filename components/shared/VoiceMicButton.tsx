import React, { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

interface VoiceMicButtonProps {
  onResult: (text: string) => void;
  language: "en" | "fr";
  disabled?: boolean;
}

export default function VoiceMicButton({
  onResult,
  language,
  disabled = false,
}: VoiceMicButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSupported(true);
    }
  }, []);

  const getLang = (): string => {
    if (language === "en") return "en";
    // French: prefer Cameroon locale, then standard French, then bare code
    const candidates = ["fr-CM", "fr-FR", "fr"];
    for (const candidate of candidates) {
      try {
        // Attempt to create a recognition instance with the candidate to verify support
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) return candidate;
      } catch {
        continue;
      }
    }
    return "fr";
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = getLang();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onResult(transcript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={toggleListening}
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
      className={`
        inline-flex items-center justify-center h-12 w-12 rounded-xl border
        transition-colors duration-200
        ${
          isListening
            ? "bg-red-50 border-red-200 animate-pulse"
            : "bg-gray-50 border-gray-100 hover:bg-gray-100"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <Mic
        size={18}
        className={isListening ? "text-red-500" : "text-gray-500"}
      />
    </button>
  );
}
