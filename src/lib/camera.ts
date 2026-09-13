import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

interface ZoomRange { min: number; max: number; step: number }

type TrackCaps = MediaTrackCapabilities & { torch?: boolean; zoom?: ZoomRange };

export interface Camera {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  torchSupported: boolean;
  torchOn: boolean;
  toggleTorch: () => void;
  zoom: number | null;
  zoomRange: ZoomRange | null;
  setZoom: (z: number) => void;
  /** Снимок текущего кадра, длинная сторона не больше maxSide */
  capture: (maxSide?: number) => Promise<Blob | null>;
  /** Центральная полоса кадра — там, где рамка прицела; для поиска штрихкода */
  grabBand: (canvas: HTMLCanvasElement) => boolean;
  restart: () => void;
}

/** Живая камера телефона (задняя). Выключается, когда экран скрыт или приложение свёрнуто */
export function useCamera(active: boolean): Camera {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('starting');
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState<TrackCaps | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoomState] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(document.visibilityState === 'visible');

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!active || !visible) return;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        setError('Камера доступна только в Safari по защищённому адресу (https).');
        return;
      }
      setStatus('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          await video.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        const c = (track.getCapabilities?.() ?? {}) as TrackCaps;
        setCaps(c);
        setTorchOn(false);
        setZoomState(c.zoom ? ((track.getSettings() as { zoom?: number }).zoom ?? c.zoom.min) : null);
        setStatus('live');
        setError(null);
      } catch (e) {
        if (cancelled) return;
        const name = (e as DOMException).name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('denied');
          setError('Нет доступа к камере. Разрешите камеру: Настройки iPhone → Safari → Камера, затем откройте приложение снова.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setStatus('unavailable');
          setError('Камера не найдена на этом устройстве.');
        } else {
          setStatus('error');
          setError('Не получилось включить камеру. Закройте другие приложения с камерой и попробуйте снова.');
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active, visible, attempt]);

  const track = () => streamRef.current?.getVideoTracks()[0];

  const toggleTorch = useCallback(() => {
    const t = track();
    if (!t) return;
    const next = !torchOn;
    t.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => {});
  }, [torchOn]);

  const setZoom = useCallback((z: number) => {
    const t = track();
    if (!t) return;
    t.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] })
      .then(() => setZoomState(z))
      .catch(() => {});
  }, []);

  const capture = useCallback(async (maxSide = 1600) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  }, []);

  const grabBand = useCallback((canvas: HTMLCanvasElement) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return false;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Полоса по центру: 90% ширины и 40% высоты кадра (в портретной ориентации)
    const sw = vw * 0.9;
    const sh = Math.min(vh * 0.4, sw * 0.8);
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    const scale = Math.min(1, 1280 / sw);
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return true;
  }, []);

  return {
    videoRef,
    status,
    error,
    torchSupported: !!caps?.torch,
    torchOn,
    toggleTorch,
    zoom,
    zoomRange: caps?.zoom ?? null,
    setZoom,
    capture,
    grabBand,
    restart: () => setAttempt((a) => a + 1),
  };
}
