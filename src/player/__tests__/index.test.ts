/**
 * Тесты для модуля Player
 */

import {
  loadBook,
  play,
  pause,
  togglePlayPause,
  seek,
  skipBackward,
  skipForward,
  setSpeed,
  setVolume,
  getCurrentPosition,
  getDuration,
  getState,
  getCurrentBook,
  onStateChange,
  destroy,
  type PlayerState,
} from '../index';
import { Book } from '../../storage';
import { saveBook, saveProgress, saveSettings, loadSettings, clearAll } from '../../storage';
import { PlaybackError } from '../../utils';
import { Howl } from 'howler';

// Моки для URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/test');
global.URL.revokeObjectURL = jest.fn();

// Моки для Howler.js
jest.mock('howler', () => {
  const mockHowl = jest.fn();
  const mockHowler = {
    volume: jest.fn(() => 1.0),
  };

  return {
    Howl: mockHowl,
    Howler: mockHowler,
  };
});

// Вспомогательные функции
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Создаём тестовый Book
function createTestBook(): Book {
  return {
    id: 'test-book-1',
    title: 'Test Book',
    author: 'Test Author',
    filePath: '/path/to/test.mp3',
    fileType: 'mp3',
    addedAt: Date.now(),
  };
}

// Создаём тестовый File
function createTestFile(): File {
  return new File(['mock audio data'], 'test.mp3', { type: 'audio/mpeg' });
}

