/**
 * Touch tap-gesture helpers for canvas SVG interactivity.
 *
 * Mouse pointers are ignored entirely, so desktop click / double-click
 * semantics stay exactly as they are. Touch and pen get:
 * - double-tap (second tap within the window edits, e.g. rename),
 * - long-press (stationary hold suppresses the release click so it never
 *   selects — HUD opens on single tap only; hold-then-drag flows into
 *   drag-to-connect / pan via the movement threshold),
 * while single taps keep flowing through the existing onclick handlers.
 */

export const DOUBLE_TAP_WINDOW_MS = 350;
export const LONG_PRESS_DELAY_MS = 500;
export const PRESS_MOVE_TOLERANCE_PX = 10;
/** Release-clicks arriving this soon after a long-press belong to the press — swallow them. */
export const LONG_PRESS_CLICK_SUPPRESS_MS = 700;

export interface TapGestureHandlers {
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  longPressDelay?: number;
  doubleTapWindow?: number;
  moveTolerance?: number;
}

export interface TapGestureHandle {
  shouldSuppressClick: () => boolean;
  detach: () => void;
}

export function isTouchPointer(e: { pointerType?: string }): boolean {
  return e.pointerType !== undefined && e.pointerType !== 'mouse';
}

export function attachTapGestures(
  el: Element,
  handlers: TapGestureHandlers
): TapGestureHandle {
  let lastTapAt = 0;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFiredAt = 0;
  let activePointerId: number | null = null;
  let startX = 0;
  let startY = 0;

  const removeWindowListeners = (): void => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', onWindowUp, true);
      window.removeEventListener('pointercancel', onWindowUp, true);
    }
  };

  const clearTimer = (): void => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onWindowUp = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (e.pointerId === activePointerId) {
      clearTimer();
      removeWindowListeners();
    }
  };

  const onPointerDown = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (!isTouchPointer(e) || e.isPrimary === false) return;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    clearTimer();
    removeWindowListeners();
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerup', onWindowUp, true);
      window.addEventListener('pointercancel', onWindowUp, true);
    }
    if (handlers.onLongPress) {
      const delay = handlers.longPressDelay ?? LONG_PRESS_DELAY_MS;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        longPressFiredAt = Date.now();
        handlers.onLongPress?.();
      }, delay);
    }
  };

  const onPointerMove = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (e.pointerId !== activePointerId) return;
    const tol = handlers.moveTolerance ?? PRESS_MOVE_TOLERANCE_PX;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > tol) {
      // It's a drag (connect / pan), not a press.
      clearTimer();
      removeWindowListeners();
    }
  };

  const onPointerUp = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    clearTimer();
    removeWindowListeners();
    if (!isTouchPointer(e)) return;
    // A release right after a long-press is not a tap.
    if (Date.now() - longPressFiredAt < LONG_PRESS_CLICK_SUPPRESS_MS) return;
    if (!handlers.onDoubleTap) return;
    const now = Date.now();
    if (now - lastTapAt < (handlers.doubleTapWindow ?? DOUBLE_TAP_WINDOW_MS)) {
      lastTapAt = 0;
      handlers.onDoubleTap();
    } else {
      lastTapAt = now;
    }
  };

  const onCancel = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (e.pointerId !== undefined && e.pointerId !== activePointerId) return;
    activePointerId = null;
    clearTimer();
    removeWindowListeners();
  };

  const shouldSuppressClick = (): boolean =>
    Date.now() - longPressFiredAt < LONG_PRESS_CLICK_SUPPRESS_MS;

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onCancel);

  return {
    shouldSuppressClick,
    detach: () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onCancel);
      clearTimer();
      removeWindowListeners();
    },
  };
}

/**
 * Wrap an element's onclick so the release-click fired after a long-press
 * multi-select is swallowed instead of resetting the selection.
 */
export function guardClickAfterLongPress(
  el: Element,
  handle: TapGestureHandle
): void {
  const target = el as unknown as {
    onclick: ((ev: MouseEvent) => void) | null;
  };
  const prev = target.onclick;
  if (!prev) return;
  target.onclick = (ev: MouseEvent) => {
    if (handle.shouldSuppressClick()) {
      ev.stopPropagation();
      ev.preventDefault();
      return;
    }
    prev(ev);
  };
}
