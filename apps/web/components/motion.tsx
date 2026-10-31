'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

const ease = [0.16, 1, 0.3, 1] as const;

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { filter: 'blur(8px)', opacity: 0, y: 18 }}
      whileInView={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.1 }}
      transition={{ duration: reduced ? 0.2 : 0.65, ease, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduced ? 0 : 0.05, delayChildren: reduced ? 0 : 0.08 },
    },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: false, amount: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const variants: Variants = {
    hidden: reduced ? { opacity: 0 } : { filter: 'blur(8px)', opacity: 0, y: 18 },
    show: reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      transition={{ duration: reduced ? 0.2 : 0.65, ease }}
    >
      {children}
    </motion.div>
  );
}

export function HeroLoad({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { filter: 'blur(10px)', opacity: 0, y: 24 }}
      animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.2 : 0.85, ease, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

export function WordReveal({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  const words = text.split(' ');
  return (
    <motion.p
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: false, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.07 } } }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block"
          variants={{
            hidden: reduced ? { opacity: 0 } : { filter: 'blur(8px)', opacity: 0, y: 18 },
            show: reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 },
          }}
          transition={{ duration: reduced ? 0.2 : 0.55, ease }}
        >
          {word}
          {index < words.length - 1 ? '\u00a0' : ''}
        </motion.span>
      ))}
    </motion.p>
  );
}
