type Callback = (uri: string | null) => void;

let pending: Callback | null = null;

/**
 * Register a callback that will be invoked once the next camera capture
 * resolves (or is cancelled).
 */
export function setPendingCameraCallback(cb: Callback): void {
  pending = cb;
}

/**
 * Invoke the pending callback with the captured URI (or null if cancelled),
 * then clear it.
 */
export function resolveCameraCapture(uri: string | null): void {
  const cb = pending;
  pending = null;
  cb?.(uri);
}
