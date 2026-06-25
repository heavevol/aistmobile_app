import React, { useRef, useState, useEffect } from 'react';
import {
  View, StyleSheet, ActivityIndicator,
  Text, TouchableOpacity, SafeAreaView, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { PRIMARY_COLOR, BASE_URL } from '../constants/config';

// Универсальный экран-раздел — отображает WebView с нужным URL
export default function SectionScreen({ url, title, token }) {
  const webRef   = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [ready,   setReady]   = useState(false);

  // Небольшая задержка перед показом WebView — чтобы касания работали
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Оптимизация карты + авторизация
  const injectedJS = `
    (function() {
      // Оптимизация рендеринга карты
      var style = document.createElement('style');
      style.textContent = \`
        .leaflet-container, .ol-viewport, [class*="map"] {
          will-change: transform;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          touch-action: pan-x pan-y;
        }
        * { -webkit-tap-highlight-color: transparent; }
      \`;
      document.head.appendChild(style);

      ${token && token !== 'webview_mode' ? `
        localStorage.setItem('auth_token', '${token}');
        document.cookie = 'auth_token=${token}; path=/';
      ` : ''}
    })();
    true;
  `;

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Раздел недоступен</Text>
        <Text style={styles.errorText}>
          Проверьте подключение к интернету{'\n'}или обратитесь к администратору
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setError(false); webRef.current?.reload(); }}
        >
          <Text style={styles.retryText}>Попробовать снова</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4A9EFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#4A9EFF" />
          <Text style={styles.loaderText}>Загрузка...</Text>
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ uri: url }}
        style={styles.webview}
        injectedJavaScript={injectedJS}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
        onHttpError={() => { setLoading(false); setError(true); }}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        scalesPageToFit={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        geolocationEnabled={true}
        androidLayerType="hardware"
        overScrollMode="never"
        nestedScrollEnabled={true}
        setBuiltInZoomControls={false}
        setSupportMultipleWindows={false}
        renderToHardwareTextureAndroid={true}
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B2E',
    paddingTop: StatusBar.currentHeight || 0,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0D1B2E',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D1B2E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loaderText: {
    color: '#8AAACF',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0D1B2E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  errorText: { color: '#8AAACF', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: {
    backgroundColor: '#1A5FAB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
