import {
  getAudioFileType,
  isAudioFile,
  normalizePath,
  getFileName,
  getDirectory,
  isDuplicate,
  createFileId,
  AppError,
  FileSystemError,
  MetadataError,
  PlaybackError,
  StorageError,
  ValidationError,
  getErrorMessage,
  isErrorOfType,
  formatTimeShort,
  formatTimeLong,
  formatTime,
  parseTime,
  formatTimeReadable,
} from '../index';

describe('Utils: File utilities', () => {
  describe('getAudioFileType', () => {
    it('должен определять MP3 по расширению', () => {
      expect(getAudioFileType('book.mp3')).toBe('mp3');
      expect(getAudioFileType('path/to/book.MP3')).toBe('mp3');
    });

    it('должен определять M4A по расширению', () => {
      expect(getAudioFileType('book.m4a')).toBe('m4a');
      expect(getAudioFileType('book.m4b')).toBe('m4a');
    });

    it('должен определять WAV по расширению', () => {
      expect(getAudioFileType('book.wav')).toBe('wav');
    });

    it('должен определять AAC по расширению', () => {
      expect(getAudioFileType('book.aac')).toBe('aac');
    });

    it('должен определять OGG по расширению', () => {
      expect(getAudioFileType('book.ogg')).toBe('ogg');
      expect(getAudioFileType('book.oga')).toBe('ogg');
    });

    it('должен определять тип по MIME-типу', () => {
      expect(getAudioFileType('unknown', 'audio/mpeg')).toBe('mp3');
      expect(getAudioFileType('unknown', 'audio/mp4')).toBe('m4a');
      expect(getAudioFileType('unknown', 'audio/wav')).toBe('wav');
    });

    it('должен возвращать null для неподдерживаемых файлов', () => {
      expect(getAudioFileType('book.txt')).toBeNull();
      expect(getAudioFileType('book.pdf')).toBeNull();
      expect(getAudioFileType('unknown', 'text/plain')).toBeNull();
    });
  });

  describe('isAudioFile', () => {
    it('должен возвращать true для поддерживаемых аудиофайлов', () => {
      expect(isAudioFile('book.mp3')).toBe(true);
      expect(isAudioFile('book.m4a')).toBe(true);
      expect(isAudioFile('book.wav')).toBe(true);
    });

    it('должен возвращать false для неподдерживаемых файлов', () => {
      expect(isAudioFile('book.txt')).toBe(false);
      expect(isAudioFile('book.pdf')).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('должен нормализовать пути с обратными слешами', () => {
      expect(normalizePath('path\\to\\file.mp3')).toBe('path/to/file.mp3');
    });

    it('должен убирать множественные слеши', () => {
      expect(normalizePath('path//to///file.mp3')).toBe('path/to/file.mp3');
    });

    it('должен убирать ведущий ./', () => {
      expect(normalizePath('./path/to/file.mp3')).toBe('path/to/file.mp3');
    });

    it('должен обрабатывать уже нормализованные пути', () => {
      expect(normalizePath('path/to/file.mp3')).toBe('path/to/file.mp3');
    });
  });

  describe('getFileName', () => {
    it('должен извлекать имя файла из пути', () => {
      expect(getFileName('path/to/book.mp3')).toBe('book.mp3');
      expect(getFileName('book.mp3')).toBe('book.mp3');
    });

    it('должен обрабатывать пути с обратными слешами', () => {
      expect(getFileName('path\\to\\book.mp3')).toBe('book.mp3');
    });
  });

  describe('getDirectory', () => {
    it('должен извлекать директорию из пути', () => {
      expect(getDirectory('path/to/book.mp3')).toBe('path/to');
      expect(getDirectory('book.mp3')).toBe('');
    });

    it('должен обрабатывать пути с обратными слешами', () => {
      expect(getDirectory('path\\to\\book.mp3')).toBe('path/to');
    });
  });

  describe('isDuplicate', () => {
    it('должен определять дубликаты по имени файла', () => {
      expect(isDuplicate('path/to/book.mp3', 'other/path/book.mp3')).toBe(true);
      expect(isDuplicate('book.mp3', 'BOOK.MP3')).toBe(true);
    });

    it('должен возвращать false для разных файлов', () => {
      expect(isDuplicate('book1.mp3', 'book2.mp3')).toBe(false);
    });
  });

  describe('createFileId', () => {
    it('должен создавать уникальный ID для файла', () => {
      const id1 = createFileId('path/to/book.mp3');
      const id2 = createFileId('path/to/book.mp3');
      const id3 = createFileId('other/path/book.mp3');

      expect(id1).toBe(id2); // Одинаковые пути дают одинаковый ID
      expect(id1).not.toBe(id3); // Разные пути дают разные ID
      expect(id1).toMatch(/^file_[a-z0-9]+$/);
    });
  });
});

describe('Utils: Error handling', () => {
  describe('AppError', () => {
    it('должен создавать ошибку с сообщением и кодом', () => {
      const error = new AppError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AppError');
    });

    it('должен сохранять причину ошибки', () => {
      const cause = new Error('Original error');
      const error = new AppError('Test error', 'TEST_CODE', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('FileSystemError', () => {
    it('должен создавать ошибку файловой системы', () => {
      const error = new FileSystemError('File not found');
      expect(error.message).toBe('File not found');
      expect(error.code).toBe('FILE_SYSTEM_ERROR');
      expect(error.name).toBe('FileSystemError');
    });
  });

  describe('MetadataError', () => {
    it('должен создавать ошибку метаданных', () => {
      const error = new MetadataError('Invalid metadata');
      expect(error.message).toBe('Invalid metadata');
      expect(error.code).toBe('METADATA_ERROR');
      expect(error.name).toBe('MetadataError');
    });
  });

  describe('PlaybackError', () => {
    it('должен создавать ошибку воспроизведения', () => {
      const error = new PlaybackError('Playback failed');
      expect(error.message).toBe('Playback failed');
      expect(error.code).toBe('PLAYBACK_ERROR');
      expect(error.name).toBe('PlaybackError');
    });
  });

  describe('StorageError', () => {
    it('должен создавать ошибку хранилища', () => {
      const error = new StorageError('Storage failed');
      expect(error.message).toBe('Storage failed');
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.name).toBe('StorageError');
    });
  });

  describe('ValidationError', () => {
    it('должен создавать ошибку валидации', () => {
      const error = new ValidationError('Invalid data');
      expect(error.message).toBe('Invalid data');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('getErrorMessage', () => {
    it('должен возвращать сообщение из AppError', () => {
      const error = new AppError('Test error', 'TEST_CODE');
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('должен возвращать сообщение из обычной Error', () => {
      const error = new Error('Standard error');
      expect(getErrorMessage(error)).toBe('Standard error');
    });

    it('должен возвращать строку как есть', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('должен возвращать дефолтное сообщение для неизвестных ошибок', () => {
      expect(getErrorMessage(null)).toBe('Произошла неизвестная ошибка');
      expect(getErrorMessage(undefined)).toBe('Произошла неизвестная ошибка');
      expect(getErrorMessage(123)).toBe('Произошла неизвестная ошибка');
    });
  });

  describe('isErrorOfType', () => {
    it('должен проверять тип ошибки', () => {
      const error = new FileSystemError('File error');
      expect(isErrorOfType(error, FileSystemError)).toBe(true);
      expect(isErrorOfType(error, MetadataError)).toBe(false);
    });

    it('должен возвращать false для не-ошибок', () => {
      expect(isErrorOfType('string', FileSystemError)).toBe(false);
      expect(isErrorOfType(null, FileSystemError)).toBe(false);
    });
  });
});

describe('Utils: Time utilities', () => {
  describe('formatTimeShort', () => {
    it('должен форматировать секунды в mm:ss', () => {
      expect(formatTimeShort(0)).toBe('00:00');
      expect(formatTimeShort(30)).toBe('00:30');
      expect(formatTimeShort(65)).toBe('01:05');
      expect(formatTimeShort(125)).toBe('02:05');
    });

    it('должен обрабатывать некорректные значения', () => {
      expect(formatTimeShort(NaN)).toBe('00:00');
      expect(formatTimeShort(Infinity)).toBe('00:00');
      expect(formatTimeShort(-10)).toBe('00:00');
    });
  });

  describe('formatTimeLong', () => {
    it('должен форматировать секунды в hh:mm:ss', () => {
      expect(formatTimeLong(0)).toBe('00:00:00');
      expect(formatTimeLong(30)).toBe('00:00:30');
      expect(formatTimeLong(65)).toBe('00:01:05');
      expect(formatTimeLong(3665)).toBe('01:01:05');
      expect(formatTimeLong(7325)).toBe('02:02:05');
    });

    it('должен обрабатывать некорректные значения', () => {
      expect(formatTimeLong(NaN)).toBe('00:00:00');
      expect(formatTimeLong(Infinity)).toBe('00:00:00');
      expect(formatTimeLong(-10)).toBe('00:00:00');
    });
  });

  describe('formatTime', () => {
    it('должен использовать короткий формат для времени меньше часа', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(30)).toBe('00:30');
      expect(formatTime(3599)).toBe('59:59');
    });

    it('должен использовать длинный формат для времени больше часа', () => {
      expect(formatTime(3600)).toBe('01:00:00');
      expect(formatTime(3665)).toBe('01:01:05');
    });

    it('должен обрабатывать некорректные значения', () => {
      expect(formatTime(NaN)).toBe('00:00');
      expect(formatTime(Infinity)).toBe('00:00');
      expect(formatTime(-10)).toBe('00:00');
    });
  });

  describe('parseTime', () => {
    it('должен парсить формат mm:ss', () => {
      expect(parseTime('00:00')).toBe(0);
      expect(parseTime('00:30')).toBe(30);
      expect(parseTime('01:05')).toBe(65);
      expect(parseTime('59:59')).toBe(3599);
    });

    it('должен парсить формат hh:mm:ss', () => {
      expect(parseTime('00:00:00')).toBe(0);
      expect(parseTime('01:01:05')).toBe(3665);
      expect(parseTime('02:02:05')).toBe(7325);
    });

    it('должен обрабатывать некорректные строки', () => {
      expect(parseTime('invalid')).toBeNull();
      expect(parseTime('12')).toBeNull();
      expect(parseTime('12:34:56:78')).toBeNull();
      expect(parseTime('')).toBeNull();
      expect(parseTime('abc:def')).toBeNull();
    });

    it('должен обрабатывать null и undefined', () => {
      expect(parseTime(null as any)).toBeNull();
      expect(parseTime(undefined as any)).toBeNull();
    });
  });

  describe('formatTimeReadable', () => {
    it('должен форматировать секунды в читаемый формат', () => {
      expect(formatTimeReadable(0)).toBe('0 сек');
      expect(formatTimeReadable(30)).toBe('30 сек');
      expect(formatTimeReadable(60)).toBe('1 мин');
      expect(formatTimeReadable(90)).toBe('1 мин 30 сек');
      expect(formatTimeReadable(3600)).toBe('1 ч');
      expect(formatTimeReadable(3665)).toBe('1 ч 1 мин');
      expect(formatTimeReadable(7325)).toBe('2 ч 2 мин');
    });

    it('должен обрабатывать некорректные значения', () => {
      expect(formatTimeReadable(NaN)).toBe('0 сек');
      expect(formatTimeReadable(Infinity)).toBe('0 сек');
      expect(formatTimeReadable(-10)).toBe('0 сек');
    });
  });
});


