import { useState } from 'react'
import { PenLine, Upload, KeyRound, RotateCcw, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PinInput from '../../components/PinInput'
import { useMySignature, useSaveMySignature, useResetMySignature } from '../../hooks/useSignatures'
import { pinError, prepareSignatureImage } from '../../utils/signature'

function SignaturePreview({ src }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white p-3 flex justify-center">
      <img src={src} alt="Signature" className="h-20 object-contain" />
    </div>
  )
}

function ImagePicker({ onPicked, label = 'Choisir une image' }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setBusy(true)
    try {
      onPicked(await prepareSignatureImage(file))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-1">
      <label className="btn-secondary cursor-pointer w-full justify-center">
        <Upload size={15} /> {busy ? 'Traitement…' : label}
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={busy} />
      </label>
      <p className="text-xs text-gray-400">Photo de la signature sur papier blanc, ou PNG détouré. Le fond est retiré automatiquement.</p>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

/** Première configuration : image + PIN */
function SetupForm() {
  const toast = useToast()
  const save = useSaveMySignature()
  const [image, setImage] = useState(null)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!image) return setError('Ajoutez d’abord l’image de votre signature.')
    const pinErr = pinError(pin)
    if (pinErr) return setError(pinErr)
    if (pin !== confirm) return setError('Les deux codes PIN ne sont pas identiques.')
    setError('')
    try {
      await save.mutateAsync({ image, newPin: pin })
      toast.success('Signature enregistrée.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {image && <SignaturePreview src={image} />}
      <ImagePicker onPicked={setImage} label={image ? 'Changer d’image' : 'Importer ma signature'} />
      <div className="grid grid-cols-2 gap-3">
        <PinInput id="setup-pin" label="Code PIN (4 chiffres)" value={pin} onChange={setPin} />
        <PinInput id="setup-pin-confirm" label="Confirmer le PIN" value={confirm} onChange={setConfirm} />
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer ma signature'}
        </button>
      </div>
    </form>
  )
}

/** Changer le PIN ou l'image : le PIN actuel est toujours exigé */
function ChangeForm({ mode, onDone }) {
  const toast = useToast()
  const save = useSaveMySignature()
  const [image, setImage] = useState(null)
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (current.length !== 4) return setError('Saisissez votre code PIN actuel.')
    if (mode === 'pin') {
      const pinErr = pinError(pin)
      if (pinErr) return setError(pinErr)
      if (pin !== confirm) return setError('Les deux nouveaux codes ne sont pas identiques.')
    } else if (!image) {
      return setError('Choisissez la nouvelle image.')
    }
    setError('')
    try {
      await save.mutateAsync(mode === 'pin' ? { newPin: pin, currentPin: current } : { image, currentPin: current })
      toast.success(mode === 'pin' ? 'Code PIN modifié.' : 'Image de signature remplacée.')
      onDone()
    } catch (err) {
      setCurrent('')
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-100 dark:border-white/[0.06] pt-4">
      {mode === 'image' && (
        <>
          {image && <SignaturePreview src={image} />}
          <ImagePicker onPicked={setImage} label="Choisir la nouvelle image" />
        </>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PinInput id="current-pin" label="PIN actuel" value={current} onChange={setCurrent} autoFocus />
        {mode === 'pin' && (
          <>
            <PinInput id="new-pin" label="Nouveau PIN" value={pin} onChange={setPin} />
            <PinInput id="new-pin-confirm" label="Confirmer" value={confirm} onChange={setConfirm} />
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : 'Valider'}
        </button>
      </div>
    </form>
  )
}

/** PIN oublié : on redemande le mot de passe du compte avant de tout réinitialiser */
function ResetForm({ onDone }) {
  const { user } = useAuth()
  const toast = useToast()
  const reset = useResetMySignature()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setChecking(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password })
    setChecking(false)
    if (authError) return setError('Mot de passe incorrect.')
    try {
      await reset.mutateAsync()
      toast.success('Signature réinitialisée : importez-la à nouveau et choisissez un nouveau PIN.')
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 dark:border-white/[0.06] pt-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Pour des raisons de sécurité, la signature enregistrée sera supprimée. Vous devrez la ré-importer et choisir un nouveau PIN.
        Les documents déjà signés ne sont pas modifiés.
      </p>
      <div>
        <label className="label" htmlFor="reset-password">Mot de passe de votre compte</label>
        <input id="reset-password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone}>Annuler</button>
        <button type="submit" className="btn-danger" disabled={checking || reset.isPending}>Réinitialiser</button>
      </div>
    </form>
  )
}

export default function SignatureCard() {
  const { data: mine, isLoading, error } = useMySignature()
  const [mode, setMode] = useState(null) // 'pin' | 'image' | 'reset'

  return (
    <div className="panel p-5 space-y-4">
      <div>
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50"><span className="h-8 w-8 rounded-full bg-[#1d4fb8] text-white flex items-center justify-center"><PenLine size={16} /></span> Ma signature électronique</h3>
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <ShieldCheck size={13} /> Apposée sur les factures uniquement après saisie de votre code PIN. 5 erreurs = blocage 15 min.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Signature indisponible : la mise à jour de la base (supabase/signatures.sql) n'a peut-être pas encore été appliquée.
        </p>
      ) : !mine?.configured ? (
        <SetupForm />
      ) : (
        <>
          <SignaturePreview src={mine.image} />
          {mine.locked_until && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Signature bloquée jusqu'à {new Date(mine.locked_until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} après plusieurs PIN incorrects.
            </p>
          )}
          {!mode && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => setMode('pin')}><KeyRound size={15} /> Changer le PIN</button>
              <button className="btn-secondary" onClick={() => setMode('image')}><Upload size={15} /> Remplacer l'image</button>
              <button className="btn-ghost text-sm" onClick={() => setMode('reset')}><RotateCcw size={15} /> PIN oublié ?</button>
            </div>
          )}
          {(mode === 'pin' || mode === 'image') && <ChangeForm key={mode} mode={mode} onDone={() => setMode(null)} />}
          {mode === 'reset' && <ResetForm onDone={() => setMode(null)} />}
        </>
      )}
    </div>
  )
}
