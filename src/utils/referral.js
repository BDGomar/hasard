/**
 * Parrainage : mémorise le code présent dans l'URL (?ref=CODE) pour le
 * transmettre à l'inscription, même si le visiteur navigue avant de s'inscrire.
 */
const STORAGE_KEY = 'referral_code'

/** Format accepté pour un code de parrainage (8 caractères en général). */
const CODE_PATTERN = /^[A-Za-z0-9]{4,12}$/

/**
 * À appeler au démarrage de l'application : lit ?ref=CODE dans l'URL et le
 * conserve jusqu'à l'inscription.
 */
export function captureReferralCode() {
  const code = new URLSearchParams(window.location.search).get('ref')?.trim()

  if (code && CODE_PATTERN.test(code)) {
    localStorage.setItem(STORAGE_KEY, code.toUpperCase())
  }
}

/** Code de parrainage en attente, ou chaîne vide. */
export function getReferralCode() {
  return localStorage.getItem(STORAGE_KEY) || ''
}

/** À appeler une fois l'inscription réussie : le code a rempli son rôle. */
export function clearReferralCode() {
  localStorage.removeItem(STORAGE_KEY)
}
