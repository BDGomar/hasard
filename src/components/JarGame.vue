<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

/**
 * Bocal en verre **sphérique** contenant les 10 boules.
 *
 * - phase "betting" : les boules reposent au fond de la sphère, cliquables
 * - phase "mixing"  : agitation dans TOUT le volume (tourbillon + turbulence),
 *                     avec traînées de vitesse pour bien voir le mouvement
 * - prop "emerge"   : la boule gagnante remonte et sort par le col
 * - prop "muted"    : coupe les sons de choc contre le verre
 *
 * Un vrai son de boule qui frappe le verre est synthétisé (Web Audio) :
 * transitoire bruité + deux partiels résonants, déclenché par les chocs.
 */
const props = defineProps({
  balls: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  phase: { type: String, default: 'betting' },
  disabled: { type: Boolean, default: false },
  emerge: { type: Object, default: null }, // boule gagnante {id,name,hex}
  muted: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle', 'emerged'])

/* ================= Géométrie du bocal (sphère) ================= */
const W = 360
const H = 460
const CX = 180 // centre X
const CY = 268 // centre Y
const RJ = 148 // rayon du bocal
const NW = 34 // demi-largeur du col
const NY = 92 // ordonnée de l'ouverture
const NECK_BASE = CY - Math.sqrt(RJ * RJ - NW * NW) // jonction col / sphère
const R = 19 // rayon d'une boule
const TAU = Math.PI * 2

const GRAV = 0.5 // gravité (px / pas 60 Hz)
const SWIRL = 1.0 // force du tourbillon pendant le mélange

const canvas = ref(null)
let ctx = null
let raf = 0
let bodies = []
let mode = 'settle' // settle | mix | emerge | hover
let winnerBody = null
let emergeFrom = null
let emergeStart = 0
let emergedEmitted = false
let nowT = 0
let lastT = 0

const reduced =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* ================= Monde physique ================= */
function initBodies() {
  bodies = props.balls.map((ball, i) => ({
    id: ball.id,
    ball,
    x: CX + (Math.random() - 0.5) * RJ * 0.9,
    y: CY - RJ * 0.55 + (i % 5) * 24,
    vx: (Math.random() - 0.5) * 3,
    vy: 0,
    r: R,
    emerging: false,
  }))
}

/** Contention dans la sphère + son de choc contre le verre. */
function contain(b) {
  const dx = b.x - CX
  const dy = b.y - CY
  const d = Math.hypot(dx, dy) || 0.0001
  const maxD = RJ - b.r
  if (d <= maxD) return

  const nx = dx / d
  const ny = dy / d
  b.x = CX + nx * maxD
  b.y = CY + ny * maxD

  const vn = b.vx * nx + b.vy * ny // composante vers l'extérieur
  if (vn <= 0) return

  const e = 0.55 // rebond sur le verre
  b.vx -= (1 + e) * vn * nx
  b.vy -= (1 + e) * vn * ny
  b.vx *= 0.94
  b.vy *= 0.94

  if (vn > 3.0) queueImpact(vn * 0.75)
}

/** Collision élastique entre deux boules. */
function collide(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy) || 0.0001
  const min = a.r + b.r
  if (dist >= min) return

  const nx = dx / dist
  const ny = dy / dist
  const overlap = (min - dist) / 2
  a.x -= nx * overlap
  a.y -= ny * overlap
  b.x += nx * overlap
  b.y += ny * overlap

  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
  if (vn >= 0) return

  const imp = (-(1 + 0.6) * vn) / 2
  a.vx -= imp * nx
  a.vy -= imp * ny
  b.vx += imp * nx
  b.vy += imp * ny

  if (-vn > 3.2) queueImpact(-vn * 0.5)
}

/** Intègre le mouvement sur un sous-pas h (en unités de 1/60 s). */
function integrate(h) {
  const mixing = mode === 'mix'

  for (const b of bodies) {
    if (b.emerging) continue

    b.vy += (mixing ? GRAV * 0.16 : GRAV) * h

    if (mixing) {
      // Tourbillon (force tangentielle) + turbulence + légère poussée radiale,
      // pour occuper tout le volume de la sphère.
      const dx = b.x - CX
      const dy = b.y - CY
      const d = Math.hypot(dx, dy) || 0.0001
      const tx = -dy / d
      const ty = dx / d
      const swirl = (reduced ? SWIRL * 0.35 : SWIRL) * (0.7 + 0.5 * Math.sin(nowT / 700))
      const turb = reduced ? 0.9 : 2.6

      b.vx += (tx * swirl + (Math.random() - 0.5) * turb + (dx / d) * 0.5) * h
      b.vy += (ty * swirl + (Math.random() - 0.5) * turb + (dy / d) * 0.5) * h
    }

    const damp = Math.pow(mixing ? 0.991 : 0.995, h)
    b.vx *= damp
    b.vy *= damp

    const sp = Math.hypot(b.vx, b.vy)
    const cap = mixing ? 26 : 14
    if (sp > cap) {
      b.vx = (b.vx / sp) * cap
      b.vy = (b.vy / sp) * cap
    }

    b.x += b.vx * h
    b.y += b.vy * h
    contain(b)
  }
}

function resolveCollisions() {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]
      const b = bodies[j]
      if (a.emerging || b.emerging) continue
      collide(a, b)
    }
  }
}

