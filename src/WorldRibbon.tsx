/** A banner with folded tails, centred on the origin: island names and the map title. */
export default function Ribbon({ text, size, paper, ink, tail, color }: { text: string; size: number; paper: string; ink: string; tail: string; color: string }) {
  const w = text.length * size * 0.72 + size * 1.8, h = size * 1.75, t = size * 1.5, d = h * 0.24, n = size * 0.6
  const side = (s: 1 | -1) => `M${s * w / 2 - s * 4},${-h / 2 + d}H${s * (w / 2 + t)}L${s * (w / 2 + t - n)},${d}L${s * (w / 2 + t)},${h / 2 + d}H${s * w / 2 - s * 4}Z`
  return <g>
    <path d={side(-1)} fill={tail} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
    <path d={side(1)} fill={tail} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
    <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={paper} stroke={ink} strokeWidth="1.5" />
    <text className="world-ribbon" y={size * 0.34} textAnchor="middle" fontSize={size} style={{ fill: color }}>{text}</text>
  </g>
}
