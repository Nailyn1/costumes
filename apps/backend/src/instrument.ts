// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: 'https://77840c23bdbb8301e4e55b85b32305d6@o4510660897800192.ingest.de.sentry.io/4510915747053648',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  sendDefaultPii: true,
});
