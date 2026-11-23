// Champ de code PIN à 4 chiffres (masqué, clavier numérique sur téléphone)
export default function PinInput({ id, value, onChange, autoFocus, disabled, label }) {
  return (
    <div>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        autoFocus={autoFocus}
        disabled={disabled}
        className="input text-center text-2xl tracking-[0.6em] font-semibold tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="••••"
      />
    </div>
  )
}
