/** WCAG relative luminance for the app's persisted six-digit sRGB colors. */
export function relativeLuminance(color: string): number {
  const hex = color.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error("Expected a six-digit color.");
  const [r, g, b] = [0, 2, 4].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first), b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Interleaved hues keep adjacent chart series distinct; badges use lighter tones. */
export const DATA_COLORS = [
  "#5865D8", "#168E83", "#DA603E", "#D6447E", "#8055C9", "#B98116",
  "#248657", "#148CA6", "#A154BA", "#C36D24", "#758B30", "#9E6553",
  "#D83485", "#6674C7", "#329275", "#D34A5C", "#9B821E", "#8B6CBB",
  "#568C3E", "#C65C7B", "#B17818", "#64748B", "#8C7860", "#9C4EB5",
] as const;

export function mixColor(color: string, target: "#000000" | "#FFFFFF", amount: number): string {
  const base = /^#[0-9a-f]{6}$/i.test(color) ? color : "#7A8391";
  const destination = target === "#FFFFFF" ? 255 : 0;
  const proportion = Math.max(0, Math.min(1, amount));
  return "#" + [1, 3, 5].map(offset => {
    const channel = parseInt(base.slice(offset, offset + 2), 16);
    return Math.round(channel + (destination - channel) * proportion).toString(16).padStart(2, "0");
  }).join("").toUpperCase();
}

/** One badge language: black labels/glyphs on opaque, hue-preserving light tones. */
export function tonalBadgeStyle(accent: string) {
  return {
    backgroundColor: mixColor(accent, "#FFFFFF", 0.64),
    color: "#000000",
    boxShadow: `inset 0 0 0 1px ${mixColor(accent, "#FFFFFF", 0.4)}`,
  };
}
