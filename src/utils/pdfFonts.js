// Chargement (une seule fois par session) des polices NotoSans pour jsPDF.
// jsPDF n'accepte que du TrueType : les fichiers doivent être des .ttf.
// En cas d'échec (hors-ligne, fichier absent), on retombe sur Helvetica.

const FONT_NAME = 'NotoSans'
const FONTS = [
  { url: '/fonts/NotoSans-Regular.ttf', fileName: 'NotoSans-Regular.ttf', style: 'normal' },
  { url: '/fonts/NotoSans-Bold.ttf', fileName: 'NotoSans-Bold.ttf', style: 'bold' },
]

// Base64 des fichiers déjà téléchargés (partagé entre tous les documents)
let fontCache = null
let fontCachePromise = null

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function looksLikeTrueType(buf) {
  const h = new Uint8Array(buf.slice(0, 4))
  const tag = String.fromCharCode(...h)
  return (h[0] === 0x00 && h[1] === 0x01 && h[2] === 0x00 && h[3] === 0x00) || tag === 'OTTO' || tag === 'true'
}

async function loadFonts() {
  const loaded = []
  for (const f of FONTS) {
    try {
      const res = await fetch(f.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      if (!looksLikeTrueType(buf)) throw new Error('pas un fichier TrueType')
      loaded.push({ ...f, base64: arrayBufferToBase64(buf) })
    } catch (err) {
      console.warn(`Police PDF ignorée (${f.url}) :`, err?.message || err)
    }
  }
  // Sans la variante "normal" on ne peut rien faire ; le gras seul serait incohérent
  return loaded.some((f) => f.style === 'normal') ? loaded : []
}

/**
 * Enregistre NotoSans dans le document jsPDF. Retourne true si la police est disponible.
 */
export async function ensureFont(doc) {
  if (!fontCachePromise) fontCachePromise = loadFonts().then((fonts) => (fontCache = fonts))
  const fonts = await fontCachePromise
  if (!fonts.length) return false
  try {
    for (const f of fonts) {
      doc.addFileToVFS(f.fileName, f.base64)
      doc.addFont(f.fileName, FONT_NAME, f.style)
    }
    return true
  } catch (e) {
    console.warn('Impossible d’enregistrer la police dans le PDF, repli sur Helvetica', e)
    return false
  }
}

/**
 * Sélectionne NotoSans si elle a été chargée, sinon Helvetica.
 */
export function setFontSafe(doc, style = 'normal') {
  if (fontCache?.length) {
    try {
      doc.setFont(FONT_NAME, fontCache.some((f) => f.style === style) ? style : 'normal')
      return
    } catch {
      // police absente de ce document : repli ci-dessous
    }
  }
  doc.setFont('helvetica', style)
}
