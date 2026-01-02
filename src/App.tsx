import { AppProvider, useApp } from './ui';
import { LibraryScreen } from './ui/screens/LibraryScreen';
import { PlayerScreen } from './ui/screens/PlayerScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

function AppContent() {
  const { currentScreen, settings } = useApp();
  
  // Если включён Car Mode, показываем специальный экран (будет реализован в этапе 6)
  // Для этапа 5 показываем обычный плеер
  const screenToShow = settings?.carModeEnabled && currentScreen === 'player' 
    ? 'player' // В этапе 6 здесь будет CarModeScreen
    : currentScreen;
  
  switch (screenToShow) {
    case 'library':
      return <LibraryScreen />;
    case 'player':
      return <PlayerScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <LibraryScreen />;
  }
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;

