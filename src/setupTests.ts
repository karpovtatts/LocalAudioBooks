import '@testing-library/jest-dom';

// Полифилл для structuredClone (нужен для fake-indexeddb)
import structuredClonePolyfill from '@ungap/structured-clone';
if (typeof global.structuredClone === 'undefined') {
  (global as any).structuredClone = structuredClonePolyfill;
}

// Подключаем fake-indexeddb для тестирования IndexedDB
import 'fake-indexeddb/auto';

