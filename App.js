import React, { useEffect, useState } from 'react';
import { View, StatusBar, AppState, ActivityIndicator } from 'react-native';
import SectionScreen from './src/screens/SectionScreen';
import { BASE_URL } from './src/constants/config';
import { restoreSession, persistSessionNow } from './src/utils/sessionPersistence';

const PRIMARY_COLOR = '#0D2B5E';
// Если восстановление по какой-то причине зависло, не держим пользователя.
const RESTORE_TIMEOUT_MS = 3000;

export default function App() {
  const [sessionRestored, setSessionRestored] = useState(false);

  // Возвращаем cookie сайта до того, как WebView начнёт загрузку.
  useEffect(() => {
    let cancelled = false;
    const done = () => { if (!cancelled) setSessionRestored(true); };
    const timeout = setTimeout(done, RESTORE_TIMEOUT_MS);
    restoreSession().finally(() => {
      clearTimeout(timeout);
      done();
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  // Уходя в фон, сохраняем сессию и сбрасываем cookie на диск:
  // после этого система может выгрузить приложение в любой момент.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        persistSessionNow();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      {sessionRestored ? (
        <SectionScreen url={BASE_URL} token="webview_mode" />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#0D1B2E', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4A9EFF" />
        </View>
      )}
    </View>
  );
}
