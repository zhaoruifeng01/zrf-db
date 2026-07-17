/**
 * SSE adapter for DB-GPT streaming endpoints (chat, agent runs, etc.).
 *
 * Uses @microsoft/fetch-event-source so we can POST with headers (Authorization,
 * user-id) — native EventSource only supports GET. The legacy code in
 * web/utils/react-sse-parser.ts and components/chat uses fetch-event-source
 * directly; this adapter centralizes auth injection and error teardown.
 */

import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source';

import { getAuthHeader, getUserId } from '../auth';
import { HEADER_USER_ID_KEY } from '../storage';

export interface SseOptions extends Omit<RequestInit, 'body' | 'headers' | 'signal'> {
  /** POST body. Default undefined (some endpoints use query params + empty body). */
  body?: BodyInit;
  /** Custom headers merged on top of auth + content-type defaults. */
  headers?: Record<string, string>;
  /** Called for each SSE message. Return false to stop the stream. */
  onMessage: (msg: EventSourceMessage) => void | false;
  /** Called when the stream closes normally. */
  onClose?: () => void;
  /** Called on non-retriable errors (e.g. 401, network). */
  onError?: (err: unknown) => void;
  /** Open callback. */
  onOpen?: (response: Response) => void;
  /** Disable automatic retry on connection drop. Default: true (no retry). */
  disableRetry?: boolean;
}

class FatalSseError extends Error {}

/**
 * Start a POST-based SSE stream. Returns an AbortController; call .abort() to
 * cleanly close the stream from the caller.
 */
export function startSse(url: string, options: SseOptions): AbortController {
  const controller = new AbortController();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...options.headers,
  };
  const auth = getAuthHeader();
  if (auth) headers.Authorization = auth;
  const userId = getUserId();
  if (userId) headers[HEADER_USER_ID_KEY] = userId;

  fetchEventSource(url, {
    method: 'POST',
    headers,
    body: options.body,
    signal: controller.signal,
    openWhenHidden: true,
    onopen: async response => {
      if (response.status === 401) {
        throw new FatalSseError('Unauthorized');
      }
      if (!response.ok && response.status !== 200) {
        throw new FatalSseError(`HTTP ${response.status}`);
      }
      options.onOpen?.(response);
    },
    onmessage: msg => {
      if (options.onMessage(msg) === false) {
        controller.abort();
      }
    },
    onclose: () => {
      options.onClose?.();
    },
    onerror: err => {
      if (err instanceof FatalSseError) {
        options.onError?.(err);
        throw err; // stop retry chain
      }
      options.onError?.(err);
      if (options.disableRetry ?? true) {
        throw err; // prevent default infinite retry
      }
    },
  }).catch(err => {
    // Surface errors that escaped onerror (e.g. FatalSseError re-thrown).
    if (!(err instanceof FatalSseError)) {
      options.onError?.(err);
    }
  });

  return controller;
}
