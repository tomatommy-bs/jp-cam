'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Download, RotateCcw, ChevronLeft, ChevronRight, AlertCircle, Sliders, X, RefreshCw, MapPin } from 'lucide-react';

const CITIES = [
  {
    id: 'shimonoseki',
    name: '下関市',
    reading: 'SHIMONOSEKI',
    path: 'M 60,40 L 90,35 L 120,40 L 145,50 L 155,70 L 150,90 L 140,105 L 130,115 L 128,135 L 132,155 L 120,168 L 100,170 L 82,160 L 76,140 L 72,120 L 55,110 L 45,92 L 40,72 L 48,55 Z'
  },
  {
    id: 'ube',
    name: '宇部市',
    reading: 'UBE',
    path: 'M 25,90 L 50,80 L 75,72 L 95,62 L 115,70 L 135,78 L 160,82 L 175,100 L 168,118 L 140,124 L 115,118 L 90,122 L 65,120 L 40,115 L 25,105 Z'
  },
  {
    id: 'yamaguchi',
    name: '山口市',
    reading: 'YAMAGUCHI',
    path: 'M 70,28 L 95,22 L 120,32 L 138,52 L 132,78 L 148,98 L 158,125 L 148,152 L 122,168 L 92,166 L 70,150 L 64,124 L 76,100 L 58,80 L 58,52 Z'
  },
  {
    id: 'hagi',
    name: '萩市',
    reading: 'HAGI',
    path: 'M 22,75 L 42,62 L 62,68 L 78,52 L 95,62 L 115,52 L 135,58 L 155,68 L 172,80 L 178,100 L 168,118 L 145,122 L 125,115 L 105,125 L 85,120 L 65,132 L 45,125 L 28,115 L 18,95 Z'
  },
  {
    id: 'hofu',
    name: '防府市',
    reading: 'HOFU',
    path: 'M 65,55 L 95,48 L 125,55 L 148,75 L 152,100 L 142,128 L 118,142 L 88,142 L 62,128 L 50,102 L 55,75 Z'
  },
  {
    id: 'kudamatsu',
    name: '下松市',
    reading: 'KUDAMATSU',
    path: 'M 72,52 L 98,48 L 122,55 L 138,75 L 142,98 L 132,122 L 108,138 L 82,132 L 66,115 L 60,90 L 66,68 Z'
  },
  {
    id: 'iwakuni',
    name: '岩国市',
    reading: 'IWAKUNI',
    path: 'M 35,28 L 60,22 L 85,30 L 110,22 L 138,32 L 162,45 L 178,65 L 172,92 L 158,118 L 142,142 L 118,162 L 92,168 L 65,158 L 45,142 L 28,118 L 18,92 L 22,58 Z'
  },
  {
    id: 'hikari',
    name: '光市',
    reading: 'HIKARI',
    path: 'M 22,85 L 48,72 L 75,78 L 100,72 L 128,80 L 152,78 L 172,95 L 162,118 L 135,128 L 105,132 L 75,128 L 45,120 L 22,108 Z'
  },
  {
    id: 'nagato',
    name: '長門市',
    reading: 'NAGATO',
    path: 'M 22,82 L 38,62 L 58,52 L 75,68 L 92,52 L 108,62 L 125,48 L 145,58 L 165,68 L 175,90 L 162,112 L 140,118 L 118,108 L 98,118 L 78,110 L 58,122 L 38,112 L 22,100 Z'
  },
  {
    id: 'yanai',
    name: '柳井市',
    reading: 'YANAI',
    path: 'M 68,72 L 92,65 L 118,72 L 140,88 L 148,112 L 132,132 L 108,138 L 82,132 L 65,118 L 58,98 Z'
  },
  {
    id: 'mine',
    name: '美祢市',
    reading: 'MINE',
    path: 'M 65,28 L 92,22 L 118,32 L 135,55 L 145,82 L 148,108 L 138,132 L 122,152 L 98,162 L 72,155 L 58,135 L 52,108 L 48,82 L 55,52 Z'
  },
  {
    id: 'shunan',
    name: '周南市',
    reading: 'SHUNAN',
    path: 'M 58,22 L 82,18 L 105,28 L 128,22 L 145,38 L 150,65 L 138,92 L 150,118 L 145,145 L 128,165 L 100,172 L 72,162 L 58,142 L 52,118 L 65,92 L 52,65 L 52,38 Z'
  },
  {
    id: 'sanyo-onoda',
    name: '山陽小野田市',
    reading: 'SANYO-ONODA',
    path: 'M 48,72 L 75,65 L 102,72 L 128,68 L 148,82 L 152,105 L 142,128 L 118,135 L 92,132 L 65,128 L 48,115 L 42,92 Z'
  }
];

