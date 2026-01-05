/**
 * React Context для глобального состояния приложения
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import type { Book, Settings, Progress } from '../storage';
import { loadAllBooks, loadSettings, saveSettings as saveSettingsToStorage, loadProgress } from '../storage';
import { getState, onStateChange, loadBook, type PlayerState } from '../player';
import { requestFolderAccess, scanFolder } from '../library';

export type Screen = 'library' | 'player' | 'settings' | 'statistics';

interface AppContextValue {
  // Экраны и навигация
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  
  // Библиотека
  books: Book[];
  isLoadingBooks: boolean;
  refreshBooks: () => Promise<void>;
  addFolder: () => Promise<void>;
  
  // Текущая книга
  currentBook: Book | null;
  setCurrentBook: (book: Book | null) => void;
  openBook: (book: Book, fileHandle?: FileSystemFileHandle | File) => Promise<void>;
  
  // Плеер
  playerState: PlayerState | null;
  
  // Настройки
  settings: Settings | null;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  
  // Прогресс
  getBookProgress: (bookId: string) => Promise<Progress | null>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<Screen>('library');
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  // Хранилище file handles для книг (в памяти)
  const bookHandlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());
  
  // Инициализация состояния плеера
  useEffect(() => {
    // Получаем начальное состояние
    setPlayerState(getState());
    
    // Подписываемся на изменения состояния плеера
    const unsubscribe = onStateChange((state) => {
      setPlayerState(state);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Загрузка настроек при инициализации
  useEffect(() => {
    loadSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
    });
  }, []);
  
  // Загрузка книг при инициализации
  const refreshBooks = useCallback(async () => {
    setIsLoadingBooks(true);
    try {
      const loadedBooks = await loadAllBooks();
      setBooks(loadedBooks);
    } catch (error) {
      console.error('Ошибка загрузки книг:', error);
    } finally {
      setIsLoadingBooks(false);
    }
  }, []);
  
  useEffect(() => {
    refreshBooks();
  }, [refreshBooks]);
  
  // Добавление папки
  const addFolder = useCallback(async () => {
    try {
      const folderHandle = await requestFolderAccess();
      if (!folderHandle) {
        // Если File System Access API не поддерживается, используем fallback
        // В этом случае requestFolderAccess уже обработал выбор через input
        // и вернул null, что означает отмену или неподдержку
        // Для полной поддержки fallback нужно доработать scanFolder
        return; // Пользователь отменил выбор или браузер не поддерживает API
      }
      
      setIsLoadingBooks(true);
      await scanFolder(folderHandle, (progress) => {
        console.log('Прогресс сканирования:', progress);
      });
      await refreshBooks();
    } catch (error) {
      console.error('Ошибка добавления папки:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Улучшенная обработка ошибок с более понятными сообщениями
      if (errorMessage.includes('File System Access API')) {
        alert('Ваш браузер не поддерживает выбор папок. Пожалуйста, используйте современный браузер (Chrome, Edge, Opera).');
      } else {
        alert(`Ошибка добавления папки: ${errorMessage}`);
      }
    } finally {
      setIsLoadingBooks(false);
    }
  }, [refreshBooks]);
  
  // Вспомогательная функция для выбора файла (временное решение для MVP)
  const selectFileForBook = useCallback((_book: Book): Promise<File | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        resolve(file || null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }, []);
  
  // Открытие книги и загрузка в плеер
  const openBook = useCallback(async (book: Book, fileHandle?: FileSystemFileHandle | File) => {
    try {
      console.log('=== Начало открытия книги ===', book.title);
      
      let handle: FileSystemFileHandle | File;
      
      // Если handle передан, используем его
      if (fileHandle) {
        handle = fileHandle;
        console.log('Используем переданный handle');
      } else {
        // Иначе пытаемся найти в сохранённых handles
        const savedHandle = bookHandlesRef.current.get(book.id);
        if (savedHandle) {
          handle = savedHandle;
          console.log('Используем сохранённый handle');
        } else {
          // Если handle не найден, запрашиваем у пользователя выбор файла
          console.log('Запрашиваем выбор файла у пользователя');
          const file = await selectFileForBook(book);
          if (!file) {
            console.log('Пользователь отменил выбор файла');
            return; // Пользователь отменил выбор
          }
          handle = file;
          console.log('Файл выбран:', file.name);
        }
      }
      
      // Сохраняем handle, если это FileSystemFileHandle
      if (handle instanceof FileSystemFileHandle) {
        bookHandlesRef.current.set(book.id, handle);
        console.log('Handle сохранён');
      }
      
      // Загружаем книгу в плеер
      console.log('Загрузка книги в плеер...');
      await loadBook(book, handle);
      console.log('Книга успешно загружена в плеер');
      
      // Устанавливаем текущую книгу ПЕРЕД переключением экрана
      console.log('Устанавливаем текущую книгу:', book.title);
      setCurrentBook(book);
      
      // Используем setTimeout для гарантии обновления состояния
      setTimeout(() => {
        console.log('Переключаемся на экран плеера');
        setCurrentScreen('player');
        console.log('=== Книга открыта, экран переключен на player ===');
      }, 0);
    } catch (error) {
      console.error('=== ОШИБКА при открытии книги ===', error);
      alert(`Ошибка открытия книги: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [selectFileForBook]);
  
  // Обновление настроек
  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    if (!settings) return;
    
    const updated = { ...settings, ...newSettings };
    await saveSettingsToStorage(updated);
    setSettings(updated);
  }, [settings]);
  
  // Получение прогресса книги
  const getBookProgress = useCallback(async (bookId: string): Promise<Progress | null> => {
    try {
      const position = await loadProgress(bookId);
      if (position === null) return null;
      
      return {
        bookId,
        position,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('Ошибка загрузки прогресса:', error);
      return null;
    }
  }, []);
  
  const value: AppContextValue = {
    currentScreen,
    setCurrentScreen,
    books,
    isLoadingBooks,
    refreshBooks,
    addFolder,
    currentBook,
    setCurrentBook,
    openBook,
    playerState,
    settings,
    updateSettings,
    getBookProgress,
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp должен использоваться внутри AppProvider');
  }
  return context;
}

