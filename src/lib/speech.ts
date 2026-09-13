// Обёртка над нативным Web Speech API для распознавания русской речи в браузере (iOS Safari, Chrome, Android)

export interface SpeechController {
  start: () => void;
  stop: () => void;
  abort: () => void;
  isSupported: boolean;
}

export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

interface SpeechOptions {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export function createSpeechRecognizer(options: SpeechOptions): SpeechController {
  if (!isSpeechSupported()) {
    return {
      start: () => options.onError?.('Голосовой ввод не поддерживается браузером. Воспользуйтесь клавиатурой или кнопкой микрофона на клавиатуре iPhone.'),
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  const SpeechAPI = (window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }).SpeechRecognition || (window as unknown as {
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }).webkitSpeechRecognition;

  if (!SpeechAPI) {
    return {
      start: () => options.onError?.('Распознавание речи недоступно.'),
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  let recognition: SpeechRecognitionInstance | null = null;
  let manualStop = false;

  try {
    recognition = new SpeechAPI();
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      manualStop = false;
      options.onStart?.();
    };

    recognition.onresult = (event: SpeechRecognitionEventInstance) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const fullText = (finalTranscript || interimTranscript).trim();
      if (fullText) {
        options.onResult(fullText, !!finalTranscript);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        options.onError?.('Доступ к микрофону заблокирован. Разрешите доступ в настройках браузера.');
        return;
      }
      options.onError?.(`Ошибка микрофона: ${event.error}`);
    };

    recognition.onend = () => {
      if (!manualStop) {
        options.onEnd?.();
      }
    };
  } catch (e) {
    console.error('Failed to init SpeechRecognition', e);
  }

  return {
    start: () => {
      manualStop = false;
      try {
        recognition?.start();
      } catch (e) {
        console.warn('SpeechRecognition start error:', e);
      }
    },
    stop: () => {
      manualStop = true;
      try {
        recognition?.stop();
      } catch (e) {
        console.warn('SpeechRecognition stop error:', e);
      }
      options.onEnd?.();
    },
    abort: () => {
      manualStop = true;
      try {
        recognition?.abort();
      } catch (e) {
        console.warn('SpeechRecognition abort error:', e);
      }
      options.onEnd?.();
    },
    isSupported: true,
  };
}

// Минимальные интерфейсы для исключения ошибок TypeScript
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventInstance) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventInstance {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}
