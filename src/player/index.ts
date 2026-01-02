/**
 * Модуль Player - логика воспроизведения аудио, перемотка, скорость, громкость
 * 
 * Реализует:
 * - Интеграцию с Howler.js
 * - Базовое воспроизведение (play/pause, скорость, громкость)
 * - Перемотку на фиксированные интервалы (15/30/60 сек)
 * - Автосохранение позиции
 */

import { Howl, Howler } from 'howler';
import type { Book } from '../storage';
import { loadProgress, saveProgress, loadSettings, saveSettings } from '../storage';
import { PlaybackError } from '../utils';

// Интерфейс для события изменения состояния плеера
export interface PlayerState {
  isPlaying: boolean;
  currentPosition: number; // в секундах
  duration: number; // в секундах
  volume: number; // 0.0 - 1.0
  speed: number; // 0.5 - 2.0
  currentBookId: string | null;
}

// Тип для callback изменения состояния
export type PlayerStateCallback = (state: PlayerState) => void;

// Класс для управления воспроизведением
class Player {
  private howl: Howl | null = null;
  private currentBookId: string | null = null;
  private currentBook: Book | null = null;
  private stateCallbacks: Set<PlayerStateCallback> = new Set();
  private autoSaveInterval: number | null = null;
  private readonly AUTO_SAVE_INTERVAL_MS = 5000; // 5 секунд

