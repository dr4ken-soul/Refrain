'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export function Counter({
  value,
  className,
  suffix = '',
  immediate = false,
}: {
  value: number;
  className?: string;
  suffix?: string;
  immediate?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.1 });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);
  const active = immediate || inView;

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      previous.current = value;
      return;
    }
    if (!active) return;
    const from = previous.current;
    if (from === value) {
      setDisplay(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
      onComplete: () => {
        previous.current = value;
      },
    });
    return () => controls.stop();
  }, [active, reduced, value]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}
