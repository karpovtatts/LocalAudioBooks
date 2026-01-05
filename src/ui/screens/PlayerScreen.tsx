/**
 * Экран обычного плеера - воспроизведение, перемотка, управление
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { formatTime } from '../../utils';
import {
  togglePlayPause,
  seek,
  skipBackward,
  skipForward,
  setSpeed,
  setVolume,
  getCurrentPosition,
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

export function PlayerScreen() {
  const { currentBook, playerState, settings, setCurrentScreen, updateSettings } = useApp();
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [volume, setVolumeState] = useState(1.0);
  
  // Обновление позиции и длительности
  useEffect(() => {
    if (!playerState) return;
    
    setCurrentPosition(playerState.currentPosition);
    setDuration(playerState.duration);
    setVolumeState(playerState.volume);
  }, [playerState]);
  
  // Обновление позиции каждую секунду во время воспроизведения
  useEffect(() => {
    if (!playerState?.isPlaying || isDragging) return;
    
    const interval = setInterval(() => {
      setCurrentPosition(getCurrentPosition());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [playerState?.isPlaying, isDragging]);
  
  if (!currentBook) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Книга не выбрана</p>
          <Button onClick={() => setCurrentScreen('library')}>Вернуться в библиотеку</Button>
        </div>
      </div>
    );
  }
  
  const skipInterval = settings?.preferredSkipInterval || 30;
  
  // Обработчики для жестов свайпа
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
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseFloat(e.target.value);
    setCurrentPosition(newPosition);
    if (!isDragging) {
      seek(newPosition);
    }
  };
  
  const handleSeekMouseUp = () => {
    if (isDragging) {
      seek(currentPosition);
      setIsDragging(false);
    }
  };
  
  const handleSeekMouseDown = () => {
    setIsDragging(true);
  };
  
  const handleSpeedChange = async (newSpeed: number) => {
    await setSpeed(newSpeed);
    await updateSettings({ playbackSpeed: newSpeed });
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolumeState(newVolume);
    setVolume(newVolume);
  };
  
  return (
    <div 
      className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8"
      {...swipeHandlers}
    >
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-6 flex justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentScreen('library')}
          >
            ← Назад в библиотеку
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentScreen('settings')}
          >
            ⚙️ Настройки
          </Button>
        </div>
        
        <Card className="p-6">
          {/* Обложка и информация */}
          <div className="text-center mb-6">
            <div className="w-48 h-48 mx-auto mb-4 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              {currentBook.cover ? (
                <img
                  src={currentBook.cover}
                  alt={currentBook.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="text-6xl text-gray-400 dark:text-gray-500">📚</div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {currentBook.title}
            </h2>
            {currentBook.author && (
              <p className="text-gray-600 dark:text-gray-400">{currentBook.author}</p>
            )}
          </div>
          
          {/* Ползунок прогресса */}
          <div className="mb-6">
            <label htmlFor="progress-slider" className="sr-only">
              Прогресс воспроизведения
            </label>
            <input
              id="progress-slider"
              type="range"
              min="0"
              max={duration || 0}
              value={currentPosition}
              onChange={handleSeek}
              onMouseDown={handleSeekMouseDown}
              onMouseUp={handleSeekMouseUp}
              onTouchEnd={handleSeekMouseUp}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #2563eb 0%, #2563eb ${(currentPosition / (duration || 1)) * 100}%, #e5e7eb ${(currentPosition / (duration || 1)) * 100}%, #e5e7eb 100%)`,
              }}
              aria-label="Прогресс воспроизведения"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={currentPosition}
              aria-valuetext={`${formatTime(currentPosition)} из ${formatTime(duration)}`}
            />
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-1" aria-hidden="true">
              <span>{formatTime(currentPosition)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Центральная кнопка Play/Pause - крупная и контрастная */}
          <div className="flex justify-center mb-6">
            <button
              onClick={() => handleButtonClick(togglePlayPause)}
              className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white flex items-center justify-center text-6xl md:text-7xl focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-offset-2 transition-colors shadow-2xl active:scale-95"
              style={{
                minHeight: '128px',
                minWidth: '128px',
              }}
              aria-label={playerState?.isPlaying ? 'Пауза' : 'Воспроизведение'}
              aria-pressed={playerState?.isPlaying}
            >
              {playerState?.isPlaying ? '⏸' : '▶'}
            </button>
          </div>
          
          {/* Кнопки перемотки - крупные и контрастные */}
          <div className="mb-6">
            <div className="flex justify-center gap-3 mb-3">
              {([15, 30, 60] as const).map((seconds) => (
                <button
                  key={`back-${seconds}`}
                  onClick={() => handleButtonClick(() => skipBackward(seconds))}
                  className="px-6 py-4 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 active:bg-gray-600 dark:active:bg-gray-500 text-white text-lg font-bold rounded-lg min-w-[100px] min-h-[60px] transition-colors focus:outline-none focus:ring-4 focus:ring-gray-500 shadow-lg"
                >
                  ← {seconds} сек
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-3 mb-3">
              {([15, 30, 60] as const).map((seconds) => (
                <button
                  key={`forward-${seconds}`}
                  onClick={() => handleButtonClick(() => skipForward(seconds))}
                  className="px-6 py-4 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 active:bg-gray-600 dark:active:bg-gray-500 text-white text-lg font-bold rounded-lg min-w-[100px] min-h-[60px] transition-colors focus:outline-none focus:ring-4 focus:ring-gray-500 shadow-lg"
                >
                  {seconds} сек →
                </button>
              ))}
            </div>
            <div className="text-center mt-3">
              <button
                onClick={() => {
                  const intervals: Array<15 | 30 | 60> = [15, 30, 60];
                  const currentIndex = intervals.indexOf(skipInterval);
                  const nextIndex = (currentIndex + 1) % intervals.length;
                  updateSettings({ preferredSkipInterval: intervals[nextIndex] });
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Текущий интервал: {skipInterval} сек (нажмите для смены)
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Свайп влево/вправо для перемотки
              </p>
            </div>
          </div>
          
          {/* Скорость воспроизведения */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Скорость: {playerState?.speed || 1.0}×
            </label>
            <div className="flex gap-2">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((speed) => (
                <Button
                  key={speed}
                  size="sm"
                  variant={playerState?.speed === speed ? 'primary' : 'secondary'}
                  onClick={() => handleSpeedChange(speed)}
                >
                  {speed}×
                </Button>
              ))}
            </div>
          </div>
          
          {/* Громкость */}
          <div>
            <label htmlFor="volume-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Громкость: {Math.round(volume * 100)}%
            </label>
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              aria-label="Громкость"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(volume * 100)}
              aria-valuetext={`${Math.round(volume * 100)}%`}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

