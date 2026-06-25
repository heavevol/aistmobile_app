// ─── Конфигурация приложения АИСТ ───────────────────────────────────────────
// Когда станут известны конкретные URL разделов — замените значения здесь

export const BASE_URL = 'https://sistema-aist.ru';
export const API_URL  = 'http://5.23.53.10:8902';

export const SECTIONS = {
  videowall: {
    url: `${BASE_URL}/videowall`,   // заменить на реальный путь
    fallback: BASE_URL,
  },
  meteowall: {
    url: `${BASE_URL}/meteowall`,   // заменить на реальный путь
    fallback: BASE_URL,
  },
  journal: {
    url: `${BASE_URL}/journal`,     // заменить на реальный путь
    fallback: BASE_URL,
  },
  map: {
    url: `${BASE_URL}/map`,         // заменить на реальный путь
    fallback: BASE_URL,
  },
};

export const APP_NAME = 'АИСТ';
export const PRIMARY_COLOR = '#0D2B5E';
export const ACCENT_COLOR  = '#1A5FAB';
export const TAB_BG        = '#0D2B5E';
export const TAB_ACTIVE    = '#4A9EFF';
export const TAB_INACTIVE  = '#8AAACF';