function step(t) {
  if (!lastT) lastT = t
  let dt = (t - lastT) / 16.667 // en unités de 1/60 s
  lastT = t
  dt = Math.min(dt, 2.5) // après un onglet en arrière-plan, on évite l'explosion
  nowT = t

  // Sous-pas si le pas est grand, pour garder des rebonds propres.
  const n = mode === 'mix' && dt > 1.2 ? 2 : 1
  const h = dt / n
  for (let k = 0; k < n; k++) integrate(h)
  resolveCollisions()
  resolveCollisions()
  // Les collisions déplacent les boules : on re-vérifie la paroi du bocal.
  for (const b of bodies) if (!b.emerging) contain(b)

  if (mode === 'emerge' && winnerBody) stepEmerge(t)
}

/* ================= Émergence par le col ================= */
function easeInOut(u) {
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}
function easeOut(u) {
  return 1 - Math.pow(1 - u, 3)
}
function quadBezier(p0, c, p1, u) {
  const k = 1 - u
  return {
    x: k * k * p0.x + 2 * k * u * c.x + u * u * p1.x,
    y: k * k * p0.y + 2 * k * u * c.y + u * u * p1.y,
  }
}

function startEmerge(ball) {
  const body = bodies.find((b) => b.id === ball.id)
  if (!body) return
  winnerBody = body
  body.emerging = true
  emergeFrom = { x: body.x, y: body.y }
  emergeStart = nowT || performance.now()
  emergedEmitted = false
  mode = 'emerge'
}

function dropWinner() {
  if (winnerBody) winnerBody.emerging = false
  winnerBody = null
  mode = 'settle'
}

function stepEmerge(t) {
  const el = t - emergeStart
  const A = 620 // remontée vers le centre du col
  const B = 780 // traversée du col
  const C = 320 // pose au-dessus
  const MIDY = CY * 0.6
  const HOVER = 52

  if (el < A) {
    const u = easeInOut(el / A)
    const c = { x: (emergeFrom.x + CX) / 2, y: emergeFrom.y * 0.55 }
    const pos = quadBezier(emergeFrom, c, { x: CX, y: MIDY }, u)
    winnerBody.x = pos.x
    winnerBody.y = pos.y
  } else if (el < A + B) {
    const u = easeInOut((el - A) / B)
    winnerBody.x = CX
    winnerBody.y = MIDY + (NY - 30 - MIDY) * u
  } else if (el < A + B + C) {
    const u = easeOut((el - A - B) / C)
    winnerBody.x = CX
    winnerBody.y = NY - 30 + (HOVER - (NY - 30)) * u
  } else {
    winnerBody.x = CX
    winnerBody.y = HOVER + Math.sin(t / 420) * 4
    mode = 'hover'
    if (!emergedEmitted) {
      emergedEmitted = true
      emit('emerged', winnerBody.id)
    }
  }
}

