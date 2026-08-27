import { Provider } from 'react-redux';
import { configureStore } from './store';
import { ChatModule } from '@chudu24/chat-module';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const store = configureStore();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ChatModule />
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;