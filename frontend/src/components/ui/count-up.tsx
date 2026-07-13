"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

/** Animated number that counts up on mount. Respects reduced motion. */
export function CountUp({
  value,
  duration = 1.1,
  decimals = 0,
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      setDisplay(value);
      return;
    }
    started.current = true;
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span className={className}>
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
    </span>
  );
}
