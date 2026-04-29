import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { WinnerCategory } from '../../lib/winners';
import { CATEGORY_META } from '../../lib/winners';

interface Props {
  category: WinnerCategory;
  playerNames: string[];
  metricValue: number;
  delayMs?: number;
}

export default function WinnerCard({ category, playerNames, metricValue, delayMs = 0 }: Props) {
  const meta = CATEGORY_META[category];
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [imgFailed, setImgFailed] = useState(false);

  function onMove(e: React.PointerEvent) {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 8, y: px * 8 });
  }
  function onLeave() { setTilt({ x: 0, y: 0 }); }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      initial={{ opacity: 0, scale: 0.85, filter: 'blur(20px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ delay: delayMs / 1000, type: 'spring', stiffness: 220, damping: 22 }}
      style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      className="winner-card relative rounded-2xl border-2 border-euro-gold/60 bg-black/40 aspect-[3/4] w-full max-w-[280px]"
    >
      {!imgFailed ? (
        <picture>
          <source srcSet={`${meta.image.replace('.jpg', '@2x.jpg')} 2x, ${meta.image} 1x`} />
          <img
            src={meta.image}
            alt={meta.label}
            loading="lazy"
            className="w-full h-full object-cover rounded-2xl"
            onError={() => setImgFailed(true)}
          />
        </picture>
      ) : (
        <div className="w-full h-full grid place-items-center rounded-2xl bg-gradient-to-br from-euro-purple-dark to-euro-deep">
          <span className="text-7xl select-none">{meta.emojiFallback}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/55 to-transparent rounded-b-2xl">
        <div className="text-euro-gold font-bold text-sm">{meta.label}</div>
        <div className="text-white text-base font-bold leading-tight">
          {playerNames.length > 1 ? playerNames.slice(0, 5).join(' & ') : playerNames[0] ?? '—'}
        </div>
        <div className="text-white/70 text-xs">{meta.metricLabel} · {metricValue}</div>
      </div>
    </motion.div>
  );
}
