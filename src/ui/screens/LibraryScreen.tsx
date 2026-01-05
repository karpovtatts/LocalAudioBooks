/**
 * Экран библиотеки - отображение списка книг, поиск, добавление папки
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { formatTime } from '../../utils';
import type { Book } from '../../storage';

export function LibraryScreen() {
  const { books, isLoadingBooks, addFolder, openBook, getBookProgress, setCurrentScreen } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [bookProgresses, setBookProgresses] = useState<Map<string, number>>(new Map());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [booksCountBeforeAdd, setBooksCountBeforeAdd] = useState(0);
  
  // Отслеживание изменений количества книг для показа Toast
  React.useEffect(() => {
    if (!isLoadingBooks && books.length > booksCountBeforeAdd && booksCountBeforeAdd > 0) {
      const addedCount = books.length - booksCountBeforeAdd;
      setToastMessage(`Добавлено ${addedCount} ${addedCount === 1 ? 'книга' : addedCount < 5 ? 'книги' : 'книг'}`);
      setTimeout(() => setToastMessage(null), 3000);
      
      // Если добавлена только одна книга, автоматически открываем её
      if (addedCount === 1 && books.length > 0) {
        const newBook = books[books.length - 1];
        setTimeout(() => {
          openBook(newBook).catch((error) => {
            console.error('Ошибка открытия книги:', error);
          });
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length, isLoadingBooks, booksCountBeforeAdd]);
  
  // Загрузка прогресса для всех книг (оптимизировано: загружаем только при изменении списка книг)
  React.useEffect(() => {
    const loadProgresses = async () => {
      const progresses = new Map<string, number>();
      // Используем Promise.all для параллельной загрузки прогресса
      const progressPromises = books.map(async (book) => {
        const progress = await getBookProgress(book.id);
        if (progress) {
          return { bookId: book.id, position: progress.position };
        }
        return null;
      });
      
      const results = await Promise.all(progressPromises);
      results.forEach((result) => {
        if (result) {
          progresses.set(result.bookId, result.position);
        }
      });
      
      setBookProgresses(progresses);
    };
    
    if (books.length > 0) {
      loadProgresses();
    }
  }, [books.length, getBookProgress]); // Зависимость только от длины массива для оптимизации
  
  // Обработчик добавления папки
  const handleAddFolder = async () => {
    setBooksCountBeforeAdd(books.length);
    await addFolder();
  };
  
  // Фильтрация книг по поисковому запросу
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) {
      return books;
    }
    
    const query = searchQuery.toLowerCase();
    return books.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        (book.author && book.author.toLowerCase().includes(query))
    );
  }, [books, searchQuery]);
  
  // Вычисление процента прослушанного
  const getProgressPercent = (book: Book): number => {
    if (!book.duration) return 0;
    const position = bookProgresses.get(book.id) || 0;
    return Math.min(100, Math.round((position / book.duration) * 100));
  };
  
  // Проверка, является ли книга текущей (проигрывается сейчас)
  const isCurrentBook = (book: Book): boolean => {
    const progress = bookProgresses.get(book.id);
    return progress !== undefined && progress > 0;
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Toast уведомление */}
        {toastMessage && (
          <div className="fixed top-4 right-4 z-50 bg-green-600 dark:bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in">
            {toastMessage}
          </div>
        )}
        
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Библиотека
          </h1>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCurrentScreen('settings')}>
              ⚙️ Настройки
            </Button>
            <Button onClick={handleAddFolder} disabled={isLoadingBooks}>
              {isLoadingBooks ? 'Сканирование...' : '+ Добавить папку'}
            </Button>
          </div>
        </div>
        
        {books.length > 0 && (
          <div className="mb-6">
            <Input
              type="text"
              placeholder="Поиск по названию или автору..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
        
        {isLoadingBooks && books.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Сканирование папки...</p>
          </div>
        )}
        
        {!isLoadingBooks && filteredBooks.length === 0 && (
          <div className="text-center py-12">
            {books.length === 0 ? (
              <>
                <div className="text-8xl mb-6">📚</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Библиотека пуста
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                  Добавьте папку с аудиокнигами, чтобы начать прослушивание
                </p>
                <Button 
                  onClick={handleAddFolder}
                  size="lg"
                  className="text-xl px-8 py-4 min-h-[60px]"
                >
                  + Добавить первую книгу
                </Button>
              </>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Книги не найдены
                </p>
                <Button onClick={handleAddFolder}>Добавить папку</Button>
              </>
            )}
          </div>
        )}
        
        {filteredBooks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBooks.map((book) => {
              const progressPercent = getProgressPercent(book);
              const position = bookProgresses.get(book.id) || 0;
              
              return (
                <Card
                  key={book.id}
                  onClick={() => openBook(book)}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  title="Нажмите, чтобы открыть плеер"
                >
                  <div className="aspect-square bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    {book.cover ? (
                      <img
                        src={book.cover}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-4xl text-gray-400 dark:text-gray-500">
                        📚
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate flex-1">
                        {book.title}
                      </h3>
                      <span className="text-blue-600 dark:text-blue-400 ml-2" title="Нажмите для воспроизведения">
                        ▶️
                      </span>
                    </div>
                    {book.author && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 truncate">
                        {book.author}
                      </p>
                    )}
                    {progressPercent > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span className="font-semibold">{progressPercent}%</span>
                          {book.duration && (
                            <span>
                              {formatTime(position)} / {formatTime(book.duration)}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 shadow-inner">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              isCurrentBook(book)
                                ? 'bg-green-600 dark:bg-green-500 shadow-lg'
                                : 'bg-blue-600 dark:bg-blue-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

