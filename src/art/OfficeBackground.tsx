import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/hooks';

// Persistent animated Office background — the official GIF asset (BOunkOV),
// shipped as an optimized MP4 loop with a static JPEG poster and the original
// GIF as a last-resort fallback. This component is mounted ONCE at the App level
// and its <video> element is never remounted on tab/UI changes, so the loop
// never restarts when panels open or the game re-renders. It fills the office
// area, sits behind the UI, and ignores pointer events.
//
// Asset paths use import.meta.env.BASE_URL so they resolve in the dev server,
// the production web build (base './'), and the packaged Electron app (file://).

const BASE = import.meta.env.BASE_URL ?? '/';
const MP4 = `${BASE}backgrounds/office/office-main-loop.mp4`;
const GIF = `${BASE}backgrounds/office/office-main-source.gif`;
const POSTER = `${BASE}backgrounds/office/office-main-poster.jpg`;

const FOCAL: Record<string, string> = {
  center: '50% 50%',
  top: '50% 20%',
  bottom: '50% 80%',
  left: '30% 50%',
  right: '70% 50%',
};

export function OfficeBackground({ visible }: { visible: boolean }) {
  const { state } = useGame();
  const bg = state.settings.background;
  const reducedMotion = state.settings.reducedMotion;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  // Static when the user disabled animation, chose the static quality preset,
  // enabled reduced motion, or the optimized video failed to decode.
  const wantsStatic = !bg.enabled || bg.quality === 'static' || reducedMotion;
  const showVideo = !wantsStatic && !videoFailed;
  const showGif = !wantsStatic && videoFailed && !gifFailed;

  // Track document visibility so we can pause playback while hidden/minimized.
  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Play/pause the persistent <video> based on visibility + settings, WITHOUT
  // remounting it (which would restart the loop or flash a black frame).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !showVideo) return;
    const active = visible && (pageVisible || !bg.pauseWhenHidden);
    if (active) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => setVideoFailed(true));
    } else {
      v.pause();
    }
  }, [visible, pageVisible, showVideo, bg.pauseWhenHidden]);

  const filter =
    bg.brightness === 1 && bg.contrast === 1 && bg.saturation === 1
      ? undefined
      : `brightness(${bg.brightness}) contrast(${bg.contrast}) saturate(${bg.saturation})`;
  const objectPosition = FOCAL[bg.focal] ?? FOCAL.center;
  const mediaStyle: React.CSSProperties = { objectPosition, filter };

  return (
    <div
      className={`office-bg ${visible ? 'is-visible' : ''}`}
      aria-hidden
      data-testid="office-background"
    >
      {showVideo ? (
        <video
          ref={videoRef}
          className="office-bg__media"
          style={mediaStyle}
          poster={POSTER}
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ 'x-webkit-airplay': 'deny' } as any)}
          onError={() => setVideoFailed(true)}
        >
          <source src={MP4} type="video/mp4" />
        </video>
      ) : showGif ? (
        <img
          className="office-bg__media"
          style={mediaStyle}
          src={GIF}
          alt=""
          onError={() => setGifFailed(true)}
        />
      ) : (
        <img className="office-bg__media" style={mediaStyle} src={POSTER} alt="" />
      )}
      {/* soft scrim keeps overlaid UI readable over bright/busy frames */}
      <div className="office-bg__scrim" />
    </div>
  );
}
