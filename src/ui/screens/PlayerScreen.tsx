/**
 * Экран обычного плеера - воспроизведение, перемотка, управление
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { formatTime } from '../../utils';
import {
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
} from '../../player';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
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
          
          {/* Центральная кнопка Play/Pause */}
          <div className="flex justify-center mb-6">
            <button
              onClick={togglePlayPause}
              className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white flex items-center justify-center text-4xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              aria-label={playerState?.isPlaying ? 'Пауза' : 'Воспроизведение'}
              aria-pressed={playerState?.isPlaying}
            >
              {playerState?.isPlaying ? '⏸' : '▶'}
            </button>
          </div>
          
          {/* Кнопки перемотки */}
          <div className="mb-6">
            <div className="flex justify-center gap-2 mb-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => skipBackward(15)}
              >
                ← 15 сек
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => skipBackward(30)}
              >
                ← 30 сек
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => skipBackward(60)}
              >
                ← 60 сек
              </Button>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => skipForward(15)}
              >
                15 сек →
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => skipForward(30)}
              >
                30 сек →
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => skipForward(60)}
              >
                60 сек →
              </Button>
            </div>
            <div className="text-center mt-2">
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

