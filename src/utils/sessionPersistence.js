// ─── Сохранение сессии сайта между запусками приложения ─────────────────────
//
// Почему это нужно. Авторизация на сайте живёт в cookie внутри WebView.
// Если сервер выдаёт «сессионную» cookie (без Expires/Max-Age), то и
// Android WebView, и iOS WKWebView удаляют её, как только система
// выгружает процесс приложения, — и при следующем открытии сайт снова
// просит логин и пароль. На Android вдобавок WebView пишет cookie на диск
// с задержкой, поэтому свежий вход теряется, если приложение закрыли
// вскоре после логина.
//
// Что делаем:
//   • периодически (после загрузки страниц и при уходе в фон) снимаем
//     копию cookie сайта и кладём её в AsyncStorage;
//   • при уходе в фон принудительно сбрасываем cookie WebView на диск;
//   • при старте возвращаем в WebView те cookie, которые система стёрла.
//     Существующие cookie не трогаем, чтобы не затереть более свежие.
//
// Срок действия сессии по-прежнему решает сервер: если он сам завершил
// сессию, сайт покажет форму входа, как и раньше.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/config';

const STORAGE_KEY = 'webview_session_cookies_v1';
// На сколько продлеваем «сессионные» cookie при восстановлении.
const RESTORED_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней
const SAVE_DEBOUNCE_MS = 1000;
const IOS_STORE = { iosCookieStore: 'webKit' }; // хранилище, которым пользуется WKWebView

// Нативный модуль есть только в собственной сборке (EAS / dev build).
// В Expo Go его нет — тогда приложение работает как раньше, без сохранения.
let CookieManager = null;
try {
  CookieManager = require('@preeternal/react-native-cookie-manager').default;
} catch (e) {
  CookieManager = null;
}

const isSupported = () => !!CookieManager && Platform.OS !== 'web';

function cookieKey(c) {
  const domain = String(c.domain || '').toLowerCase().replace(/^\./, '');
  return `${c.name}|${domain}|${c.path || '/'}`;
}

function toStoredCookie(c) {
  const stored = { name: c.name, value: c.value };
  ['path', 'domain', 'expires', 'secure', 'httpOnly', 'sameSite'].forEach((k) => {
    if (c[k] !== undefined && c[k] !== null && c[k] !== '') stored[k] = c[k];
  });
  return stored;
}

function toRestorableCookie(c) {
  const cookie = {
    name: c.name,
    value: c.value,
    path: c.path || '/',
    secure: c.secure !== undefined ? !!c.secure : BASE_URL.startsWith('https'),
  };
  if (c.httpOnly) cookie.httpOnly = true;
  if (c.sameSite) cookie.sameSite = c.sameSite;
  // Явный domain передаём только для доменных cookie (".site.ru"),
  // иначе cookie остаётся привязанной к хосту BASE_URL, как и была.
  if (c.domain && String(c.domain).startsWith('.')) cookie.domain = c.domain;

  const expiresAt = c.expires ? Date.parse(c.expires) : NaN;
  if (!Number.isNaN(expiresAt)) {
    if (expiresAt <= Date.now()) return null; // уже истекла — не возвращаем
    cookie.expires = new Date(expiresAt).toISOString();
  } else {
    cookie.maxAge = RESTORED_COOKIE_MAX_AGE;
  }
  return cookie;
}

async function readCookies() {
  return CookieManager.getAsArray(BASE_URL, IOS_STORE);
}

/** Снимает копию cookie сайта и сохраняет её. */
export async function saveSession() {
  if (!isSupported()) return;
  try {
    const cookies = await readCookies();
    const stored = (cookies || []).filter((c) => c && c.name).map(toStoredCookie);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    // Не удалось прочитать — оставляем предыдущую копию как есть.
    console.warn('[session] save failed:', e?.code || e?.message || e);
  }
}

let saveTimer = null;
/** Отложенное сохранение: несколько вызовов подряд дают одну запись. */
export function scheduleSaveSession() {
  if (!isSupported()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveSession();
  }, SAVE_DEBOUNCE_MS);
}

/** Вызывается при уходе приложения в фон. */
export async function persistSessionNow() {
  if (!isSupported()) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await saveSession();
  if (Platform.OS === 'android') {
    try {
      await CookieManager.flush(); // записать cookie WebView на диск
    } catch (e) {
      console.warn('[session] flush failed:', e?.code || e?.message || e);
    }
  }
}

/** Вызывается при старте до создания WebView: возвращает стёртые cookie. */
export async function restoreSession() {
  if (!isSupported()) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length === 0) return;

    const current = await readCookies();
    const present = new Set((current || []).map(cookieKey));

    let restored = 0;
    for (const c of saved) {
      if (!c || !c.name || present.has(cookieKey(c))) continue;
      const cookie = toRestorableCookie(c);
      if (!cookie) continue;
      try {
        await CookieManager.set(BASE_URL, cookie, IOS_STORE);
        restored += 1;
      } catch (e) {
        console.warn('[session] restore skipped a cookie:', e?.code || e?.message || e);
      }
    }
    if (restored > 0 && Platform.OS === 'android') {
      await CookieManager.flush();
    }
  } catch (e) {
    console.warn('[session] restore failed:', e?.code || e?.message || e);
  }
}