describe('Player Module', () => {
  let mockHowlInstance: any;

  beforeEach(async () => {
    // Очищаем данные
    await clearAll();
    await wait(50);

    // Сбрасываем все моки
    jest.clearAllMocks();

    // Создаём mock экземпляр Howl
    mockHowlInstance = {
      play: jest.fn(() => 1),
      pause: jest.fn(),
      stop: jest.fn(),
      seek: jest.fn((pos?: number) => (pos !== undefined ? pos : 100)),
      volume: jest.fn((vol?: number) => (vol !== undefined ? vol : 1.0)),
      rate: jest.fn((rate?: number) => (rate !== undefined ? rate : 1.0)),
      playing: jest.fn(() => false),
      duration: jest.fn(() => 3600),
      state: jest.fn(() => 'unloaded'),
      unload: jest.fn(),
      once: jest.fn((event: string, callback: () => void) => {
        if (event === 'load') {
          setTimeout(callback, 10);
        }
      }),
      on: jest.fn(),
      off: jest.fn(),
    };

    // Настраиваем Howl конструктор
    (Howl as jest.Mock).mockImplementation((options: any) => {
      // Устанавливаем начальное состояние
      mockHowlInstance.state = jest.fn(() => 'unloaded');
      
      // Сохраняем обработчики событий
      const eventHandlers: Record<string, Function[]> = {};
      mockHowlInstance.on = jest.fn((event: string, handler: Function) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
      });
      mockHowlInstance.once = jest.fn((event: string, handler: Function) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
      });
      
      // Переопределяем play, чтобы вызывать onplay
      mockHowlInstance.play = jest.fn(() => {
        if (options.onplay) {
          options.onplay();
        }
        if (eventHandlers.play) {
          eventHandlers.play.forEach(h => h());
        }
        return 1;
      });
      
      // Переопределяем pause, чтобы вызывать onpause
      mockHowlInstance.pause = jest.fn(() => {
        if (options.onpause) {
          options.onpause();
        }
        if (eventHandlers.pause) {
          eventHandlers.pause.forEach(h => h());
        }
      });
      
      // Симулируем загрузку
      if (options.onload) {
        // Симулируем загрузку асинхронно
        setTimeout(() => {
          mockHowlInstance.state = jest.fn(() => 'loaded');
          options.onload();
          // Вызываем обработчики события load
          if (eventHandlers.load) {
            eventHandlers.load.forEach(h => h());
          }
        }, 10);
      }
      return mockHowlInstance;
    });
    
    // Сбрасываем Howler.volume
    const { Howler } = require('howler');
    Howler.volume = jest.fn(() => 1.0);

    // Сбрасываем состояние плеера
    destroy();
  });

  afterEach(() => {
    destroy();
  });

  describe('loadBook', () => {
    it('должен загружать книгу и создавать Howl экземпляр', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);

      await loadBook(book, file);

      expect(Howl).toHaveBeenCalled();
      expect(mockHowlInstance.state()).toBe('loaded');
    });

    it('должен загружать сохранённый прогресс', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await saveProgress(book.id, 125.5);

      await loadBook(book, file);
      await wait(50); // Ждём загрузки

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(125.5);
    });

    it('должен устанавливать скорость из настроек', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await saveSettings({ playbackSpeed: 1.5 });

      await loadBook(book, file);
      await wait(50);

      expect(mockHowlInstance.rate).toHaveBeenCalledWith(1.5);
    });

    it('должен выбрасывать ошибку при ошибке загрузки', async () => {
      const book = createTestBook();
      const file = createTestFile();

      // Мокаем ошибку загрузки
      const eventHandlers: Record<string, Function[]> = {};
      (Howl as jest.Mock).mockImplementation((options: any) => {
        mockHowlInstance.state = jest.fn(() => 'unloaded');
        mockHowlInstance.once = jest.fn((event: string, handler: Function) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push(handler);
          
          // Симулируем ошибку загрузки
          if (event === 'loaderror') {
            setTimeout(() => {
              handler(1, 'load error');
            }, 10);
          }
        });
        
        return mockHowlInstance;
      });

      await expect(loadBook(book, file)).rejects.toThrow(PlaybackError);
    });
  });

  describe('play', () => {
    it('должен воспроизводить текущий трек', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      play();

      expect(mockHowlInstance.play).toHaveBeenCalled();
    });

    it('должен выбрасывать ошибку, если книга не загружена', () => {
      expect(() => play()).toThrow(PlaybackError);
    });
  });

  describe('pause', () => {
    it('должен приостанавливать воспроизведение', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      pause();

      expect(mockHowlInstance.pause).toHaveBeenCalled();
    });

    it('должен выбрасывать ошибку, если книга не загружена', () => {
      expect(() => pause()).toThrow(PlaybackError);
    });
  });

  describe('togglePlayPause', () => {
    it('должен переключать воспроизведение', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.playing = jest.fn(() => false);
      togglePlayPause();
      expect(mockHowlInstance.play).toHaveBeenCalled();

      mockHowlInstance.playing = jest.fn(() => true);
      togglePlayPause();
      expect(mockHowlInstance.pause).toHaveBeenCalled();
    });

    it('должен выбрасывать ошибку, если книга не загружена', () => {
      expect(() => togglePlayPause()).toThrow(PlaybackError);
    });
  });

  describe('seek', () => {
    it('должен устанавливать позицию', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      seek(125.5);

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(125.5);
    });

    it('должен ограничивать позицию минимумом 0', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      seek(-10);

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(0);
    });

    it('должен ограничивать позицию максимумом длительности', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.duration = jest.fn(() => 3600);
      seek(4000);

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(3600);
    });

    it('должен выбрасывать ошибку, если книга не загружена', () => {
      expect(() => seek(100)).toThrow(PlaybackError);
    });
  });

  describe('skipBackward', () => {
    it('должен перематывать назад на указанное количество секунд', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.seek = jest.fn(() => 200);
      skipBackward(30);

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(170);
    });

    it('должен использовать значение по умолчанию 30 секунд', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.seek = jest.fn(() => 200);
      skipBackward();

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(170);
    });

    it('не должен перематывать меньше 0', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.seek = jest.fn(() => 10);
      skipBackward(30);

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(0);
    });

    it('должен выбрасывать ошибку, если книга не загружена', () => {
      expect(() => skipBackward(30)).toThrow(PlaybackError);
    });
  });

  describe('skipForward', () => {
    it('должен перематывать вперёд на указанное количество секунд', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.seek = jest.fn(() => 100);
      mockHowlInstance.duration = jest.fn(() => 3600);
      skipForward(30);

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(130);
    });

    it('должен использовать значение по умолчанию 30 секунд', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.seek = jest.fn(() => 100);
      mockHowlInstance.duration = jest.fn(() => 3600);
      skipForward();

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(130);
    });

    it('не должен перематывать больше длительности', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.seek = jest.fn(() => 3580);
      mockHowlInstance.duration = jest.fn(() => 3600);
      skipForward(30);

      expect(mockHowlInstance.seek).toHaveBeenCalledWith(3600);
    });

    it('должен выбрасывать ошибку, если книга не загружена', () => {
      expect(() => skipForward(30)).toThrow(PlaybackError);
    });
  });

  describe('setSpeed', () => {
    it('должен устанавливать скорость воспроизведения', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      await setSpeed(1.5);

      expect(mockHowlInstance.rate).toHaveBeenCalledWith(1.5);
      
      // Проверяем, что настройка сохранена
      const settings = await loadSettings();
      expect(settings.playbackSpeed).toBe(1.5);
    });

    it('должен выбрасывать ошибку для скорости меньше 0.5', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      await expect(setSpeed(0.3)).rejects.toThrow(PlaybackError);
    });

    it('должен выбрасывать ошибку для скорости больше 2.0', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      await expect(setSpeed(2.5)).rejects.toThrow(PlaybackError);
    });

    it('должен выбрасывать ошибку, если книга не загружена', async () => {
      await expect(setSpeed(1.5)).rejects.toThrow(PlaybackError);
    });
  });

  describe('setVolume', () => {
    it('должен устанавливать громкость', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      const { Howler } = require('howler');
      setVolume(0.7);

      expect(Howler.volume).toHaveBeenCalledWith(0.7);
    });

    it('должен выбрасывать ошибку для громкости меньше 0', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      expect(() => setVolume(-0.1)).toThrow(PlaybackError);
    });

    it('должен выбрасывать ошибку для громкости больше 1', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      expect(() => setVolume(1.1)).toThrow(PlaybackError);
    });

    it('должен выбрасывать ошибку, если книга не загружена', () => {
      expect(() => setVolume(0.5)).toThrow(PlaybackError);
    });
  });

  describe('getCurrentPosition', () => {
    it('должен возвращать текущую позицию', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.seek = jest.fn(() => 125.5);
      const position = getCurrentPosition();

      expect(position).toBe(125.5);
    });

    it('должен возвращать 0, если книга не загружена', () => {
      const position = getCurrentPosition();
      expect(position).toBe(0);
    });
  });

  describe('getDuration', () => {
    it('должен возвращать длительность трека', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.duration = jest.fn(() => 3600);
      const duration = getDuration();

      expect(duration).toBe(3600);
    });

    it('должен возвращать 0, если книга не загружена', () => {
      const duration = getDuration();
      expect(duration).toBe(0);
    });
  });

  describe('getState', () => {
    it('должен возвращать текущее состояние', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      mockHowlInstance.playing = jest.fn(() => true);
      mockHowlInstance.seek = jest.fn(() => 125.5);
      mockHowlInstance.duration = jest.fn(() => 3600);
      mockHowlInstance.rate = jest.fn(() => 1.5);

      const { Howler } = require('howler');
      Howler.volume = jest.fn(() => 0.8);

      const state = getState();

      expect(state).toEqual({
        isPlaying: true,
        currentPosition: 125.5,
        duration: 3600,
        volume: 0.8,
        speed: 1.5,
        currentBookId: book.id,
      });
    });
  });

  describe('getCurrentBook', () => {
    it('должен возвращать текущую книгу', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      const currentBook = getCurrentBook();

      expect(currentBook).toEqual(book);
    });

    it('должен возвращать null, если книга не загружена', () => {
      const currentBook = getCurrentBook();
      expect(currentBook).toBeNull();
    });
  });

  describe('onStateChange', () => {
    it('должен вызывать callback при изменении состояния', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      const callback = jest.fn();
      const unsubscribe = onStateChange(callback);

      // Симулируем изменение состояния через play
      play();
      await wait(20);

      expect(callback).toHaveBeenCalled();

      // Отписываемся
      unsubscribe();
    });

    it('должен возвращать функцию для отписки', async () => {
      const callback = jest.fn();
      const unsubscribe = onStateChange(callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });
  });

  describe('destroy', () => {
    it('должен очищать ресурсы', async () => {
      const book = createTestBook();
      const file = createTestFile();
      await saveBook(book);
      await loadBook(book, file);
      await wait(50);

      destroy();

      expect(mockHowlInstance.unload).toHaveBeenCalled();
      expect(getCurrentBook()).toBeNull();
    });
  });
});

