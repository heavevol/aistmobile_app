import React, { useRef, useState, useEffect } from 'react';
import {
  View, StyleSheet, ActivityIndicator,
  Text, TouchableOpacity, SafeAreaView, StatusBar, Linking, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PRIMARY_COLOR, BASE_URL } from '../constants/config';

const DOWNLOADABLE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.csv', '.txt',
];

const UUID_PATH_REGEX = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;

const MIME_EXT = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/csv': 'csv',
  'application/zip': 'zip',
};

function isDownloadableUrl(url) {
  if (!url) return false;
  const withoutHash = url.split('#')[0];
  const clean = withoutHash.split('?')[0].toLowerCase();
  if (DOWNLOADABLE_EXTENSIONS.some((ext) => clean.endsWith(ext))) {
    return true;
  }
  try {
    const { pathname } = new URL(url);
    return UUID_PATH_REGEX.test(pathname);
  } catch (e) {
    return false;
  }
}

export default function SectionScreen({ url, title, token }) {
  const webRef   = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [ready,   setReady]   = useState(false);
  const sharingInProgress = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Сайт формирует PDF/Excel как Blob в памяти и отдаёт его разными
  // способами: window.open('blob:...'), отложенная запись в окно
  // (window.open('') + w.location.href = ... после долгой генерации),
  // клик по скрытой ссылке (.click() или dispatchEvent(new MouseEvent))
  // — характерно для FileSaver.js — либо присвоение blob-ссылки src/href
  // произвольному элементу. Перехватываем все эти пути и передаём
  // содержимое файла в React Native через postMessage.
  const injectedJSBeforeLoad = `
    (function() {
      function applyRenderHints() {
        if (!document.querySelector('meta[name="viewport"]')) {
          var meta = document.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
          document.head.appendChild(meta);
        }
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
      }
      if (document.head) {
        applyRenderHints();
      } else {
        document.addEventListener('DOMContentLoaded', applyRenderHints);
      }

      function sendToApp(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function openUrl(u) {
        if (!u) return;
        if (String(u).indexOf('blob:') === 0) {
          fetch(u)
            .then(function(res) { return res.blob(); })
            .then(function(blob) {
              var reader = new FileReader();
              reader.onloadend = function() {
                var base64 = String(reader.result).split(',')[1] || '';
                sendToApp({ type: 'blob-file', mime: blob.type || 'application/octet-stream', base64: base64 });
              };
              reader.onerror = function() {
                sendToApp({ type: 'blob-error', message: 'FileReader error' });
              };
              reader.readAsDataURL(blob);
            })
            .catch(function(err) {
              sendToApp({ type: 'blob-error', message: String(err && err.message) });
            });
          return;
        }
        window.location.href = u;
      }

      if (window.HTMLAnchorElement && HTMLAnchorElement.prototype.click) {
        var _origAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
          try {
            var href = this.getAttribute ? this.getAttribute('href') : this.href;
            if (href && href.indexOf('blob:') === 0) {
              openUrl(href);
              return;
            }
          } catch (e) {}
          return _origAnchorClick.apply(this, arguments);
        };
      }

      if (window.HTMLAnchorElement && HTMLAnchorElement.prototype.dispatchEvent) {
        var _origDispatchEvent = HTMLAnchorElement.prototype.dispatchEvent;
        HTMLAnchorElement.prototype.dispatchEvent = function(evt) {
          try {
            if (evt && evt.type === 'click') {
              var href = this.getAttribute ? this.getAttribute('href') : this.href;
              if (href && href.indexOf('blob:') === 0) {
                openUrl(href);
                return true;
              }
            }
          } catch (e) {}
          return _origDispatchEvent.apply(this, arguments);
        };
      }

      function checkElementForBlob(el) {
        if (!el || !el.getAttribute || !el.tagName) return;
        if (el.tagName.toUpperCase() === 'IMG') return;
        ['src', 'href'].forEach(function(attr) {
          var val = el.getAttribute(attr);
          if (val && val.indexOf('blob:') === 0) {
            openUrl(val);
          }
        });
      }
      try {
        var mo = new MutationObserver(function(mutations) {
          mutations.forEach(function(m) {
            if (m.type === 'attributes') {
              checkElementForBlob(m.target);
            } else if (m.type === 'childList' && m.addedNodes) {
              m.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                  checkElementForBlob(node);
                  if (node.querySelectorAll) {
                    var found = node.querySelectorAll('a[href],iframe[src],embed[src],object[data]');
                    for (var i = 0; i < found.length; i++) {
                      checkElementForBlob(found[i]);
                    }
                  }
                }
              });
            }
          });
        });
        mo.observe(document, {
          attributes: true,
          attributeFilter: ['src', 'href'],
          childList: true,
          subtree: true,
        });
      } catch (e) {}

      if (navigator.share) {
        var _origShare = navigator.share.bind(navigator);
        navigator.share = function(data) {
          if (data && data.files && data.files.length > 0) {
            data.files.forEach(function(file) {
              var reader = new FileReader();
              reader.onloadend = function() {
                var base64 = String(reader.result).split(',')[1] || '';
                sendToApp({ type: 'blob-file', mime: file.type || 'application/octet-stream', base64: base64 });
              };
              reader.readAsDataURL(file);
            });
            return Promise.resolve();
          }
          return _origShare(data);
        };
      }

      function makeFakeWindow() {
        var fakeLoc = {};
        try {
          Object.defineProperty(fakeLoc, 'href', {
            get: function() { return ''; },
            set: function(v) { openUrl(v); },
          });
        } catch (e) {}
        fakeLoc.replace = function(v) { openUrl(v); };
        fakeLoc.assign  = function(v) { openUrl(v); };

        var fake = {
          closed: false,
          close: function() {},
          focus: function() {},
          blur: function() {},
          postMessage: function() {},
          document: {
            write: function() {},
            close: function() {},
            open: function() { return fake.document; },
          },
        };
        try {
          Object.defineProperty(fake, 'location', {
            get: function() { return fakeLoc; },
            set: function(v) {
              var u = (typeof v === 'string') ? v : (v && v.href);
              openUrl(u);
            },
          });
        } catch (e) {
          fake.location = fakeLoc;
        }
        return fake;
      }

      var _origOpen = window.open;
      window.open = function(url, target, features) {
        if (url) {
          openUrl(url);
        }
        return makeFakeWindow();
      };
    })();
    true;
  `;

  const injectedJS = `
    (function() {
      ${token && token !== 'webview_mode' ? `
        localStorage.setItem('auth_token', '${token}');
        document.cookie = 'auth_token=${token}; path=/';
      ` : ''}
    })();
    true;
  `;

  const handleShouldStartLoad = (request) => {
    const { url: reqUrl } = request;
    if (isDownloadableUrl(reqUrl)) {
      Linking.openURL(reqUrl).catch(() => {
        Alert.alert('Не удалось открыть файл', 'Проверьте, установлено ли приложение для просмотра этого типа файлов.');
      });
      return false;
    }
    return true;
  };

  const handleFileDownload = ({ nativeEvent }) => {
    const downloadUrl = nativeEvent?.downloadUrl;
    if (downloadUrl) {
      Linking.openURL(downloadUrl).catch(() => {
        Alert.alert('Не удалось скачать файл');
      });
    }
  };

  const handleMessage = async ({ nativeEvent }) => {
    try {
      const data = JSON.parse(nativeEvent.data);
      if (data.type === 'blob-error') {
        Alert.alert('Не удалось открыть файл', data.message || '');
        return;
      }
      if (data.type === 'blob-file' && data.base64) {
        if (sharingInProgress.current) {
          return;
        }
        sharingInProgress.current = true;
        try {
          const ext = MIME_EXT[data.mime] || 'bin';
          const fileUri = FileSystem.cacheDirectory + 'document_' + Date.now() + '.' + ext;
          await FileSystem.writeAsStringAsync(fileUri, data.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, {
              mimeType: data.mime,
              dialogTitle: 'Открыть файл',
            });
          } else {
            Alert.alert('Файл сохранён', fileUri);
          }
        } finally {
          sharingInProgress.current = false;
        }
      }
    } catch (e) {
      sharingInProgress.current = false;
      Alert.alert('Не удалось открыть файл', String((e && e.message) || e));
    }
  };

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
        injectedJavaScriptBeforeContentLoaded={injectedJSBeforeLoad}
        injectedJavaScript={injectedJS}
        textZoom={100}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
        onHttpError={() => { setLoading(false); setError(true); }}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onFileDownload={handleFileDownload}
        onMessage={handleMessage}
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
  container: { flex: 1, backgroundColor: '#0D1B2E', paddingTop: StatusBar.currentHeight || 0 },
  webview: { flex: 1, backgroundColor: '#0D1B2E' },
  loader: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0D1B2E', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  loaderText: { color: '#8AAACF', marginTop: 12, fontSize: 14 },
  errorContainer: { flex: 1, backgroundColor: '#0D1B2E', alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  errorText: { color: '#8AAACF', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: { backgroundColor: '#1A5FAB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
});