/* ================= Son : boules contre le verre ================= */
let audio = null
let master = null
let noiseBuf = null
let impactQueue = []
let lastClackAt = -1

function ensureAudio() {
  if (audio) return
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  try {
    audio = new AC()
  } catch {
    audio = null
    return
  }

  master = audio.createGain()
  master.gain.value = 0.8

  // Compresseur : évite la saturation quand plusieurs chocs se superposent.
  const comp = audio.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 14
  comp.ratio.value = 9
  comp.attack.value = 0.002
  comp.release.value = 0.13

  master.connect(comp)
  comp.connect(audio.destination) // son direct

  // Petite réverbération de pièce (impulsion synthétisée) pour le réalisme.
  try {
    const conv = audio.createConvolver()
    conv.buffer = makeImpulse(0.34, 2.4)
    const wet = audio.createGain()
    wet.gain.value = 0.2
    comp.connect(conv)
    conv.connect(wet)
    wet.connect(audio.destination)
  } catch {
    /* réverbération optionnelle */
  }

  // Bruit de choc pré-calculé (décroissance quadratique).
  const len = Math.floor(audio.sampleRate * 0.08)
  noiseBuf = audio.createBuffer(1, len, audio.sampleRate)
  const ch = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const k = 1 - i / len
    ch[i] = (Math.random() * 2 - 1) * k * k
  }
}

