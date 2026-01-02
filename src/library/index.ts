/**
 * Модуль Library - сканирование папок, парсинг метаданных и управление библиотекой
 * 
 * Реализует:
 * - Интеграцию с File System Access API
 * - Парсинг метаданных аудиофайлов
 * - Управление библиотекой книг
 */

import { parseBuffer } from 'music-metadata';
import type { IAudioMetadata, IChapter } from 'music-metadata';
import {
  saveBook,
  loadBook,
  loadAllBooks,
  removeBook as removeBookFromStorage,
  type Book,
  type Chapter,
} from '../storage';
import {
  getAudioFileType,
  isAudioFile,
  normalizePath,
  createFileId,
  FileSystemError,
} from '../utils';

// Типы для работы с File System Access API
export interface ScanProgress {
  currentFile: string;
  totalFiles: number;
  processedFiles: number;
  foundBooks: number;
}

export type ScanProgressCallback = (progress: ScanProgress) => void;

/**
 * Запрашивает доступ к папке через File System Access API
 * Если API не поддерживается, использует fallback через input[webkitdirectory]
 * @returns FileSystemDirectoryHandle или null, если пользователь отменил выбор
 */
export async function requestFolderAccess(): Promise<FileSystemDirectoryHandle | null> {
  // Пробуем использовать File System Access API (современные браузеры)
  if ('showDirectoryPicker' in window) {
    try {
      // Типизация для File System Access API
      const showDirectoryPicker = (window as any).showDirectoryPicker as (
        options?: { mode?: 'read' | 'readwrite' }
      ) => Promise<FileSystemDirectoryHandle>;
      
      const handle = await showDirectoryPicker({
        mode: 'read',
      });
      return handle;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Пользователь отменил выбор
        return null;
      }
      throw new FileSystemError(
        `Не удалось получить доступ к папке: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }
  
  // Fallback для старых браузеров через input[webkitdirectory]
  return new Promise((resolve, reject) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.style.display = 'none';
      
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
          resolve(null);
          return;
        }
        
        // Для fallback мы не можем вернуть FileSystemDirectoryHandle,
        // но можем обработать файлы напрямую
        // В этом случае возвращаем null и обрабатываем файлы в scanFolder
        resolve(null);
      };
      
      input.oncancel = () => {
        resolve(null);
      };
      
      input.onerror = (error) => {
        reject(new FileSystemError(
          `Ошибка при выборе папки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          error instanceof Error ? error : undefined
        ));
      };
      
      document.body.appendChild(input);
      input.click();
      // Удаляем input после использования
      setTimeout(() => {
        document.body.removeChild(input);
      }, 100);
    } catch (error) {
      reject(new FileSystemError(
        `Ошибка при создании fallback для выбора папки: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  });
}

/**
 * Рекурсивно сканирует директорию и собирает все аудиофайлы
 * @param directoryHandle - handle директории
 * @param basePath - базовый путь для относительных путей
 * @param audioFiles - массив для накопления найденных файлов
 * @returns массив найденных аудиофайлов
 */
async function scanDirectoryRecursive(
  directoryHandle: FileSystemDirectoryHandle,
  basePath: string = '',
  audioFiles: Array<{ handle: FileSystemFileHandle; path: string }> = []
): Promise<Array<{ handle: FileSystemFileHandle; path: string }>> {
  try {
    // Используем правильный API для итерации по директории
    // FileSystemDirectoryHandle поддерживает async iterator через Symbol.asyncIterator
    const entries: FileSystemHandle[] = [];
    // @ts-ignore - File System Access API может не иметь типов в TypeScript
    for await (const entry of directoryHandle.values()) {
      entries.push(entry);
    }

    for (const entry of entries) {
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        // Проверяем, является ли файл аудиофайлом
        if (isAudioFile(entry.name)) {
          audioFiles.push({
            handle: entry as FileSystemFileHandle,
            path: entryPath,
          });
        }
      } else if (entry.kind === 'directory') {
        // Рекурсивно сканируем вложенные директории
        await scanDirectoryRecursive(
          entry as FileSystemDirectoryHandle,
          entryPath,
          audioFiles
        );
      }
    }
  } catch (error) {
    throw new FileSystemError(
      `Ошибка при сканировании директории: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }

  return audioFiles;
}

/**
 * Извлекает метаданные из аудиофайла
 * @param fileHandle - handle файла
 * @param filePath - путь к файлу
 * @returns объект с метаданными или null при ошибке
 */
async function extractMetadata(
  fileHandle: FileSystemFileHandle,
  filePath: string
): Promise<{
  title: string;
  author?: string;
  cover?: string;
  duration?: number;
  chapters?: Chapter[];
} | null> {
  try {
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Парсим метаданные с включением глав
    const metadata: IAudioMetadata = await parseBuffer(uint8Array, file.name, {
      includeChapters: true,
    });

    // Извлекаем название
    let title = metadata.common.title;
    if (!title || title.trim() === '') {
      // Fallback на имя файла без расширения
      const fileName = file.name;
      const lastDot = fileName.lastIndexOf('.');
      title = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }

    // Извлекаем автора (используем правильное имя свойства)
    const author = metadata.common.artist || (metadata.common as any).albumartist || undefined;

    // Извлекаем обложку
    let cover: string | undefined;
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0];
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(picture.data))
      );
      const mimeType = picture.format || 'image/jpeg';
      cover = `data:${mimeType};base64,${base64}`;
    }

    // Извлекаем длительность
    const duration = metadata.format.duration;

    // Извлекаем главы (если есть)
    let chapters: Chapter[] | undefined;
    if (metadata.format.chapters && metadata.format.chapters.length > 0) {
      const sampleRate = metadata.format.sampleRate || 44100; // По умолчанию 44.1 kHz
      chapters = metadata.format.chapters.map((ch: IChapter, index: number) => {
        const startTime = ch.sampleOffset / sampleRate;
        // Вычисляем endTime на основе следующей главы или длительности
        let endTime: number | undefined;
        if (index < metadata.format.chapters!.length - 1) {
          const nextChapter = metadata.format.chapters![index + 1];
          endTime = nextChapter.sampleOffset / sampleRate;
        } else if (duration) {
          endTime = duration;
        }
        
        return {
          title: ch.title || `Глава ${index + 1}`,
          startTime,
          endTime,
        };
      });
    }

    return {
      title: title.trim(),
      author: author?.trim(),
      cover,
      duration,
      chapters,
    };
  } catch (error) {
    // Если не удалось извлечь метаданные, используем fallback
    const fileName = filePath.split('/').pop() || filePath;
    const lastDot = fileName.lastIndexOf('.');
    const title = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;

    return {
      title,
      author: undefined,
      cover: undefined,
      duration: undefined,
      chapters: undefined,
    };
  }
}

