/**
 * Базовый компонент карточки
 */

import React, { memo } from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Card = memo(function Card({ className = '', children, onClick }: CardProps) {
  const baseClasses = 'bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700';
  const interactiveClasses = onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : '';
  
  return (
    <div
      className={`${baseClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
});

