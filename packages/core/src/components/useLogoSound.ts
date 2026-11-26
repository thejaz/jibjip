import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type MouseEvent } from "react";
import { LogoSound } from "../lib/logo-sound";

export function useLogoSound(onActivate: () => void) {
  const sound = useRef<LogoSound | null>(null);
  const pointer = useRef<number | null>(null);
  const key = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const activate = useRef(onActivate);
  const cancelGesture = useRef<(() => void) | null>(null);
  useEffect(() => { activate.current = onActivate; }, [onActivate]);

  useEffect(() => {
    const player = new LogoSound();
    sound.current = player;
    let touch: { id: number; target: HTMLElement } | null = null;
    // Touch browsers may grant audio permission only on release. The first ordinary
    // tap (including opening mobile navigation) silently unlocks this one context.
    const warm = (event: Event) => {
      if (event.isTrusted) void player.unlock().then(ready => { if (ready) removeWarm(); });
    };
    const removeWarm = () => {
      window.removeEventListener("pointerup", warm, true);
      window.removeEventListener("touchend", warm, true);
      window.removeEventListener("keydown", warm, true);
    };
    const cancel = () => {
      if (player.end()) suppressClick.current = true;
      pointer.current = null;
      key.current = null;
      touch = null;
    };
    cancelGesture.current = cancel;
    // Native, nonpassive touch handling prevents Android's long-press/drag
    // gesture from canceling the hold. Pointer events still own mouse/pen.
    const startTouch = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-logo-sound]") : null;
      if (!target || event.touches.length !== 1 || touch || pointer.current !== null || key.current !== null) return;
      event.preventDefault();
      touch = { id: event.changedTouches[0].identifier, target };
      suppressClick.current = false;
      player.begin();
    };
    const moveTouch = (event: TouchEvent) => {
      if (!touch) return;
      const point = Array.from(event.changedTouches).find(item => item.identifier === touch!.id);
      if (!point) return;
      event.preventDefault();
      const r = touch.target.getBoundingClientRect();
      if (point.clientX < r.left || point.clientX > r.right || point.clientY < r.top || point.clientY > r.bottom) cancel();
    };
    const endTouch = (event: TouchEvent) => {
      if (!touch || !Array.from(event.changedTouches).some(item => item.identifier === touch!.id)) return;
      const held = player.end();
      touch = null;
      suppressClick.current = true;
      if (event.cancelable) event.preventDefault();
      if (event.type === "touchend" && !held) activate.current();
    };
    const hide = () => { if (document.hidden) cancel(); };
    // Capture still needs a release fallback if the logo disappears while held.
    const releasePointer = (event: globalThis.PointerEvent) => {
      if (pointer.current === event.pointerId) cancel();
    };
    const releaseKey = (event: globalThis.KeyboardEvent) => {
      if (key.current === event.key) cancel();
    };
    window.addEventListener("pointerup", warm, true);
    window.addEventListener("touchend", warm, true);
    window.addEventListener("touchstart", startTouch, { capture: true, passive: false });
    window.addEventListener("touchmove", moveTouch, { capture: true, passive: false });
    window.addEventListener("touchend", endTouch, { capture: true, passive: false });
    window.addEventListener("touchcancel", endTouch, true);
    window.addEventListener("keydown", warm, true);
    window.addEventListener("pointerup", releasePointer, true);
    window.addEventListener("pointercancel", releasePointer, true);
    window.addEventListener("keyup", releaseKey);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", hide);
    return () => {
      removeWarm();
      window.removeEventListener("touchstart", startTouch, true);
      window.removeEventListener("touchmove", moveTouch, true);
      window.removeEventListener("touchend", endTouch, true);
      window.removeEventListener("touchcancel", endTouch, true);
      window.removeEventListener("pointerup", releasePointer, true);
      window.removeEventListener("pointercancel", releasePointer, true);
      window.removeEventListener("keyup", releaseKey);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", hide);
      player.dispose();
      sound.current = null;
      cancelGesture.current = null;
    };
  }, []);

  const endPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    suppressClick.current = sound.current?.end() ?? false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return {
    "data-logo-sound": "",
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (event.pointerType === "touch") return;
      if (!event.isPrimary || event.button !== 0 || pointer.current !== null || key.current !== null) return;
      suppressClick.current = false;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      sound.current?.begin();
    },
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    onLostPointerCapture: endPointer,
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) endPointer(event);
    },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if ((event.key !== " " && event.key !== "Enter") || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      if (event.repeat || pointer.current !== null || key.current !== null) return;
      suppressClick.current = false;
      key.current = event.key;
      sound.current?.begin();
    },
    onKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
      if (key.current !== event.key) return;
      event.preventDefault();
      key.current = null;
      if (!sound.current?.end()) onActivate();
    },
    onBlur() {
      cancelGesture.current?.();
    },
    onContextMenu(event: MouseEvent<HTMLButtonElement>) { event.preventDefault(); },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
      } else onActivate();
    },
  };
}
