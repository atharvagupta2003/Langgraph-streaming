'use client';

import { useEffect, type PropsWithChildren } from 'react';
import Lenis from 'lenis';

export default function LenisProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const lenis = new Lenis({
      smoothWheel: true,
      lerp: 0.1,
      anchors: true,
      allowNestedScroll: true,
      // Ensure native scrolling inside marked containers
      // @ts-ignore - prevent is a valid option
      prevent: (node: HTMLElement) => {
        return !!(node?.closest?.('[data-lenis-prevent]'));
      },
    } as any);
    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      // @ts-ignore
      lenis.destroy?.();
    };
  }, []);
  return children as any;
}


