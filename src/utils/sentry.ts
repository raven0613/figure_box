import * as Sentry from '@sentry/react';

export default () => {
  return Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.browserProfilingIntegration(),
      Sentry.replayIntegration(),
      Sentry.captureConsoleIntegration({
        levels: ['error', 'debug'],
      }),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', import.meta.env.VITE_API_ENDPOINT ?? ''],
    profilesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
};