/** Impulsion de réverbération (bruit à décroissance exponentielle). */
function makeImpulse(seconds, decay) {
  const rate = audio.sampleRate
  const len = Math.max(1, Math.floor(rate * seconds))
  const buf = audio.createBuffer(2, len, rate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

/** À appeler sur un geste utilisateur (politique d'autoplay des navigateurs).
 *  Retourne true si l'audio tourne vraiment. */
function unlock() {
  ensureAudio()
  if (!audio) return false
  if (audio.state === 'suspended') {
    audio.resume().catch(() => {})
  }
  return audio.state === 'running'
}

function clack(strength) {
  if (!audio || audio.state !== 'running' || props.muted) return
  const t = audio.currentTime
  const level = Math.min(1, strength)
  const vol = 0.05 + level * 0.22

  // 1) Transitoire : court bruit filtré (le « tac » du verre).
  const src = audio.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = 0.9 + Math.random() * 0.6
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1500 + Math.random() * 1700
  bp.Q.value = 0.9
  const g = audio.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  src.connect(bp)
  bp.connect(g)
  g.connect(master)
  src.start(t)
  src.stop(t + 0.06)

  // 2) Résonances cristallines (le « tling » caractéristique).
  const f1 = 1750 + Math.random() * 950
  ring(f1, vol * 0.42, 0.1 + level * 0.12, t)
  ring(f1 * (1.9 + Math.random() * 0.35), vol * 0.22, 0.07 + level * 0.08, t)
}

function ring(freq, amp, dur, t) {
  const osc = audio.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq
  const og = audio.createGain()
  og.gain.setValueAtTime(amp, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(og)
  og.connect(master)
  osc.start(t)
  osc.stop(t + dur)
}

function queueImpact(strength) {
  if (impactQueue.length < 12) impactQueue.push(strength)
}

/** Joue au plus 2 chocs par image, avec un intervalle minimal (évite la bouillie). */
function flushImpacts() {
  if (!impactQueue.length) return
  if (!audio || audio.state !== 'running' || props.muted) {
    impactQueue.length = 0
    return
  }
  if (audio.currentTime - lastClackAt < 0.06) {
    impactQueue.length = 0
    return
  }
  impactQueue.sort((a, b) => b - a)
  const n = Math.min(2, impactQueue.length)
  for (let i = 0; i < n; i++) clack(impactQueue[i])
  lastClackAt = audio.currentTime
  impactQueue.length = 0
}

/* ================= Dessin ================= */
function circlePath() {
  ctx.beginPath()
  ctx.arc(CX, CY, RJ, 0, TAU)
}

function rgba(hex, a) {
  const h = String(hex).replace('#', '')
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(s, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function drawGroundShadow() {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(CX, CY + RJ - 2, RJ * 0.82, 16, 0, 0, TAU)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.filter = 'blur(7px)'
  ctx.fill()
  ctx.restore()
}

function drawGlassBack() {
  circlePath()
  const g = ctx.createRadialGradient(CX - RJ * 0.38, CY - RJ * 0.45, RJ * 0.08, CX, CY, RJ)
  g.addColorStop(0, 'rgba(45, 140, 96, 0.10)')
  g.addColorStop(0.55, 'rgba(13, 43, 30, 0.34)')
  g.addColorStop(1, 'rgba(4, 14, 9, 0.66)')
  ctx.fillStyle = g
  ctx.fill()
}

function drawStreak(b) {
  const sp = Math.hypot(b.vx, b.vy)
  if (sp < 3.5) return
  const k = Math.min(14, sp * 0.75)
  ctx.beginPath()
  ctx.moveTo(b.x - (b.vx / sp) * k, b.y - (b.vy / sp) * k)
  ctx.lineTo(b.x, b.y)
  ctx.strokeStyle = rgba(b.ball.hex, 0.16)
  ctx.lineWidth = b.r * 1.2
  ctx.lineCap = 'round'
  ctx.stroke()
}

function drawBallBody(b) {
  const { x, y, r } = b

  ctx.save()

  // Ombre portée
  ctx.beginPath()
  ctx.arc(x + 2, y + 4, r, 0, TAU)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fill()

  // Couleur
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fillStyle = b.ball.hex
  ctx.fill()

  // Lumière haut-gauche
  const g1 = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x - r * 0.2, y - r * 0.25, r * 1.2)
  g1.addColorStop(0, 'rgba(255,255,255,0.78)')
  g1.addColorStop(0.4, 'rgba(255,255,255,0.10)')
  g1.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g1
  ctx.fill()

  // Ombrage bas-droite
  const g2 = ctx.createRadialGradient(x + r * 0.3, y + r * 0.4, r * 0.2, x, y, r * 1.15)
  g2.addColorStop(0, 'rgba(0,0,0,0)')
  g2.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx.fillStyle = g2
  ctx.fill()

  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.stroke()

  ctx.restore()
}

function drawSelectionRing(b) {
  if (!props.selected.includes(b.id)) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(b.x, b.y, b.r + 3.5, 0, TAU)
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 3
  ctx.shadowColor = 'rgba(250,204,21,0.9)'
  ctx.shadowBlur = 14
  ctx.stroke()
  ctx.restore()
}

function drawGlassFront() {
  // Paroi
  circlePath()
  ctx.strokeStyle = 'rgba(186, 255, 224, 0.34)'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Épaisseur interne légère
  ctx.beginPath()
  ctx.arc(CX, CY, RJ - 5, 0, TAU)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 7
  ctx.stroke()

  // Grand reflet haut-gauche
  ctx.beginPath()
  ctx.ellipse(CX - RJ * 0.42, CY - RJ * 0.44, RJ * 0.30, RJ * 0.18, -0.75, 0, TAU)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fill()

  // Petit reflet bas-droite
  ctx.beginPath()
  ctx.ellipse(CX + RJ * 0.46, CY + RJ * 0.40, RJ * 0.15, RJ * 0.09, -0.6, 0, TAU)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fill()

  // Col + ouverture
  ctx.beginPath()
  ctx.moveTo(CX - NW, NY)
  ctx.lineTo(CX - NW, NECK_BASE)
  ctx.lineTo(CX + NW, NECK_BASE)
  ctx.lineTo(CX + NW, NY)
  ctx.closePath()
  ctx.fillStyle = 'rgba(10, 30, 22, 0.55)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(186, 255, 224, 0.30)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(CX, NY, NW, NW * 0.28, 0, 0, TAU)
  ctx.fillStyle = 'rgba(3, 8, 5, 0.92)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(200, 255, 232, 0.5)'
  ctx.lineWidth = 2.2
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(CX, NY + 3, NW * 0.8, NW * 0.19, 0, 0, TAU)
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawWinner(t) {
  const b = winnerBody
  if (!b) return

  // Halo doré
  const spot = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, 54)
  spot.addColorStop(0, 'rgba(250,204,21,0.34)')
  spot.addColorStop(1, 'rgba(250,204,21,0)')
  ctx.fillStyle = spot
  ctx.beginPath()
  ctx.arc(b.x, b.y, 56, 0, TAU)
  ctx.fill()

  drawBallBody(b)

  if (mode === 'hover') {
    const p = (Math.sin(t / 300) + 1) / 2
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r + 8 + p * 6, 0, TAU)
    ctx.strokeStyle = `rgba(250,204,21,${0.7 - p * 0.55})`
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
}

function draw(t) {
  ctx.clearRect(0, 0, W, H)

  ctx.save()

  // Légère secousse du bocal pendant le mélange
  if (mode === 'mix' && !reduced) {
    ctx.translate(CX, CY)
    ctx.rotate(Math.sin(t / 130) * 0.022)
    ctx.translate(-CX, -CY)
  }

  drawGroundShadow()
  drawGlassBack()

  // Les boules restent à l'intérieur de la sphère.
  ctx.save()
  circlePath()
  ctx.clip()
  if (mode === 'mix') for (const b of bodies) if (!b.emerging) drawStreak(b)
  for (const b of bodies) {
    if (b.emerging) continue
    drawBallBody(b)
  }
  for (const b of bodies) {
    if (b.emerging) continue
    drawSelectionRing(b)
  }
  ctx.restore()

  drawGlassFront()

  ctx.restore()

  // La gagnante sort du bocal : dessinée au-dessus du verre.
  if ((mode === 'emerge' || mode === 'hover') && winnerBody) drawWinner(t)
}

function loop(t) {
  step(t)
  draw(t)
  flushImpacts()
  raf = requestAnimationFrame(loop)
}

/* ================= Interaction ================= */
function onClick(e) {
  unlock() // un clic vaut geste utilisateur : on débloque l'audio
  if (props.disabled || props.phase !== 'betting') return

  const rect = canvas.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (W / rect.width)
  const y = (e.clientY - rect.top) * (H / rect.height)

  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i]
    if (b.emerging) continue
    if (Math.hypot(b.x - x, b.y - y) <= b.r + 5) {
      emit('toggle', b.id)
      return
    }
  }
}

function unlockOnce() {
  // On retire les écouteurs seulement quand l'audio tourne réellement :
  // un premier geste peut être « consommé » avant le montage du composant.
  if (!unlock()) return
  window.removeEventListener('pointerdown', unlockOnce)
  window.removeEventListener('keydown', unlockOnce)
}

/* ================= Vie du composant ================= */
watch(
  () => props.balls.length,
  (len) => {
    if (len && bodies.length !== len) initBodies()
  }
)

watch(
  () => props.phase,
  (p) => {
    if (p === 'mixing') {
      if (mode === 'hover' || mode === 'emerge') dropWinner()
      mode = 'mix'
    } else if (p === 'betting' && mode === 'mix') {
      mode = 'settle'
    }
  }
)

watch(
  () => props.emerge,
  (ball) => {
    if (ball) startEmerge(ball)
    else if (mode === 'hover' || mode === 'emerge') dropWinner()
  }
)

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  if (props.balls.length) initBodies()
  // Déblocage audio au premier geste de l'utilisateur.
  if (!props.muted) {
    window.addEventListener('pointerdown', unlockOnce)
    window.addEventListener('keydown', unlockOnce)
  }
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('pointerdown', unlockOnce)
  window.removeEventListener('keydown', unlockOnce)
  if (audio) {
    audio.close().catch(() => {})
    audio = null
  }
})

defineExpose({ unlock })
</script>

<template>
  <canvas
    ref="canvas"
    class="mx-auto block w-full max-w-[360px] select-none"
    :width="W"
    :height="H"
    :style="{
      cursor: !disabled && phase === 'betting' ? 'pointer' : 'default',
      height: 'auto',
    }"
    role="img"
    aria-label="Bocal sphérique contenant les 10 boules du tirage"
    @click="onClick"
  />
</template>
