/**
 * Экран плеера в режиме Car Mode - упрощённый интерфейс для управления в автомобиле
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { formatTime } from '../../utils';
import {
  togglePlayPause,
  skipBackward,
  skipForward,
  getCurrentPosition,
  getDuration,
} from '../../player';

// Утилита для вибрации (с проверкой поддержки)
function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// Хук для обработки жестов свайпа
function useSwipeGesture(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold: number = 50
) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchEndRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchEndRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;

    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = touchEndRef.current.y - touchStartRef.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Проверяем, что это горизонтальный свайп (не вертикальный)
    if (absDeltaX > absDeltaY && absDeltaX > threshold) {
      if (deltaX > 0) {
        // Свайп вправо
        onSwipeRight();
      } else {
        // Свайп влево
        onSwipeLeft();
      }
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}

export function CarModeScreen() {
  const { currentBook, playerState, settings, setCurrentScreen } = useApp();
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const skipInterval = settings?.preferredSkipInterval || 30;
  
  // Обновление позиции и длительности
  useEffect(() => {
    if (!playerState) return;
    
    setCurrentPosition(playerState.currentPosition);
    setDuration(playerState.duration);
  }, [playerState]);
  
  // Обновление позиции каждую секунду во время воспроизведения
  useEffect(() => {
    if (!playerState?.isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentPosition(getCurrentPosition());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [playerState?.isPlaying]);
  
  // Обработчики для жестов
  const handleSwipeLeft = () => {
    vibrate(50); // Короткая вибрация
    skipForward(skipInterval);
  };
  
  const handleSwipeRight = () => {
    vibrate(50); // Короткая вибрация
    skipBackward(skipInterval);
  };
  
  const swipeHandlers = useSwipeGesture(handleSwipeLeft, handleSwipeRight);
  
  // Обработчик нажатия кнопки с вибрацией
  const handleButtonClick = (callback: () => void) => {
    vibrate(50); // Короткая вибрация при нажатии
    callback();
  };
  
  if (!currentBook) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-2xl mb-8">Книга не выбрана</p>
          <button
            onClick={() => setCurrentScreen('library')}
            className="px-8 py-4 bg-blue-600 text-white text-xl rounded-lg font-bold min-w-[200px] min-h-[80px]"
          >
            Вернуться в библиотеку
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className="min-h-screen bg-gray-900 text-white flex flex-col"
      {...swipeHandlers}
    >
      {/* Кнопка "Назад в библиотеку" в левом верхнем углу */}
      <div className="p-4">
        <button
          onClick={() => handleButtonClick(() => setCurrentScreen('library'))}
          className="px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white text-lg font-bold rounded-lg min-w-[120px] min-h-[80px] transition-colors"
        >
          ← Назад
        </button>
      </div>
      
      {/* Крупный текст: название книги и автор сверху */}
      <div className="px-6 py-4 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white">
          {currentBook.title}
        </h1>
        {currentBook.author && (
          <p className="text-xl md:text-2xl text-gray-300">
            {currentBook.author}
          </p>
        )}
      </div>
      
      {/* Крупные цифры: текущая позиция и общая длительность */}
      <div className="px-6 py-4 text-center">
        <div className="text-5xl md:text-6xl font-bold text-white mb-2">
          {formatTime(currentPosition)}
        </div>
        <div className="text-3xl md:text-4xl text-gray-400">
          / {formatTime(duration)}
        </div>
      </div>
      
      {/* Огромная центральная кнопка Play/Pause (25-30% высоты экрана) */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <button
          onClick={() => handleButtonClick(togglePlayPause)}
          className="w-[60vw] h-[60vw] max-w-[300px] max-h-[300px] min-w-[200px] min-h-[200px] rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center text-8xl md:text-9xl focus:outline-none focus:ring-4 focus:ring-blue-400 transition-colors shadow-2xl"
          style={{
            minHeight: '25vh', // Минимум 25% высоты экрана
          }}
          aria-label={playerState?.isPlaying ? 'Пауза' : 'Воспроизведение'}
          aria-pressed={playerState?.isPlaying}
        >
          {playerState?.isPlaying ? '⏸' : '▶'}
        </button>
      </div>
      
      {/* Два ряда больших кнопок перемотки */}
      <div className="px-6 py-8 space-y-4">
        {/* Ряд назад: ←15 сек   ←30 сек   ←60 сек */}
        <div className="flex justify-center gap-4">
          {([15, 30, 60] as const).map((seconds) => (
            <button
              key={`back-${seconds}`}
              onClick={() => handleButtonClick(() => skipBackward(seconds))}
              className="px-6 py-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-xl font-bold rounded-lg min-w-[120px] min-h-[100px] transition-colors focus:outline-none focus:ring-4 focus:ring-gray-500"
            >
              ← {seconds} сек
            </button>
          ))}
        </div>
        
        {/* Ряд вперёд: 15 сек→   30 сек→   60 сек→ */}
        <div className="flex justify-center gap-4">
          {([15, 30, 60] as const).map((seconds) => (
            <button
              key={`forward-${seconds}`}
              onClick={() => handleButtonClick(() => skipForward(seconds))}
              className="px-6 py-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-xl font-bold rounded-lg min-w-[120px] min-h-[100px] transition-colors focus:outline-none focus:ring-4 focus:ring-gray-500"
            >
              {seconds} сек →
            </button>
          ))}
        </div>
        
        {/* Индикатор текущего интервала */}
        <div className="text-center mt-4">
          <p className="text-lg text-gray-400">
            Текущий интервал: <span className="text-white font-bold">{skipInterval} сек</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Свайп влево/вправо для перемотки
          </p>
        </div>
      </div>
    </div>
  );
}

