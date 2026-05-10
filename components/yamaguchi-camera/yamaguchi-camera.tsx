'use client';

import React, { useRef, useEffect, useReducer } from 'react';
import { Camera, Download, RotateCcw, RotateCw, ChevronLeft, ChevronRight, AlertCircle, Sliders, X, RefreshCw, MapPin, Maximize2, Plus, Minus, ZoomIn } from 'lucide-react';

import { CITIES, init, SCALE_MAX, SCALE_MIN } from './state';
import type {
  CapturedSnapshot,
  MaskMode,
  PersistedSettings,
  ZoomCaps,
} from './state';
import { update } from './update';
import * as P from './presenter';

// View-side constants — UI choices, not domain data.
const COLORS = ['#ffffff', '#fbbf24', '#fb7185', '#60a5fa', '#34d399', '#a78bfa', '#000000'];

const STROKE_OPTIONS = [
  { id: 'thick', label: '太い', value: 1.65 },
  { id: 'thin',  label: '細い', value: 0.8 },
  { id: 'none',  label: 'なし', value: 0 },
] as const;

const SCALE_STEP = 0.1;
const ZOOM_STEP = 0.5;

const SETTINGS_STORAGE_KEY = 'yamaguchi-camera-settings';

function StrokeIcon({ value, className = 'w-5 h-5' }: { value: number; className?: string }) {
  if (value === 0) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="3.5" width="17" height="17" rx="2" strokeDasharray="2 2.5" />
        <line x1="5" y1="19" x2="19" y2="5" strokeWidth={1.6} />
      </svg>
    );
  }
  const sw = value >= 1.5 ? 3 : 1.4;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    </svg>
  );
}