  /**
   * Инициализирует воспроизведение книги
   * @param book - книга для воспроизведения
   * @param fileHandle - handle файла (FileSystemFileHandle) или File объект
   */
  async loadBook(book: Book, fileHandle: FileSystemFileHandle | File): Promise<void> {
    try {
      // Останавливаем текущее воспроизведение, если есть
      if (this.howl) {
        this.howl.unload();
        this.howl = null;
      }

      // Останавливаем автосохранение
      this.stopAutoSave();

      // Получаем File объект
      let file: File;
      if (fileHandle instanceof File) {
        file = fileHandle;
      } else {
        file = await fileHandle.getFile();
      }

      // Создаём blob URL для Howler.js
      const blobUrl = URL.createObjectURL(file);

      // Загружаем настройки
      const settings = await loadSettings();
      const savedProgress = await loadProgress(book.id);

      // Создаём новый Howl экземпляр
      this.howl = new Howl({
        src: [blobUrl],
        html5: true, // Используем HTML5 Audio API для лучшей поддержки
        preload: true,
        volume: 1.0, // Начальная громкость (будет установлена из настроек)
        rate: settings.playbackSpeed,
        onload: () => {
          // После загрузки устанавливаем позицию из сохранённого прогресса
          if (savedProgress !== null && savedProgress > 0 && this.howl) {
            this.howl.seek(savedProgress);
          }
          // Устанавливаем громкость и скорость из настроек
          if (this.howl) {
            this.howl.volume(1.0); // Громкость всегда 1.0 (управляется через Howler master volume)
            this.howl.rate(settings.playbackSpeed);
          }
          this.notifyStateChange();
        },
        onplay: () => {
          this.startAutoSave();
          this.notifyStateChange();
        },
        onpause: () => {
          this.saveCurrentPosition();
          this.stopAutoSave();
          this.notifyStateChange();
        },
        onend: () => {
          this.saveCurrentPosition();
          this.stopAutoSave();
          this.notifyStateChange();
        },
        onseek: () => {
          this.notifyStateChange();
        },
        onerror: (id, error) => {
          throw new PlaybackError(`Ошибка воспроизведения: ${error}`);
        },
      });

      this.currentBookId = book.id;
      this.currentBook = book;

      // Ожидаем загрузки
      await new Promise<void>((resolve, reject) => {
        if (!this.howl) {
          reject(new PlaybackError('Howl не инициализирован'));
          return;
        }

        if (this.howl.state() === 'loaded') {
          resolve();
        } else {
          this.howl.once('load', () => resolve());
          this.howl.once('loaderror', (id, error) => {
            reject(new PlaybackError(`Ошибка загрузки: ${error}`));
          });
        }
      });

      // Устанавливаем начальную позицию после загрузки
      if (savedProgress !== null && savedProgress > 0 && this.howl) {
        this.howl.seek(savedProgress);
      }

      this.notifyStateChange();
    } catch (error) {
      if (error instanceof PlaybackError) {
        throw error;
      }
      throw new PlaybackError(
        `Ошибка при загрузке книги: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Воспроизводит текущий трек
   */
  play(): void {
    if (!this.howl) {
      throw new PlaybackError('Книга не загружена');
    }

    this.howl.play();
  }

  /**
   * Приостанавливает воспроизведение
   */
  pause(): void {
    if (!this.howl) {
      throw new PlaybackError('Книга не загружена');
    }

    this.howl.pause();
  }

  /**
   * Переключает воспроизведение (play/pause)
   */
  togglePlayPause(): void {
    if (!this.howl) {
      throw new PlaybackError('Книга не загружена');
    }

    if (this.howl.playing()) {
      this.howl.pause();
    } else {
      this.howl.play();
    }
  }

  /**
   * Устанавливает позицию воспроизведения
   * @param position - позиция в секундах
   */
  seek(position: number): void {
    if (!this.howl) {
      throw new PlaybackError('Книга не загружена');
    }

    if (position < 0) {
      position = 0;
    }

    const duration = this.howl.duration();
    if (duration && position > duration) {
      position = duration;
    }

    this.howl.seek(position);
    this.saveCurrentPosition();
  }

  /**
   * Перематывает назад на указанное количество секунд
   * @param seconds - количество секунд (15, 30 или 60)
   */
  skipBackward(seconds: number = 30): void {
    if (!this.howl) {
      throw new PlaybackError('Книга не загружена');
    }

    const currentPos = this.howl.seek() as number;
    const newPos = Math.max(0, currentPos - seconds);
    this.howl.seek(newPos);
    this.saveCurrentPosition();
  }

  /**
   * Перематывает вперёд на указанное количество секунд
   * @param seconds - количество секунд (15, 30 или 60)
   */
  skipForward(seconds: number = 30): void {
    if (!this.howl) {
      throw new PlaybackError('Книга не загружена');
    }

    const currentPos = this.howl.seek() as number;
    const duration = this.howl.duration();
    if (duration) {
      const newPos = Math.min(duration, currentPos + seconds);
      this.howl.seek(newPos);
      this.saveCurrentPosition();
    }
  }

  /**
   * Устанавливает скорость воспроизведения
   * @param speed - скорость (0.5 - 2.0)
   */
  async setSpeed(speed: number): Promise<void> {
    if (!this.howl) {
      throw new PlaybackError('Книга не загружена');
    }

    if (speed < 0.5 || speed > 2.0) {
      throw new PlaybackError('Скорость должна быть в диапазоне 0.5 - 2.0');
    }

    this.howl.rate(speed);

    // Сохраняем настройку
    await saveSettings({ playbackSpeed: speed });

    this.notifyStateChange();
  }

  /**
   * Устанавливает громкость
   * @param volume - громкость (0.0 - 1.0)
   */
  setVolume(volume: number): void {
    if (!this.howl) {
      throw new PlaybackError('Книга не загружена');
    }

    if (volume < 0 || volume > 1) {
      throw new PlaybackError('Громкость должна быть в диапазоне 0.0 - 1.0');
    }

    // Устанавливаем глобальную громкость Howler
    Howler.volume(volume);

    this.notifyStateChange();
  }

  /**
   * Получает текущую позицию воспроизведения
   * @returns позиция в секундах
   */
  getCurrentPosition(): number {
    if (!this.howl) {
      return 0;
    }

    const position = this.howl.seek();
    return typeof position === 'number' ? position : 0;
  }

  /**
   * Получает длительность трека
   * @returns длительность в секундах или 0, если не загружена
   */
  getDuration(): number {
    if (!this.howl) {
      return 0;
    }

    const duration = this.howl.duration();
    return duration || 0;
  }

  /**
   * Получает текущее состояние плеера
   */
  getState(): PlayerState {
    const isPlaying = this.howl ? this.howl.playing() : false;
    const currentPosition = this.getCurrentPosition();
    const duration = this.getDuration();
    const volume = Howler.volume();
    const speed = this.howl ? (this.howl.rate() || 1.0) : 1.0;

    return {
      isPlaying,
      currentPosition,
      duration,
      volume,
      speed,
      currentBookId: this.currentBookId,
    };
  }

  /**
   * Получает текущую книгу
   */
  getCurrentBook(): Book | null {
    return this.currentBook;
  }

  /**
   * Подписывается на изменения состояния
   */
  onStateChange(callback: PlayerStateCallback): () => void {
    this.stateCallbacks.add(callback);

    // Возвращаем функцию для отписки
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  /**
   * Уведомляет подписчиков об изменении состояния
   */
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateCallbacks.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        console.error('Ошибка в callback изменения состояния:', error);
      }
    });
  }

  /**
   * Сохраняет текущую позицию
   */
  private async saveCurrentPosition(): Promise<void> {
    if (!this.currentBookId || !this.howl) {
      return;
    }

    try {
      const position = this.getCurrentPosition();
      await saveProgress(this.currentBookId, position);
    } catch (error) {
      console.error('Ошибка при сохранении прогресса:', error);
    }
  }

  /**
   * Запускает автосохранение позиции
   */
  private startAutoSave(): void {
    this.stopAutoSave(); // Останавливаем предыдущий интервал, если есть

    this.autoSaveInterval = window.setInterval(() => {
      this.saveCurrentPosition();
    }, this.AUTO_SAVE_INTERVAL_MS);
  }

  /**
   * Останавливает автосохранение позиции
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Очищает ресурсы плеера
   */
  destroy(): void {
    this.stopAutoSave();
    this.saveCurrentPosition();

    if (this.howl) {
      this.howl.unload();
      this.howl = null;
    }

    // Очищаем blob URLs
    // Note: Howler.js должен сам очищать URL, но на всякий случай

    this.currentBookId = null;
    this.currentBook = null;
    this.stateCallbacks.clear();
  }
}

// Единый экземпляр плеера (singleton)
const playerInstance = new Player();

// Экспорт API
export async function loadBook(book: Book, fileHandle: FileSystemFileHandle | File): Promise<void> {
  return playerInstance.loadBook(book, fileHandle);
}

export function play(): void {
  playerInstance.play();
}

export function pause(): void {
  playerInstance.pause();
}

export function togglePlayPause(): void {
  playerInstance.togglePlayPause();
}

export function seek(position: number): void {
  playerInstance.seek(position);
}

export function skipBackward(seconds?: number): void {
  playerInstance.skipBackward(seconds);
}

export function skipForward(seconds?: number): void {
  playerInstance.skipForward(seconds);
}

export async function setSpeed(speed: number): Promise<void> {
  return playerInstance.setSpeed(speed);
}

export function setVolume(volume: number): void {
  playerInstance.setVolume(volume);
}

export function getCurrentPosition(): number {
  return playerInstance.getCurrentPosition();
}

export function getDuration(): number {
  return playerInstance.getDuration();
}

export function getState(): PlayerState {
  return playerInstance.getState();
}

export function getCurrentBook(): Book | null {
  return playerInstance.getCurrentBook();
}

export function onStateChange(callback: PlayerStateCallback): () => void {
  return playerInstance.onStateChange(callback);
}

export function destroy(): void {
  playerInstance.destroy();
}
