const LOCAL_ORIGINS = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:80',
  'http://localhost:5173',
];

/**
 * Список origin для HTTP CORS (`main.ts`) и Socket.IO (`NotificationGateway`).
 * Читается при каждом вызове: `.env` загружается ConfigModule уже после того,
 * как декоратор gateway вычислен при импорте модуля.
 */
export function getAllowedOrigins(): string[] {
  const clientUrl = process.env.CLIENT_URL;
  return clientUrl ? [clientUrl, ...LOCAL_ORIGINS] : [...LOCAL_ORIGINS];
}

/** `origin` для Socket.IO: тот же список, что у HTTP CORS. Запросы без Origin (не браузер) пропускаются. */
export function socketCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  callback(null, !origin || getAllowedOrigins().includes(origin));
}
