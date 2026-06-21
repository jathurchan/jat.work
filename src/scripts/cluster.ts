// Cluster model + canvas rendering shared by the ambient teaser and the
// interactive RaftLock demo. Pure drawing — no DOM wiring lives here.

export type NodeState = 'leader' | 'follower' | 'crashed';

export interface ClusterNode {
  id: number;
  /** position as a fraction of the canvas (0..1) */
  fx: number;
  fy: number;
  color: string;
  state: NodeState;
}

const BRAND = ['#4285f4', '#ea4335', '#f4b400', '#0f9d58', '#4285f4'];
const ACCENT = '#4285f4';
export const QUORUM = 3; // majority of 5

// Grid layout: aligned to strict geometric points to match the HUD blueprint.
const LAYOUT: { fx: number; fy: number }[] = [
  { fx: 0.5, fy: 0.25 },  // Leader: top-center
  { fx: 0.25, fy: 0.5 },  // Follower 1: middle-left
  { fx: 0.75, fy: 0.5 },  // Follower 2: middle-right
  { fx: 0.25, fy: 0.75 }, // Follower 3: bottom-left
  { fx: 0.75, fy: 0.75 }, // Follower 4: bottom-right
];

export function makeNodes(): ClusterNode[] {
  return LAYOUT.map((p, i) => ({
    id: i,
    fx: p.fx,
    fy: p.fy,
    color: BRAND[i],
    state: i === 0 ? 'leader' : 'follower',
  }));
}

/** Prepare a canvas for crisp rendering at the device pixel ratio. */
export function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.clientWidth || 300;
  const h = rect.height || canvas.clientHeight || 150;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

export interface DrawOpts {
  /** node radius in px */
  r?: number;
  /** show heartbeat pulses travelling leader -> followers */
  heartbeats?: boolean;
  /** draw LEADER / FOLLOWER / DOWN labels beneath nodes */
  labels?: boolean;
  /** the shared lock is currently held — draw a padlock on the leader */
  lockHeld?: boolean;
}

/**
 * Pixel position of a node, laid out on an evenly-spaced circle (a pentagon
 * for 5 nodes) centred in the canvas. Positions are keyed by `id`, so a node
 * keeps its place when its role changes — only the badge moves on election.
 */
export function nodeXY(n: ClusterNode, w: number, h: number, count: number, r: number) {
  const cx = w / 2;
  // bias slightly upward so labels below the bottom nodes stay in frame
  const cy = h / 2 - r * 0.2;
  const marginX = r + 30;
  const marginY = r * 1.6 + 26; // leave room for the label under each node
  let rx = Math.max(r + 14, w / 2 - marginX);
  let ry = Math.max(r + 14, h / 2 - marginY);
  // allow a gentle ellipse so the cluster fills wide stages, but cap the
  // aspect so it never looks stretched.
  const cap = Math.min(rx, ry) * 1.8;
  rx = Math.min(rx, cap);
  ry = Math.min(ry, cap);
  const a = -Math.PI / 2 + n.id * ((2 * Math.PI) / count);
  return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
}

export function drawCluster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nodes: ClusterNode[],
  t: number,
  opts: DrawOpts = {},
) {
  const r = opts.r ?? 11;
  const count = nodes.length;
  const isDark = document.documentElement.dataset.theme === 'dark';
  
  const edgeColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
  const labelColor = isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)';
  const downColor = isDark ? 'rgba(234, 67, 53, 0.85)' : 'rgba(217, 48, 37, 0.85)';
  const followerFill = isDark ? 'rgba(20, 22, 28, 0.7)' : 'rgba(255, 255, 255, 0.7)';

  const pos = (n: ClusterNode) => nodeXY(n, w, h, count, r);
  const leader = nodes.find((n) => n.state === 'leader');

  ctx.clearRect(0, 0, w, h);

  // edges leader -> alive followers
  if (leader) {
    const { x: x1, y: y1 } = pos(leader);
    for (const n of nodes) {
      if (n === leader || n.state === 'crashed') continue;
      const { x: x2, y: y2 } = pos(n);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // heartbeat pulse travelling along the edge
      if (opts.heartbeats) {
        const phase = (t / 1400 + n.id * 0.21) % 1;
        const hx = x1 + (x2 - x1) * phase;
        const hy = y1 + (y2 - y1) * phase;
        ctx.beginPath();
        ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.globalAlpha = 0.55 * (1 - phase) + 0.15;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  const drawLabel = (text: string, x: number, y: number, color: string) => {
    if (!opts.labels) return;
    ctx.fillStyle = color;
    ctx.font = `600 ${Math.max(8, Math.round(r * 0.62))}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + r + 13);
  };

  // nodes
  for (const n of nodes) {
    const { x, y } = pos(n);

    if (n.state === 'crashed') {
      ctx.strokeStyle = downColor;
      ctx.lineWidth = 2.4;
      const s = r * 0.62;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();
      drawLabel('DOWN', x, y, downColor);
      continue;
    }

    if (n.state === 'leader') {
      // pulse ring
      const pulse = (Math.sin(t / 480) + 1) / 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 5 + pulse * 5, 0, Math.PI * 2);
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.18 + 0.22 * (1 - pulse);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = ACCENT;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${Math.round(r * 0.9)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('L', x, y + 0.5);

      // padlock badge when the lock is held
      if (opts.lockHeld) drawLock(ctx, x + r * 0.75, y - r * 0.85, r * 0.6);

      drawLabel('LEADER', x, y, ACCENT);
    } else {
      // follower: hollow with coloured ring
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = followerFill;
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = n.color;
      ctx.stroke();
      drawLabel('FOLLOWER', x, y, labelColor);
    }
  }
}

/** Tiny padlock glyph, centred on (cx, cy), sized to ~`s` px. */
function drawLock(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const bw = s * 1.6;
  const bh = s * 1.2;
  const lockColor = '#ea4335';
  
  ctx.save();
  // shackle
  ctx.beginPath();
  ctx.arc(cx, cy - bh * 0.4, s * 0.5, Math.PI, 0);
  ctx.lineWidth = Math.max(1.6, s * 0.3);
  ctx.strokeStyle = lockColor;
  ctx.stroke();
  
  // body
  const x = cx - bw / 2;
  const y = cy - bh * 0.1;
  const rr = s * 0.25;
  
  const grad = ctx.createLinearGradient(x, y, x, y + bh);
  grad.addColorStop(0, '#f25b50');
  grad.addColorStop(1, '#c52214');
  ctx.fillStyle = grad;
  
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + bw, y, x + bw, y + bh, rr);
  ctx.arcTo(x + bw, y + bh, x, y + bh, rr);
  ctx.arcTo(x, y + bh, x, y, rr);
  ctx.arcTo(x, y, x + bw, y, rr);
  ctx.fill();
  
  // keyhole
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, y + bh * 0.4, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, y + bh * 0.4);
  ctx.lineTo(cx + s * 0.1, y + bh * 0.4);
  ctx.lineTo(cx + s * 0.15, y + bh * 0.8);
  ctx.lineTo(cx - s * 0.15, y + bh * 0.8);
  ctx.fill();
  
  ctx.restore();
}
