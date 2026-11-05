import 'server-only';
import type {
  Cache,
  Clock,
  DocumentRenderer,
  EmailSender,
  IdempotencyStore,
  IdGenerator,
  Notifier,
  PasswordHasher,
  RateLimiter,
  Repositories,
  TokenService,
  UnitOfWork,
} from '@app-layer/ports';
import { db } from './db/client';
import { createRepositories, createUnitOfWork } from './repositories';
import {
  bcryptHasher,
  joseTokens,
  memoryCache,
  pgIdempotency,
  pgRateLimiter,
  systemClock,
  uuidGenerator,
} from './services';
import { createEmailNotifier } from './email/notifier';
import { createResendSender } from './email/resend';
import { documentRenderer } from './documents/renderer';

export interface Container {
  repos: Repositories;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  hasher: PasswordHasher;
  tokens: TokenService;
  cache: Cache;
  idempotency: IdempotencyStore;
  rateLimiter: RateLimiter;
  notifier: Notifier;
  emailSender: EmailSender;
  documents: DocumentRenderer;
}

const globalForContainer = globalThis as unknown as { __mersamContainer?: Container };

function build(): Container {
  return {
    repos: createRepositories(db),
    uow: createUnitOfWork(db),
    clock: systemClock,
    ids: uuidGenerator,
    hasher: bcryptHasher,
    tokens: joseTokens,
    cache: memoryCache,
    idempotency: pgIdempotency,
    rateLimiter: pgRateLimiter,
    notifier: createEmailNotifier(),
    emailSender: createResendSender(),
    documents: documentRenderer,
  };
}

/**
 * The single place the application layer meets concrete adapters. Route
 * handlers and server components call this, never a repository directly.
 */
export function getContainer(): Container {
  if (!globalForContainer.__mersamContainer) {
    globalForContainer.__mersamContainer = build();
  }
  return globalForContainer.__mersamContainer;
}