export default function YamaguchiCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const [state, dispatch] = useReducer(update, undefined, init);

  // Destructure for view-side ergonomics — keeps JSX nearly identical.
  const {
    facingMode, zoom, cityIndex, color, opacity, scale, strokeWidth,
    maskMode, silhouetteRotated, userCoords, geoError, showLocation,
    showLocationPin, showSettings, activeMenu, capture,
  } = state;

  // Pure derivations come from presenter — view just picks them up by name.
  const error = P.errorMessage(state);
  const loading = P.isLoading(state);
  const zoomCaps = P.zoomCaps(state);
  const isDigitalZoom = P.isDigitalZoom(state);
  const zoomMin = P.zoomMin(state);
  const zoomMax = P.zoomMax(state);
  const capturedImage = P.capturedImage(state);
  const capturedSnapshot = P.capturedSnapshot(state);
  const previewMaskMode = P.previewMaskMode(state);
  const previewStrokeWidth = P.previewStrokeWidth(state);
  const previewShowLocation = P.previewShowLocation(state);
  const currentCity = P.currentCity(state);
  const silhouetteTransform = P.silhouetteTransform(state);

  // Hydrate persisted settings on mount; always dispatch (even on miss/error)
  // so settingsLoaded flips and the save effect below begins running.
  useEffect(() => {
    let patch: Partial<PersistedSettings> = {};
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) patch = JSON.parse(raw) as Partial<PersistedSettings>;
    } catch {}
    dispatch({ type: 'settingsHydrated', patch });
  }, []);

  // Persist on every relevant change once hydration has occurred.
  useEffect(() => {
    if (!state.settingsLoaded) return;
    try {
      const s: PersistedSettings = {
        cityIndex,
        color,
        opacity,
        scale,
        strokeWidth,
        facingMode,
        maskMode,
        showLocation,
        showLocationPin,
        silhouetteRotated,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
    } catch {}
  }, [state.settingsLoaded, cityIndex, color, opacity, scale, strokeWidth, facingMode, maskMode, showLocation, showLocationPin, silhouetteRotated]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      dispatch({ type: 'geoFailed', message: '位置情報に対応していません' });
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (cancelled) return;
        dispatch({ type: 'coordsReceived', coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      },
      err => {
        if (cancelled) return;
        dispatch({ type: 'geoFailed', message: err.message || '位置情報を取得できません' });
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => { cancelled = true; };
  }, []);

  // OFF でも撮影後のロゴには出すため、撮影スナップショットには常に dotPosRaw を入れる。
  // ライブプレビュー側のドット表示はトグルで制御 (P.dotPos が showLocation を考慮済み)。
  const dotPosRaw = P.dotPosRaw(state);
  const dotPos = P.dotPos(state);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('お使いのブラウザはカメラAPIに対応していません');
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        activeStream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        const track = s.getVideoTracks()[0] || null;
        videoTrackRef.current = track;
        let caps: ZoomCaps | null = null;
        const trackCaps = (track && typeof track.getCapabilities === 'function')
          ? (track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min?: number; max?: number; step?: number } })
          : null;
        if (trackCaps && trackCaps.zoom && typeof trackCaps.zoom.max === 'number' && trackCaps.zoom.max > (trackCaps.zoom.min ?? 1)) {
          caps = {
            min: trackCaps.zoom.min ?? 1,
            max: trackCaps.zoom.max,
            step: trackCaps.zoom.step && trackCaps.zoom.step > 0 ? trackCaps.zoom.step : 0.1,
          };
        }
        dispatch({ type: 'cameraReady', zoomCaps: caps });
      } catch (e: any) {
        let msg = e?.message || 'カメラを起動できませんでした';
        if (e?.name === 'NotAllowedError') msg = 'カメラへのアクセスが拒否されました';
        if (e?.name === 'NotFoundError') msg = 'カメラが見つかりませんでした';
        if (!cancelled) dispatch({ type: 'cameraFailed', message: msg });
      }
    }

    start();
    return () => {
      cancelled = true;
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
      videoTrackRef.current = null;
    };
  }, [facingMode]);

  useEffect(() => {
    const track = videoTrackRef.current;
    if (!track || !zoomCaps) return;
    track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] }).catch(() => {});
  }, [zoom, zoomCaps]);

  const switchCamera = () => dispatch({ type: 'cameraSwitchToggled' });

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Match the preview's object-cover crop so the captured image and
    // SVG silhouette align with what the user sees on screen. Without
    // this, a portrait container + landscape camera (or vice-versa)
    // makes the silhouette appear at a different size in the photo.
    const rect = video.getBoundingClientRect();
    const containerW = rect.width || vw;
    const containerH = rect.height || vh;
    const containerAspect = containerW / containerH;
    const videoAspect = vw / vh;

    let baseCropW: number;
    let baseCropH: number;
    if (videoAspect > containerAspect) {
      baseCropH = vh;
      baseCropW = vh * containerAspect;
    } else {
      baseCropW = vw;
      baseCropH = vw / containerAspect;
    }

    const w = Math.round(baseCropW);
    const h = Math.round(baseCropH);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const useCrop = isDigitalZoom && zoom > 1;
    const sw = useCrop ? baseCropW / zoom : baseCropW;
    const sh = useCrop ? baseCropH / zoom : baseCropH;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    if (facingMode === 'user') {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    }

    const rawDataUrl = canvas.toDataURL('image/png');
    const snapshot: CapturedSnapshot = {
      width: w,
      height: h,
      cityId: currentCity.id,
      cityName: currentCity.name,
      cityReading: currentCity.reading,
      cityPath: currentCity.path,
      silhouetteTransform,
      color,
      opacity,
      strokeWidth,
      dotPos,
      dotPosRaw,
      showLocationPin,
    };

    const composed = await composeFinal(rawDataUrl, maskMode, strokeWidth, snapshot, showLocation);
    dispatch({ type: 'captureCompleted', raw: rawDataUrl, composed, snapshot });
  };

  const composeFinal = (
    rawDataUrl: string,
    mode: 'translucent' | 'solid',
    stroke: number,
    snap: CapturedSnapshot,
    locationVisible: boolean,
  ): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = snap.width;
      canvas.height = snap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }

      const drawWatermark = () => {
        const w = snap.width;
        const h = snap.height;
        const fontSize = Math.max(18, Math.floor(h / 32));
        ctx.font = `bold ${fontSize}px -apple-system, "Hiragino Sans", "Yu Gothic", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = snap.color;
        ctx.globalAlpha = Math.min(snap.opacity + 0.1, 1);
        ctx.fillText(`山口県 ${snap.cityName}`, w - 28, h - 28);
        const subSize = Math.max(10, Math.floor(fontSize * 0.45));
        ctx.font = `${subSize}px -apple-system, sans-serif`;
        ctx.globalAlpha = Math.min(snap.opacity + 0.1, 1) * 0.75;
        ctx.fillText(snap.cityReading, w - 28, h - 28 - fontSize - 4);

        const iconSize = fontSize * 2;
        const iconRight = w - 28;
        const iconBottom = h - 28 - fontSize - 4 - subSize - 6;
        ctx.save();
        ctx.translate(iconRight - iconSize, iconBottom - iconSize);
        ctx.scale(iconSize / 200, iconSize / 200);
        const path = new Path2D(snap.cityPath);
        ctx.fillStyle = snap.color;
        ctx.globalAlpha = Math.min(snap.opacity + 0.1, 1) * 0.9;
        ctx.fill(path);
        if (snap.dotPosRaw && snap.showLocationPin) {
          const pinX = snap.dotPosRaw.x;
          const pinY = snap.dotPosRaw.y;
          ctx.globalAlpha = 1;
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 4;
          ctx.font = '32px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText('📍', pinX, pinY + 4);
          ctx.shadowBlur = 0;
        }
        ctx.restore();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      };

      const rawImg = new Image();
      rawImg.onload = () => {
        ctx.drawImage(rawImg, 0, 0, snap.width, snap.height);

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${snap.width}" height="${snap.height}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <mask id="silhouette-mask">
          <rect x="-500" y="-500" width="1200" height="1200" fill="white" />
          <g transform="${snap.silhouetteTransform}">
            <path d="${snap.cityPath}" fill="black" />
          </g>
        </mask>
      </defs>
      <rect x="-500" y="-500" width="1200" height="1200" fill="black" fill-opacity="${mode === 'solid' ? 1 : 0.6}" mask="url(#silhouette-mask)" />
      <g transform="${snap.silhouetteTransform}">
        <path d="${snap.cityPath}" fill="none" stroke="${snap.color}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round" opacity="${snap.opacity}"/>
        ${locationVisible && snap.dotPosRaw ? `<circle cx="${snap.dotPosRaw.x}" cy="${snap.dotPosRaw.y}" r="3.5" fill="#ef4444" stroke="white" stroke-width="1"/>` : ''}
      </g>
    </svg>`;

        const svgImg = new Image();
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const finalize = () => {
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };

        svgImg.onload = () => {
          ctx.drawImage(svgImg, 0, 0, snap.width, snap.height);
          drawWatermark();
          finalize();
        };
        svgImg.onerror = () => {
          drawWatermark();
          finalize();
        };
        svgImg.src = url;
      };
      rawImg.onerror = () => resolve(rawDataUrl);
      rawImg.src = rawDataUrl;
    });
  };

  const handleTogglePreviewMask = async (mode: MaskMode) => {
    if (capture.kind !== 'captured' || mode === capture.preview.maskMode) return;
    const composed = await composeFinal(
      capture.raw, mode, capture.preview.strokeWidth, capture.snapshot, capture.preview.showLocation,
    );
    dispatch({ type: 'previewMaskSet', mode, composed });
  };

  const handleSetPreviewStroke = async (value: number) => {
    if (capture.kind !== 'captured' || value === capture.preview.strokeWidth) return;
    const composed = await composeFinal(
      capture.raw, capture.preview.maskMode, value, capture.snapshot, capture.preview.showLocation,
    );
    dispatch({ type: 'previewStrokeSet', value, composed });
  };

  const handleTogglePreviewLocation = async () => {
    if (capture.kind !== 'captured') return;
    const next = !capture.preview.showLocation;
    const composed = await composeFinal(
      capture.raw, capture.preview.maskMode, capture.preview.strokeWidth, capture.snapshot, next,
    );
    dispatch({ type: 'previewLocationToggled', composed });
  };

  const handleRetake = () => dispatch({ type: 'captureCleared' });

  const downloadDataUrl = (dataUrl: string, cityId: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `yamaguchi_${cityId}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = () => {
    if (!capturedImage) return;
    const cityId = capturedSnapshot?.cityId ?? currentCity.id;
    downloadDataUrl(capturedImage, cityId);
  };

  return (
    <div className="w-full h-screen bg-black text-white flex flex-col overflow-hidden relative" style={{ height: '100vh' }}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-black z-20 border-b border-white/5">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-400" />
          <div>
            <h1 className="text-sm font-bold tracking-wide">YAMAGUCHI 13</h1>
            <p className="text-[9px] text-gray-400 leading-none">山口県13市シルエットカメラ</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={switchCamera} className="p-2 rounded-full hover:bg-white/10 active:bg-white/20" title="カメラ切替">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => dispatch({ type: 'settingsToggled' })} className={`p-2 rounded-full ${showSettings ? 'bg-white/20' : 'hover:bg-white/10 active:bg-white/20'}`} title="設定">
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main camera view */}
      <div className="relative flex-1 overflow-hidden bg-gray-950">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
            <h2 className="font-bold mb-2">カメラを起動できません</h2>
            <p className="text-sm text-gray-300 mb-4">{error}</p>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              ブラウザでカメラの使用を許可して��ださい。<br/>
              ��レビュー環境（埋め込み表示）ではカメラが使えない場合があります。新しいタブで開くと動作します。
            </p>
          </div>
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-xs text-gray-400">カメラを起動中...</div>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                transform: [
                  isDigitalZoom && zoom !== 1 ? `scale(${zoom})` : '',
                  facingMode === 'user' ? 'scaleX(-1)' : '',
                ].filter(Boolean).join(' ') || 'none',
                transformOrigin: 'center center',
                transition: 'transform 80ms linear',
              }}
            />
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 200 200" 
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <mask id="silhouette-mask">
                  <rect x="-500" y="-500" width="1200" height="1200" fill="white" />
                  <g transform={silhouetteTransform}>
                    <path d={currentCity.path} fill="black" />
                  </g>
                </mask>
              </defs>
              <rect
                x="-500" y="-500" width="1200" height="1200"
                fill="black"
                fillOpacity={maskMode === 'solid' ? 1 : 0.6}
                mask="url(#silhouette-mask)"
              />
              <g transform={silhouetteTransform}>
                <path
                  d={currentCity.path}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={opacity}
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                />
                {dotPos && (
                  <circle
                    cx={dotPos.x}
                    cy={dotPos.y}
                    r={3.5}
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth={1}
                    style={{ filter: 'drop-shadow(0 0 3px rgba(239,68,68,0.8))' }}
                  />
                )}
              </g>
            </svg>
            
            {/* City info overlay */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
              <div className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-md">
                <div className="text-base font-bold leading-tight">{currentCity.name}</div>
                <div className="text-[9px] text-gray-300 tracking-[0.15em] leading-tight">{currentCity.reading}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-[10px] tabular-nums">
                  {String(cityIndex + 1).padStart(2, '0')} / {CITIES.length}
                </div>
                {zoom > zoomMin + 0.001 && (
                  <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-[10px] tabular-nums font-semibold">
                    {zoom.toFixed(1)}x
                  </div>
                )}
                {geoError ? null : (
                  <button
                    onClick={() => dispatch({ type: 'locationToggled' })}
                    className={`pointer-events-auto backdrop-blur-sm px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors ${
                      dotPos
                        ? 'bg-red-500/80 text-white'
                        : showLocation
                          ? 'bg-black/50 text-gray-300'
                          : 'bg-black/50 text-gray-500'
                    }`}
                    aria-pressed={showLocation}
                  >
                    {showLocation && dotPos && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                    {!showLocation
                      ? '現在地: OFF'
                      : dotPos
                        ? '現在地'
                        : userCoords
                          ? '市外'
                          : '位置取得中…'}
                  </button>
                )}
              </div>
            </div>

            {/* Settings panel overlay */}
            {showSettings && (
              <div className="absolute inset-x-0 bottom-0 bg-black/90 backdrop-blur-md p-4 space-y-3 z-30 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold tracking-wider text-gray-300">フレーム設定</h3>
                  <button onClick={() => dispatch({ type: 'settingsClosed' })} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1.5 tracking-wide">COLOR</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button 
                        key={c}
                        onClick={() => dispatch({ type: 'colorSet', color: c })}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110 shadow-lg' : 'border-gray-700'}`}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 flex justify-between mb-1 tracking-wide">
                    <span>OPACITY</span><span className="tabular-nums">{Math.round(opacity * 100)}%</span>
                  </label>
                  <input type="range" min="0.1" max="1" step="0.05" value={opacity} 
                    onChange={e => dispatch({ type: 'opacitySet', opacity: parseFloat(e.target.value) })}
                    className="w-full accent-white"/>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 block mb-1.5 tracking-wide">MASK</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => dispatch({ type: 'maskModeSet', mode: 'translucent' })}
                      className={`py-1.5 rounded text-[11px] transition-colors ${
                        maskMode === 'translucent'
                          ? 'bg-white text-black font-semibold'
                          : 'bg-white/10 text-gray-200 hover:bg-white/20'
                      }`}
                    >
                      半透明
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'maskModeSet', mode: 'solid' })}
                      className={`py-1.5 rounded text-[11px] transition-colors ${
                        maskMode === 'solid'
                          ? 'bg-white text-black font-semibold'
                          : 'bg-white/10 text-gray-200 hover:bg-white/20'
                      }`}
                    >
                      塗りつぶし黒
                    </button>
                  </div>
                </div>

                <label className="flex items-center justify-between text-xs cursor-pointer pt-1">
                  <span className="text-gray-300">ロゴに現在地ピンを表示</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showLocationPin}
                      onChange={e => dispatch({ type: 'locationPinSet', visible: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 rounded-full peer-checked:bg-white transition-colors"></div>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${showLocationPin ? 'translate-x-4 bg-black' : 'bg-gray-300'}`}></div>
                  </div>
                </label>
              </div>
            )}
          </>
        )}
      </div>

      {/* City selector */}
      <div className="bg-black px-1 py-2 flex items-center gap-1 border-t border-white/5">
        <button 
          onClick={() => dispatch({ type: 'cityStepped', delta: -1 })}
          className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 overflow-x-auto flex gap-1.5 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>
          {CITIES.map((city, i) => (
            <button
              key={city.id}
              onClick={() => dispatch({ type: 'citySelected', index: i })}
              className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap flex-shrink-0 transition-all ${
                i === cityIndex 
                  ? 'bg-white text-black font-semibold' 
                  : 'bg-white/10 text-gray-200 hover:bg-white/20'
              }`}
            >
              {city.name}
            </button>
          ))}
        </div>
        <button 
          onClick={() => dispatch({ type: 'cityStepped', delta: 1 })}
          className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Capture button */}
      <div className="bg-black px-4 pt-3 pb-5 relative flex justify-center items-center">
        <button
          onClick={handleCapture}
          disabled={!!error || loading}
          className="w-16 h-16 rounded-full bg-transparent border-[3px] border-white hover:scale-105 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center group"
          aria-label="撮影"
        >
          <div className="w-12 h-12 rounded-full bg-white group-active:bg-gray-300 transition-colors"></div>
        </button>

        {activeMenu && (
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => dispatch({ type: 'menuClosed' })}
            className="fixed inset-0 z-10 cursor-default"
          />
        )}

        {/* Left controls (zoom + rotate) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20">
          <div className="relative">
            {activeMenu === 'zoom' && (
              <div className="absolute bottom-full left-0 mb-3 flex flex-col items-center gap-1 p-1.5 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'zoomNudged', delta: ZOOM_STEP })}
                  disabled={zoom >= zoomMax - 0.001}
                  className="w-12 h-9 rounded-xl flex items-center justify-center text-gray-100 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="倍率を上げる"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.4} />
                </button>
                <div className="my-0.5 px-2 py-1 rounded-lg bg-white text-black text-[11px] font-bold tabular-nums leading-none">
                  {zoom.toFixed(1)}x
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'zoomNudged', delta: -ZOOM_STEP })}
                  disabled={zoom <= zoomMin + 0.001}
                  className="w-12 h-9 rounded-xl flex items-center justify-center text-gray-100 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="倍率を下げる"
                >
                  <Minus className="w-4 h-4" strokeWidth={2.4} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: 'menuToggled', menu: 'zoom' })}
              className={`relative w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${
                activeMenu === 'zoom'
                  ? 'bg-white text-black border-white scale-105 shadow-[0_0_0_4px_rgba(255,255,255,0.1)]'
                  : 'bg-white/[0.08] text-white border-white/20 hover:bg-white/15 active:bg-white/25'
              }`}
              aria-label="カメラ倍率"
              aria-expanded={activeMenu === 'zoom'}
            >
              <ZoomIn className="w-[18px] h-[18px]" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'silhouetteRotateToggled' })}
            className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${
              silhouetteRotated
                ? 'bg-white text-black border-white shadow-[0_0_0_4px_rgba(255,255,255,0.1)]'
                : 'bg-white/[0.08] text-white border-white/20 hover:bg-white/15 active:bg-white/25'
            }`}
            aria-label="シルエットを回転"
            aria-pressed={silhouetteRotated}
          >
            <RotateCw className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Frame controls (right side) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20">
          {/* SIZE control */}
          <div className="relative">
            {activeMenu === 'size' && (
              <div className="absolute bottom-full right-0 mb-3 flex flex-col items-center gap-1 p-1.5 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'scaleNudged', delta: SCALE_STEP })}
                  disabled={scale >= SCALE_MAX - 0.001}
                  className="w-12 h-9 rounded-xl flex items-center justify-center text-gray-100 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="サイズを大きく"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.4} />
                </button>
                <div className="my-0.5 px-2 py-1 rounded-lg bg-white text-black text-[11px] font-bold tabular-nums leading-none">
                  {scale.toFixed(2)}x
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'scaleNudged', delta: -SCALE_STEP })}
                  disabled={scale <= SCALE_MIN + 0.001}
                  className="w-12 h-9 rounded-xl flex items-center justify-center text-gray-100 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="サイズを小さく"
                >
                  <Minus className="w-4 h-4" strokeWidth={2.4} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: 'menuToggled', menu: 'size' })}
              className={`relative w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${
                activeMenu === 'size'
                  ? 'bg-white text-black border-white scale-105 shadow-[0_0_0_4px_rgba(255,255,255,0.1)]'
                  : 'bg-white/[0.08] text-white border-white/20 hover:bg-white/15 active:bg-white/25'
              }`}
              aria-label="シルエットサイズ"
              aria-expanded={activeMenu === 'size'}
            >
              <Maximize2 className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Stroke control */}
          <div className="relative">
            {activeMenu === 'stroke' && (
              <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-1.5 p-1.5 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                {STROKE_OPTIONS.map(opt => {
                  const active = strokeWidth === opt.value;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => dispatch({ type: 'strokeWidthSet', value: opt.value })}
                      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                        active
                          ? 'bg-white text-black shadow-lg'
                          : 'text-gray-200 hover:bg-white/10 active:bg-white/20'
                      }`}
                      aria-label={`枠線 ${opt.label}`}
                      aria-pressed={active}
                    >
                      <StrokeIcon value={opt.value} className="w-5 h-5" />
                      <span className="text-[9px] font-semibold tracking-wide">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: 'menuToggled', menu: 'stroke' })}
              className={`relative w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${
                activeMenu === 'stroke'
                  ? 'bg-white text-black border-white scale-105 shadow-[0_0_0_4px_rgba(255,255,255,0.1)]'
                  : 'bg-white/[0.08] text-white border-white/20 hover:bg-white/15 active:bg-white/25'
              }`}
              aria-label="枠線サイズ"
              aria-expanded={activeMenu === 'stroke'}
            >
              <StrokeIcon value={strokeWidth} className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Captured image overlay */}
      {capturedImage && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col">
          <div className="flex-1 overflow-auto flex items-center justify-center p-3">
            <img src={capturedImage} alt="撮影された写真" className="max-w-full max-h-full object-contain rounded shadow-2xl" />
          </div>
          <div className="bg-black p-4 pb-5 flex flex-col gap-3 items-center">
            <div className="w-full max-w-xs">
              <label className="text-[10px] text-gray-400 block mb-1.5 tracking-wide text-center">枠外</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleTogglePreviewMask('translucent')}
                  className={`py-2 rounded text-[12px] transition-colors ${
                    previewMaskMode === 'translucent'
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/10 text-gray-200 hover:bg-white/20'
                  }`}
                >
                  半透明
                </button>
                <button
                  onClick={() => handleTogglePreviewMask('solid')}
                  className={`py-2 rounded text-[12px] transition-colors ${
                    previewMaskMode === 'solid'
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/10 text-gray-200 hover:bg-white/20'
                  }`}
                >
                  塗りつぶし黒
                </button>
              </div>
            </div>
            <div className="w-full max-w-xs">
              <label className="text-[10px] text-gray-400 block mb-1.5 tracking-wide text-center">枠線</label>
              <div className="grid grid-cols-3 gap-1.5">
                {STROKE_OPTIONS.map(opt => {
                  const active = previewStrokeWidth === opt.value;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSetPreviewStroke(opt.value)}
                      className={`py-2 rounded flex flex-col items-center justify-center gap-0.5 transition-colors ${
                        active
                          ? 'bg-white text-black font-semibold'
                          : 'bg-white/10 text-gray-200 hover:bg-white/20'
                      }`}
                      aria-label={`枠線 ${opt.label}`}
                      aria-pressed={active}
                    >
                      <StrokeIcon value={opt.value} className="w-4 h-4" />
                      <span className="text-[10px] tracking-wide">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {capturedSnapshot?.dotPosRaw && (
              <div className="w-full max-w-xs">
                <label className="text-[10px] text-gray-400 block mb-1.5 tracking-wide text-center">現在地マーク</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => previewShowLocation || handleTogglePreviewLocation()}
                    className={`py-2 rounded text-[12px] flex items-center justify-center gap-1.5 transition-colors ${
                      previewShowLocation
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white/10 text-gray-200 hover:bg-white/20'
                    }`}
                    aria-pressed={previewShowLocation}
                  >
                    <span className={`w-2 h-2 rounded-full ${previewShowLocation ? 'bg-red-500' : 'bg-red-500/40'}`} />
                    表示
                  </button>
                  <button
                    onClick={() => previewShowLocation && handleTogglePreviewLocation()}
                    className={`py-2 rounded text-[12px] transition-colors ${
                      !previewShowLocation
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white/10 text-gray-200 hover:bg-white/20'
                    }`}
                    aria-pressed={!previewShowLocation}
                  >
                    非表示
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetake}
                className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center gap-2 text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                撮り直す
              </button>
              <button
                onClick={handleDownload}
                className="px-6 py-3 rounded-full bg-white text-black hover:bg-gray-200 active:bg-gray-300 flex items-center gap-2 font-semibold text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
