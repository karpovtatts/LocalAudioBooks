/**
 * Экран настроек - управление настройками приложения
 */

import React from 'react';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export function SettingsScreen() {
  const { settings, updateSettings, setCurrentScreen } = useApp();
  
  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Загрузка настроек...</p>
        </div>
      </div>
    );
  }
  
  const handleSkipIntervalChange = (interval: 15 | 30 | 60) => {
    updateSettings({ preferredSkipInterval: interval });
  };
  
  const handleSpeedChange = async (speed: number) => {
    await updateSettings({ playbackSpeed: speed });
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-6">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentScreen('library')}
          >
            ← Назад
          </Button>
        </div>
        
        <Card className="p-6 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Настройки
          </h2>
          
          {/* Предпочтительный интервал перемотки */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Предпочтительный интервал перемотки
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Выберите интервал для быстрой перемотки (используется по умолчанию)
            </p>
            <div className="flex gap-2">
              {([15, 30, 60] as const).map((interval) => (
                <Button
                  key={interval}
                  variant={settings.preferredSkipInterval === interval ? 'primary' : 'secondary'}
                  onClick={() => handleSkipIntervalChange(interval)}
                >
                  {interval} сек
                </Button>
              ))}
            </div>
          </div>
          
          {/* Скорость воспроизведения по умолчанию */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Скорость воспроизведения по умолчанию
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Скорость, которая будет использоваться при загрузке новой книги
            </p>
            <div className="flex gap-2 flex-wrap">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((speed) => (
                <Button
                  key={speed}
                  variant={settings.playbackSpeed === speed ? 'primary' : 'secondary'}
                  onClick={() => handleSpeedChange(speed)}
                >
                  {speed}×
                </Button>
              ))}
            </div>
          </div>
          
        </Card>
      </div>
    </div>
  );
}