/**
 * Создаёт объект Book из файла и метаданных
 * @param filePath - путь к файлу
 * @param metadata - метаданные файла
 * @returns объект Book
 */
function createBookFromFile(
  filePath: string,
  metadata: {
    title: string;
    author?: string;
    cover?: string;
    duration?: number;
    chapters?: Chapter[];
  }
): Book {
  const normalizedPath = normalizePath(filePath);
  const fileType = getAudioFileType(filePath) || 'mp3';
  const id = createFileId(normalizedPath);

  return {
    id,
    title: metadata.title,
    author: metadata.author,
    cover: metadata.cover,
    filePath: normalizedPath,
    fileType,
    duration: metadata.duration,
    chapters: metadata.chapters,
    addedAt: Date.now(),
  };
}

/**
 * Проверяет, существует ли уже книга с таким путём
 * @param filePath - путь к файлу
 * @returns true, если книга уже существует
 */
async function isBookDuplicate(filePath: string): Promise<boolean> {
  try {
    const allBooks = await loadAllBooks();
    const normalizedPath = normalizePath(filePath);
    return allBooks.some((book) => book.filePath === normalizedPath);
  } catch (error) {
    // Если ошибка при проверке, считаем, что дубликата нет
    return false;
  }
}

/**
 * Сканирует папку и добавляет найденные аудиокниги в библиотеку
 * @param folderHandle - handle папки для сканирования
 * @param onProgress - опциональный callback для отслеживания прогресса
 * @returns количество добавленных книг
 */
export async function scanFolder(
  folderHandle: FileSystemDirectoryHandle,
  onProgress?: ScanProgressCallback
): Promise<number> {
  try {
    // Сканируем директорию рекурсивно
    const audioFiles = await scanDirectoryRecursive(folderHandle);

    // Сортируем файлы: приоритет MP3
    audioFiles.sort((a, b) => {
      const typeA = getAudioFileType(a.path);
      const typeB = getAudioFileType(b.path);
      
      if (typeA === 'mp3' && typeB !== 'mp3') return -1;
      if (typeA !== 'mp3' && typeB === 'mp3') return 1;
      return 0;
    });

    let addedCount = 0;
    const totalFiles = audioFiles.length;

    // Обрабатываем каждый файл
    for (let i = 0; i < audioFiles.length; i++) {
      const { handle, path } = audioFiles[i];

      // Отправляем прогресс
      if (onProgress) {
        onProgress({
          currentFile: path,
          totalFiles,
          processedFiles: i + 1,
          foundBooks: addedCount,
        });
      }

      // Проверяем на дубликаты
      if (await isBookDuplicate(path)) {
        continue;
      }

      try {
        // Извлекаем метаданные
        const metadata = await extractMetadata(handle, path);
        
        if (!metadata) {
          continue;
        }

        // Создаём объект книги
        const book = createBookFromFile(path, metadata);

        // Сохраняем в storage
        await saveBook(book);
        addedCount++;
      } catch (error) {
        // Пропускаем файл при ошибке, но продолжаем обработку остальных
        console.warn(`Не удалось обработать файл ${path}:`, error);
        continue;
      }
    }

    return addedCount;
  } catch (error) {
    throw new FileSystemError(
      `Ошибка при сканировании папки: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Получает все книги из библиотеки
 * @returns массив всех книг
 */
export async function getAllBooks(): Promise<Book[]> {
  try {
    return await loadAllBooks();
  } catch (error) {
    throw new FileSystemError(
      `Ошибка при загрузке книг: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Получает книгу по ID
 * @param bookId - ID книги
 * @returns книга или null, если не найдена
 */
export async function getBook(bookId: string): Promise<Book | null> {
  try {
    return await loadBook(bookId);
  } catch (error) {
    throw new FileSystemError(
      `Ошибка при загрузке книги: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Удаляет книгу из библиотеки
 * @param bookId - ID книги
 */
export async function removeBook(bookId: string): Promise<void> {
  try {
    await removeBookFromStorage(bookId);
  } catch (error) {
    throw new FileSystemError(
      `Ошибка при удалении книги: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}
