import { useEffect, useRef, useState } from 'react';

import {
  SCENE_SCALE_MAX,
  SCENE_SCALE_PROPERTY,
  sceneScaleForRoomWidth,
} from '../content/sceneScale';

/**
 * Keep the scene's `--asset-scale` in step with the room's rendered width.
 *
 * Returns a ref to attach to the element that should be *measured* (a room) and a
 * ref for the element the scale is *published on* (the scene root, so it cascades
 * to every room, sprite, decoration and fixture inside it, and to nothing in the
 * HUD).
 *
 * Why a ResizeObserver and not a window resize listener: the room's width changes
 * for reasons that never fire `resize` — entering decorate mode opens the tray,
 * the scrollbar comes and goes, the UI scale changes the layout width. Observing
 * the element itself catches all of them, including the reported case of the
 * window being dragged to a new size.
 *
 * The measured value is also returned so JS-side geometry that is expressed in
 * scene pixels can scale with it (see `OfficeScene`'s character slots) instead of
 * only the CSS-side sizes moving.
 */
export function useSceneScale<M extends HTMLElement, R extends HTMLElement>() {
  const measureRef = useRef<M | null>(null);
  const scopeRef = useRef<R | null>(null);
  const [scale, setScale] = useState(SCENE_SCALE_MAX);

  useEffect(() => {
    const measured = measureRef.current;
    if (!measured) return undefined;

    const publish = (next: number) => {
      setScale((prev) => (prev === next ? prev : next));
      const scope = scopeRef.current;
      if (scope) scope.style.setProperty(SCENE_SCALE_PROPERTY, String(next));
    };

    const read = () => publish(sceneScaleForRoomWidth(measured.getBoundingClientRect().width));

    read();

    // ResizeObserver is the mechanism; the guard keeps this safe in jsdom, where
    // component tests mount the scene without one.
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => read());
    observer.observe(measured);
    return () => observer.disconnect();
  }, []);

  return { measureRef, scopeRef, sceneScale: scale };
}