const COLORS = ['#ffffff', '#fbbf24', '#fb7185', '#60a5fa', '#34d399', '#a78bfa', '#000000'];

export default function YamaguchiCamera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cityIndex, setCityIndex] = useState(0);
  const [color, setColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(0.9);
  const [scale, setScale] = useState(1);
  const [strokeWidth, setStrokeWidth] = useState(2.2);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [showSettings, setShowSettings] = useState(false);
  const [showFill, setShowFill] = useState(false);

  const currentCity = CITIES[cityIndex];

  useEffect(() => {
    let activeStream = null;
    let cancelled = false;
    
    async function start() {
      setLoading(true);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('お使いのブラウザはカメラAPIに対応していません');
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        activeStream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setError(null);
      } catch (e) {
        let msg = e.message || 'カメラを起動できませんでした';
        if (e.name === 'NotAllowedError') msg = 'カメラへのアクセスが拒否されました';
        if (e.name === 'NotFoundError') msg = 'カメラが見つかりませんでした';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    start();
    return () => {
      cancelled = true;
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
    };
  }, [facingMode]);

  const switchCamera = () => {
    setFacingMode(f => f === 'environment' ? 'user' : 'environment');
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    if (facingMode === 'user') {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

    const fillAttr = showFill 
      ? `fill="${color}" fill-opacity="${opacity * 0.18}"` 
      : 'fill="none"';
    
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <mask id="silhouette-mask">
          <rect x="-500" y="-500" width="1200" height="1200" fill="white" />
          <g transform="translate(100,100) scale(${scale}) translate(-100,-100)">
            <path d="${currentCity.path}" fill="black" />
          </g>
        </mask>
      </defs>
      <rect x="-500" y="-500" width="1200" height="1200" fill="black" fill-opacity="0.6" mask="url(#silhouette-mask)" />
      <g transform="translate(100,100) scale(${scale}) translate(-100,-100)">
        <path d="${currentCity.path}" ${fillAttr} stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" opacity="${opacity}"/>
      </g>
    </svg>`;

    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const drawWatermark = () => {
      const fontSize = Math.max(18, Math.floor(h / 32));
      ctx.font = `bold ${fontSize}px -apple-system, "Hiragino Sans", "Yu Gothic", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.min(opacity + 0.1, 1);
      ctx.fillText(`山口県 ${currentCity.name}`, w - 28, h - 28);
      const subSize = Math.max(10, Math.floor(fontSize * 0.45));
      ctx.font = `${subSize}px -apple-system, sans-serif`;
      ctx.globalAlpha = Math.min(opacity + 0.1, 1) * 0.75;
      ctx.fillText(currentCity.reading, w - 28, h - 28 - fontSize - 4);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };
    
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      drawWatermark();
      setCapturedImage(canvas.toDataURL('image/png'));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      drawWatermark();
      setCapturedImage(canvas.toDataURL('image/png'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleDownload = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `yamaguchi_${currentCity.id}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <button onClick={() => setShowSettings(s => !s)} className={`p-2 rounded-full ${showSettings ? 'bg-white/20' : 'hover:bg-white/10 active:bg-white/20'}`} title="設定">
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
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 200 200" 
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <mask id="silhouette-mask">
                  <rect x="-500" y="-500" width="1200" height="1200" fill="white" />
                  <g transform={`translate(100,100) scale(${scale}) translate(-100,-100)`}>
                    <path d={currentCity.path} fill="black" />
                  </g>
                </mask>
              </defs>
              <rect 
                x="-500" y="-500" width="1200" height="1200" 
                fill="black" 
                fillOpacity={0.6}
                mask="url(#silhouette-mask)"
              />
              <g transform={`translate(100,100) scale(${scale}) translate(-100,-100)`}>
                <path 
                  d={currentCity.path}
                  fill={showFill ? color : 'none'}
                  fillOpacity={showFill ? opacity * 0.18 : 0}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={opacity}
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                />
              </g>
            </svg>
            
            {/* City info overlay */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
              <div className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-md">
                <div className="text-base font-bold leading-tight">{currentCity.name}</div>
                <div className="text-[9px] text-gray-300 tracking-[0.15em] leading-tight">{currentCity.reading}</div>
              </div>
              <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-[10px] tabular-nums">
                {String(cityIndex + 1).padStart(2, '0')} / {CITIES.length}
              </div>
            </div>

            {/* Settings panel overlay */}
            {showSettings && (
              <div className="absolute inset-x-0 bottom-0 bg-black/90 backdrop-blur-md p-4 space-y-3 z-30 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold tracking-wider text-gray-300">フレーム設定</h3>
                  <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1.5 tracking-wide">COLOR</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button 
                        key={c}
                        onClick={() => setColor(c)}
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
                    onChange={e => setOpacity(parseFloat(e.target.value))} 
                    className="w-full accent-white"/>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 flex justify-between mb-1 tracking-wide">
                    <span>SIZE</span><span className="tabular-nums">{scale.toFixed(2)}x</span>
                  </label>
                  <input type="range" min="0.3" max="2" step="0.05" value={scale}
                    onChange={e => setScale(parseFloat(e.target.value))}
                    className="w-full accent-white"/>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 flex justify-between mb-1 tracking-wide">
                    <span>STROKE</span><span className="tabular-nums">{strokeWidth.toFixed(1)}</span>
                  </label>
                  <input type="range" min="0.5" max="6" step="0.1" value={strokeWidth}
                    onChange={e => setStrokeWidth(parseFloat(e.target.value))}
                    className="w-full accent-white"/>
                </div>

                <label className="flex items-center justify-between text-xs cursor-pointer pt-1">
                  <span className="text-gray-300">塗りつぶし</span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={showFill} 
                      onChange={e => setShowFill(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 rounded-full peer-checked:bg-white transition-colors"></div>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${showFill ? 'translate-x-4 bg-black' : 'bg-gray-300'}`}></div>
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
          onClick={() => setCityIndex(i => (i - 1 + CITIES.length) % CITIES.length)}
          className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 overflow-x-auto flex gap-1.5 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>
          {CITIES.map((city, i) => (
            <button
              key={city.id}
              onClick={() => setCityIndex(i)}
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
          onClick={() => setCityIndex(i => (i + 1) % CITIES.length)}
          className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Capture button */}
      <div className="bg-black px-4 pt-3 pb-5 flex justify-center items-center">
        <button
          onClick={handleCapture}
          disabled={!!error || loading}
          className="w-16 h-16 rounded-full bg-transparent border-[3px] border-white hover:scale-105 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center group"
          aria-label="撮影"
        >
          <div className="w-12 h-12 rounded-full bg-white group-active:bg-gray-300 transition-colors"></div>
        </button>
      </div>

      {/* Captured image overlay */}
      {capturedImage && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col">
          <div className="flex-1 overflow-auto flex items-center justify-center p-3">
            <img src={capturedImage} alt="撮影された写真" className="max-w-full max-h-full object-contain rounded shadow-2xl" />
          </div>
          <div className="bg-black p-4 pb-5 flex gap-3 justify-center">
            <button
              onClick={() => setCapturedImage(null)}
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
              ダウンロード
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
