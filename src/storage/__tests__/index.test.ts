import {
  saveBook,
  loadBook,
  loadAllBooks,
  removeBook,
  saveProgress,
  loadProgress,
  removeProgress,
  saveSettings,
  loadSettings,
  saveSelectedFolders,
  loadSelectedFolders,
  clearAll,
  Book,
  Settings,
} from '../index';
import { StorageError } from '../../utils';

// Используем fake-indexeddb для тестирования
// В реальном окружении это будет работать с настоящим IndexedDB

// Вспомогательная функция для ожидания
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Storage: Books', () => {
  beforeEach(async () => {
    // Очищаем все данные перед каждым тестом
    try {
      await clearAll();
    } catch (e) {
      // Игнорируем ошибки при очистке
    }
    await wait(50); // Даём время на закрытие транзакций
  });

  describe('saveBook', () => {
    it('должен сохранять книгу', async () => {
      const book: Book = {
        id: 'test-book-1',
        title: 'Test Book',
        author: 'Test Author',
        filePath: '/path/to/book.mp3',
        fileType: 'mp3',
        addedAt: Date.now(),
      };

      await saveBook(book);
      const loaded = await loadBook('test-book-1');
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(book.id);
      expect(loaded?.title).toBe(book.title);
    });
  });

  describe('loadBook', () => {
    it('должен загружать книгу по ID', async () => {
      const book: Book = {
        id: 'test-book-1',
        title: 'Test Book',
        filePath: '/path/to/book.mp3',
        fileType: 'mp3',
        addedAt: Date.now(),
      };

      await saveBook(book);
      const result = await loadBook('test-book-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe(book.id);
      expect(result?.title).toBe(book.title);
    });

    it('должен возвращать null, если книга не найдена', async () => {
      const result = await loadBook('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('loadAllBooks', () => {
    it('должен загружать все книги', async () => {
      const books: Book[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          filePath: '/path/to/book1.mp3',
          fileType: 'mp3',
          addedAt: Date.now(),
        },
        {
          id: 'book-2',
          title: 'Book 2',
          filePath: '/path/to/book2.mp3',
          fileType: 'mp3',
          addedAt: Date.now(),
        },
      ];

      for (const book of books) {
        await saveBook(book);
      }

      const result = await loadAllBooks();
      expect(result.length).toBeGreaterThanOrEqual(books.length);
      expect(result.some(b => b.id === 'book-1')).toBe(true);
      expect(result.some(b => b.id === 'book-2')).toBe(true);
    });
  });

  describe('removeBook', () => {
    it('должен удалять книгу по ID', async () => {
      const book: Book = {
        id: 'test-book-1',
        title: 'Test Book',
        filePath: '/path/to/book.mp3',
        fileType: 'mp3',
        addedAt: Date.now(),
      };

      await saveBook(book);
      await removeBook('test-book-1');
      const result = await loadBook('test-book-1');
      expect(result).toBeNull();
    });
  });
});

describe('Storage: Progress', () => {
  beforeEach(async () => {
    try {
      await clearAll();
    } catch (e) {
      // Игнорируем ошибки
    }
    await wait(50);
  });

  describe('saveProgress', () => {
    it('должен сохранять прогресс', async () => {
      await saveProgress('book-1', 125.5);
      const result = await loadProgress('book-1');
      expect(result).toBe(125.5);
    });

    it('должен выбрасывать ошибку для отрицательной позиции', async () => {
      await expect(saveProgress('book-1', -10)).rejects.toThrow(StorageError);
    });
  });

  describe('loadProgress', () => {
    it('должен загружать прогресс по ID книги', async () => {
      await saveProgress('book-1', 125.5);
      const result = await loadProgress('book-1');
      expect(result).toBe(125.5);
    });

    it('должен возвращать null, если прогресс не найден', async () => {
      const result = await loadProgress('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('removeProgress', () => {
    it('должен удалять прогресс по ID книги', async () => {
      await saveProgress('book-1', 125.5);
      await removeProgress('book-1');
      const result = await loadProgress('book-1');
      expect(result).toBeNull();
    });
  });
});

describe('Storage: Settings', () => {
  beforeEach(async () => {
    try {
      await clearAll();
    } catch (e) {
      // Игнорируем ошибки
    }
    await wait(50);
  });

  describe('saveSettings', () => {
    it('должен сохранять настройки', async () => {
      await saveSettings({ preferredSkipInterval: 60 });
      const result = await loadSettings();
      expect(result.preferredSkipInterval).toBe(60);
    });

    it('должен объединять настройки с существующими', async () => {
      await saveSettings({ preferredSkipInterval: 60 });
      await saveSettings({ playbackSpeed: 1.5 });
      const result = await loadSettings();
      expect(result.preferredSkipInterval).toBe(60);
      expect(result.playbackSpeed).toBe(1.5);
    });
  });

  describe('loadSettings', () => {
    it('должен загружать настройки по умолчанию, если их нет', async () => {
      const result = await loadSettings();
      expect(result).toEqual({
        preferredSkipInterval: 30,
        playbackSpeed: 1.0,
      });
    });

    it('должен загружать сохранённые настройки', async () => {
      await saveSettings({
        preferredSkipInterval: 60,
        playbackSpeed: 1.5,
      });
      const result = await loadSettings();
      expect(result).toEqual({
        preferredSkipInterval: 60,
        playbackSpeed: 1.5,
      });
    });
  });
});

describe('Storage: Folders', () => {
  beforeEach(async () => {
    try {
      await clearAll();
    } catch (e) {
      // Игнорируем ошибки
    }
    await wait(50);
  });

  describe('saveSelectedFolders', () => {
    it('должен сохранять выбранные папки', async () => {
      const folders = [
        { path: '/path/to/folder1', name: 'Folder 1' },
        { path: '/path/to/folder2', name: 'Folder 2' },
      ];

      await saveSelectedFolders(folders);
      const result = await loadSelectedFolders();
      expect(result.length).toBe(2);
      expect(result[0].path).toBe('/path/to/folder1');
      expect(result[1].path).toBe('/path/to/folder2');
    });
  });

  describe('loadSelectedFolders', () => {
    it('должен загружать выбранные папки', async () => {
      const folders = [
        { path: '/path/to/folder1', name: 'Folder 1' },
        { path: '/path/to/folder2', name: 'Folder 2' },
      ];

      await saveSelectedFolders(folders);
      const result = await loadSelectedFolders();
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Folder 1');
      expect(result[1].name).toBe('Folder 2');
    });

    it('должен возвращать пустой массив, если папок нет', async () => {
      const result = await loadSelectedFolders();
      expect(result).toEqual([]);
    });
  });
});

describe('Storage: clearAll', () => {
  it('должен очищать все данные', async () => {
    // Сохраняем тестовые данные
    await saveBook({
      id: 'test-book',
      title: 'Test',
      filePath: '/test.mp3',
      fileType: 'mp3',
      addedAt: Date.now(),
    });
    await saveProgress('test-book', 100);
    await saveSettings({ preferredSkipInterval: 60 });

    // Очищаем
    await clearAll();

    // Проверяем, что данные удалены
    const book = await loadBook('test-book');
    const progress = await loadProgress('test-book');
    const settings = await loadSettings();

    expect(book).toBeNull();
    expect(progress).toBeNull();
    expect(settings.preferredSkipInterval).toBe(30); // Значение по умолчанию
  });
});

