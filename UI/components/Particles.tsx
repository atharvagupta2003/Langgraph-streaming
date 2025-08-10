'use client';

import { useMemo } from 'react';

interface ParticleStyle {
  left: string;
  animationDelay: string;
  animationDuration: string;
}

export default function Particles({ count = 40 }: { count?: number }) {
  const particles = useMemo<ParticleStyle[]>(() => {
    return Array.from({ length: count }).map(() => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 20}s`,
      animationDuration: `${15 + Math.random() * 10}s`,
    }));
  }, [count]);

  return (
    <div className="particles pointer-events-none select-none">
      {particles.map((style, idx) => (
        <div
          key={idx}
          className="particle"
          style={{ left: style.left, animationDelay: style.animationDelay, animationDuration: style.animationDuration }}
        />
      ))}
    </div>
  );
}


