import { useSupabaseTable } from './useSupabaseTable'
import { supabase } from '../lib/supabase'

const BUCKET = 'product-images'
const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 Mo
const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function useProducts() {
  return useSupabaseTable(
    'products',
    '*, categories(id, name), supplier_products(supplier_id, suppliers(id, name, phone, contact_person))',
    { orderBy: 'name', ascending: true }
  )
}

export async function uploadProductImage(file) {
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) throw new Error('Format non supporté : utilisez une image JPG, PNG ou WebP.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image trop lourde (max 2 Mo).')

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
  return data.publicUrl
}

// Extrait le nom de fichier d'une URL publique du bucket (null si l'URL vient d'ailleurs)
function storagePathFromUrl(url) {
  const marker = `/object/public/${BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

// Supprime une image du bucket ; silencieux en cas d'échec (fichier déjà absent, etc.)
export async function deleteProductImage(url) {
  const path = storagePathFromUrl(url)
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('Image produit non supprimée du bucket :', error.message)
}
