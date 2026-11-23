import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fetchActiveSignature } from '../utils/signature'

/** Ma signature (image + état de blocage). L'image n'est renvoyée qu'à son propriétaire. */
export function useMySignature(enabled = true) {
  return useQuery({
    queryKey: ['my_signature'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_signature')
      if (error) throw error
      return data
    },
  })
}

// Les RPC renvoient { ok: false, message } pour un PIN faux / bloqué (le compteur d'essais doit être conservé)
function unwrap(data) {
  if (data && data.ok === false) {
    const err = new Error(data.message || 'Opération refusée.')
    err.code = data.code
    throw err
  }
  return data
}

export function useSaveMySignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ image = null, newPin = null, currentPin = null }) => {
      const { data, error } = await supabase.rpc('save_my_signature', {
        p_image: image,
        p_new_pin: newPin,
        p_current_pin: currentPin,
      })
      if (error) throw error
      return unwrap(data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['my_signature'] }),
  })
}

export function useResetMySignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reset_my_signature')
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['my_signature'] }),
  })
}

export function useDocumentSignature(docType, docId) {
  return useQuery({
    queryKey: ['document_signature', docType, docId],
    enabled: !!docId,
    queryFn: () => fetchActiveSignature(docType, docId),
  })
}

export function useSignDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ docType, docId, pin }) => {
      const { data, error } = await supabase.rpc('sign_document', { p_doc_type: docType, p_doc_id: docId, p_pin: pin })
      if (error) throw error
      return unwrap(data).signature
    },
    onSettled: (_data, _error, { docType, docId }) => {
      queryClient.invalidateQueries({ queryKey: ['document_signature', docType, docId] })
      queryClient.invalidateQueries({ queryKey: ['my_signature'] })
    },
  })
}

export function useRevokeDocumentSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ docType, docId }) => {
      const { error } = await supabase.rpc('revoke_document_signature', { p_doc_type: docType, p_doc_id: docId })
      if (error) throw error
    },
    onSettled: (_data, _error, { docType, docId }) =>
      queryClient.invalidateQueries({ queryKey: ['document_signature', docType, docId] }),
  })
}
