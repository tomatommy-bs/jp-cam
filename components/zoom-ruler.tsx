'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

type Props = {
  min: number;
  max: number;
  step?: number;
  majorEvery?: number;
  value: number;
  onChange: (v: number) => void;
};

export function ZoomRuler({
  min,
  max,
  step = 0.1,
  majorEvery = 5,
  value,
  onChange,
}: Props) {
  const ticks = useMemo(() => {
    const arr: number[] = [];
    const count = Math.max(1, Math.round((max - min) / step) + 1);
    for (let i = 0; i < count; i++) arr.push(+(min + i * step).toFixed(2));
    return arr;
  }, [min, max, step]);

  const valueIndex = useCallback(
    (v: number) => {
      const i = Math.round((v - min) / step);
      return Math.max(0, Math.min(ticks.length - 1, i));
    },
    [min, step, ticks.length],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    containScroll: false,
    skipSnaps: false,
    dragFree: false,
    startIndex: valueIndex(value),
  });

  const handleSelect = useCallback(() => {
    if (!emblaApi) return;
    const i = emblaApi.selectedScrollSnap();
    const next = ticks[i];
    if (next !== undefined && Math.abs(next - value) > step / 2) {
      onChange(next);
    }
  }, [emblaApi, ticks, onChange, value, step]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', handleSelect);
    return () => {
      emblaApi.off('select', handleSelect);
    };
  }, [emblaApi, handleSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    const i = valueIndex(value);
    if (emblaApi.selectedScrollSnap() !== i) {
      emblaApi.scrollTo(i, true);
    }
  }, [emblaApi, value, valueIndex]);

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit({ startIndex: valueIndex(valueRef.current) });
  }, [emblaApi, ticks.length, valueIndex]);

  return (
    <div className="relative w-full select-none">
      <div className="pointer-events-none absolute left-1/2 -top-1 -translate-x-1/2 z-10 flex flex-col items-center">
        <div className="px-1.5 py-0.5 rounded bg-yellow-300 text-black text-[10px] font-bold tabular-nums leading-none">
          {value.toFixed(1)}x
        </div>
        <div className="h-0 w-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-yellow-300 mt-px" />
      </div>

      <div
        className="overflow-hidden cursor-grab active:cursor-grabbing pt-5"
        ref={emblaRef}
      >
        <div className="flex items-end h-10">
          {ticks.map((t, i) => {
            const isMajor = i % majorEvery === 0;
            return (
              <div
                key={i}
                className="flex-shrink-0 w-3.5 flex flex-col items-center"
              >
                <div
                  className={
                    isMajor ? 'w-px h-4 bg-white' : 'w-px h-2 bg-white/40'
                  }
                />
                <div className="h-3 mt-0.5 text-[9px] text-white/80 tabular-nums leading-none">
                  {isMajor ? (t % 1 === 0 ? t.toFixed(0) : t.toFixed(1)) : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
