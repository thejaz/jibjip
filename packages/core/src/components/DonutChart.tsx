"use client";

import { useId } from "react";
import type Decimal from "decimal.js";
import { mixColor } from "../lib/colors";
import { donutArcs } from "../lib/chart-visuals";

/** Shared proportional ring; the caller supplies its complete accessible summary and legend. */
export function DonutChart({ items, total }: {
  items: Array<{ id: string; label: string; color: string; value: Decimal }>;
  total: Decimal;
}) {
  const id = useId().replaceAll(":", "");
  const arcs = donutArcs(items.map(item => item.value), total);
  return <svg viewBox="0 0 120 120" aria-hidden="true" className="chart-donut">
    <defs>{items.map((item, index) => <linearGradient key={item.id} id={`${id}-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor={item.color} /><stop offset="100%" stopColor={mixColor(item.color, "#000000", .12)} />
    </linearGradient>)}</defs>
    <circle className="chart-donut-track" cx="60" cy="60" r="44" />
    {items.map((item, index) => {
      const arc = arcs[index];
      return arc && arc.visible > 0 ? <circle key={item.id} className="chart-donut-segment" cx="60" cy="60" r="44"
        stroke={`url(#${id}-${index})`} strokeDasharray={`${arc.visible} ${arc.circumference - arc.visible}`}
        strokeDashoffset={arc.offset}><title>{item.label}</title></circle> : null;
    })}
  </svg>;
}
