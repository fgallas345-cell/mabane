import { useEffect, useMemo, useState } from 'react'
import PageHeader, { PanelTitle, InfoChip } from '../../components/PageHeader'
import { PiggyBank, ArrowDownToLine, ArrowUpFromLine, ShoppingCart, Search, History, Download, MessageCircle, Undo2, FileText, CheckCircle2, Coins, Users } from 'lucide-react'
import { useClients } from '../../hooks/useEntities'
import {
  useDepositBalances,
  useClientDepositHistory,
  useDepositOperationsSince,
  useAddClientDeposit,
  useWithdrawClientDeposit,
  useReverseClientDeposit,
} from '../../hooks/useClientDeposits'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import StatCard from '../../components/StatCard'
import ActionButton from '../../components/ActionButton'
import DocumentSignatureSection from '../../components/DocumentSignatureSection'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import SearchableSelect from '../../components/SearchableSelect'
import Segmented from '../../components/Segmented'
import { DetailHeader, DetailList, DetailRow, Callout, DetailActions } from '../../components/Detail'
import { currency, PAYMENT_METHOD_LABELS, CASH_PAYMENT_METHODS } from '../../lib/constants'
import { depositEntryLabel } from '../../utils/depositPdf'
import { sendDepositReceiptViaWhatsApp, normalizePhone } from '../../utils/whatsapp'

const emptyOperation = { open: false, type: 'depot', clientId: '', amount: '', method: 'especes', notes: '' }

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '—')
const formatDateTime = (value) =>
  value
    ? `${new Date(value).toLocaleDateString('fr-FR')} ${new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : '—'

function startOfMonthIso() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function downloadReceipt(entry, client) {
  const { downloadDepositReceiptPDF } = await import('../../utils/depositPdf')
  await downloadDepositReceiptPDF(entry, client)
}

async function downloadStatement(client, entries) {
  const { downloadDepositStatementPDF } = await import('../../utils/depositPdf')
  await downloadDepositStatementPDF(client, entries)
}

function AmountCell({ amount }) {
  const n = Number(amount || 0)
  return (
    <span className={`tabular-nums font-medium ${n > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
      {n > 0 ? '+' : '−'} {currency(Math.abs(n))}
    </span>
  )
}

export default function Deposits() {
  const { isAdmin } = useAuth()
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const { data: balances = new Map(), isLoading: loadingBalances } = useDepositBalances()
  const [monthStart] = useState(startOfMonthIso)
  const { data: monthOps = [] } = useDepositOperationsSince(monthStart)
  const addDeposit = useAddClientDeposit()
  const withdraw = useWithdrawClientDeposit()
  const reverse = useReverseClientDeposit()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('holders') // holders | all
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [operation, setOperation] = useState(emptyOperation)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(null) // { entry, client }
  const [historyClient, setHistoryClient] = useState(null)
  const [reverseTarget, setReverseTarget] = useState(null)

  const { data: history = [], isLoading: loadingHistory } = useClientDepositHistory(historyClient?.id)

  const balanceOf = (clientId) => balances.get(clientId)?.balance || 0
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

  // --- Statistiques ---
  const stats = useMemo(() => {
    let held = 0
    let holders = 0
    balances.forEach((b) => {
      if (b.balance > 0) {
        held += b.balance
        holders += 1
      }
    })
    const sumOf = (type) => monthOps.filter((o) => o.type === type).reduce((s, o) => s + Math.abs(Number(o.amount || 0)), 0)
    return { held, holders, deposits: sumOf('depot'), withdrawals: sumOf('retrait'), used: sumOf('achat') }
  }, [balances, monthOps])

  // --- Liste ---
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const bal = (id) => balances.get(id)?.balance || 0
    return clients
      .filter((c) => (filter === 'holders' ? bal(c.id) > 0 : true))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q))
      .sort((a, b) => bal(b.id) - bal(a.id) || a.name.localeCompare(b.name))
  }, [clients, balances, search, filter])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const paginated = rows.slice((page - 1) * pageSize, page * pageSize)

  const clientOptions = useMemo(() => {
    const bal = (id) => balances.get(id)?.balance || 0
    return clients.map((c) => ({
        value: c.id,
        label: c.name,
        searchText: `${c.name} ${c.phone || ''}`,
        content: (
          <span className="flex items-center justify-between gap-3">
            <span className="truncate font-medium">{c.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-gray-400">
              {bal(c.id) > 0 ? `dépôt : ${currency(bal(c.id))}` : c.phone || ''}
            </span>
          </span>
        ),
      }))
  }, [clients, balances])

  // --- Opération (dépôt / retrait) ---
  const openOperation = (type, clientId = '') => {
    setFormError('')
    setOperation({ ...emptyOperation, open: true, type, clientId })
  }
  const closeOperation = () => setOperation(emptyOperation)

  const isWithdrawal = operation.type === 'retrait'
  const currentBalance = operation.clientId ? balanceOf(operation.clientId) : 0
  const amountValue = Number(operation.amount || 0)
  const newBalance = currentBalance + (isWithdrawal ? -amountValue : amountValue)
  const pending = addDeposit.isPending || withdraw.isPending

  const handleOperation = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!operation.clientId) return setFormError('Choisissez le client.')
    if (!(amountValue > 0)) return setFormError('Entrez un montant supérieur à zéro.')
    if (isWithdrawal && amountValue > currentBalance) {
      return setFormError(`Le client n'a que ${currency(currentBalance)} en dépôt.`)
    }
    try {
      const mutation = isWithdrawal ? withdraw : addDeposit
      const entry = await mutation.mutateAsync({
        clientId: operation.clientId,
        amount: amountValue,
        method: operation.method,
        notes: operation.notes,
      })
      setDone({ entry, client: clientById.get(operation.clientId) || {} })
      closeOperation()
    } catch (err) {
      setFormError(err.message)
    }
  }

  const handleReverse = async () => {
    try {
      await reverse.mutateAsync({ entryId: reverseTarget.id, reason: 'Erreur de saisie' })
    } catch {
      return // toast déjà affiché par le hook
    }
    setReverseTarget(null)
  }

  const isLoading = loadingClients || loadingBalances
  const historyBalance = historyClient ? balanceOf(historyClient.id) : 0

  return (
    <div className="space-y-6">
      <PageHeader icon={PiggyBank} badge={Coins} title="Dépôts clients" subtitle="Argent confié par les clients : dépôts, retraits et achats payés avec leur dépôt">
        <button className="btn-soft" onClick={() => openOperation('retrait')}>
          <ArrowUpFromLine size={17} /> Retrait
        </button>
        <button className="btn-cta" onClick={() => openOperation('depot')}>
          <ArrowDownToLine size={18} strokeWidth={2.5} /> Nouveau dépôt
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          featured
          icon={PiggyBank}
          label="Argent des clients détenu"
          value={currency(stats.held)}
          sub={`${stats.holders} client${stats.holders > 1 ? 's' : ''} avec un dépôt`}
        />
        <StatCard icon={ArrowDownToLine} color="emerald" label="Dépôts du mois" value={currency(stats.deposits)} />
        <StatCard icon={ArrowUpFromLine} color="red" label="Retraits du mois" value={currency(stats.withdrawals)} />
        <StatCard icon={ShoppingCart} color="amber" label="Utilisé en achats (mois)" value={currency(stats.used)} />
      </div>

      <Callout tone="amber" title="Cet argent appartient aux clients">
        Il n'est pas un revenu de la boutique : il devient une vente seulement quand le client achète avec. Pour payer une facture avec le dépôt, choisissez le mode « Dépôt client » lors du paiement.
      </Callout>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="search-icon" />
          <input
            className="search-field"
            placeholder="Rechercher un client par nom ou téléphone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Segmented
          label="Clients affichés"
          className="sm:w-72"
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          options={[
            { value: 'holders', label: 'Avec un dépôt' },
            { value: 'all', label: 'Tous les clients' },
          ]}
        />
      </div>

      <section className="panel overflow-hidden">
        <PanelTitle icon={Users} title="Comptes de dépôt des clients">
          {!isLoading && <InfoChip>{rows.length} client{rows.length > 1 ? 's' : ''}</InfoChip>}
        </PanelTitle>
      {isLoading ? (
        <div className="p-4 space-y-3 border-t border-gray-100 dark:border-white/[0.06]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 border-t border-gray-100 dark:border-white/[0.06] flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
            <PiggyBank size={20} />
          </div>
          <div>
            <p className="font-medium">{search ? 'Aucun client ne correspond' : 'Aucun client n’a d’argent en dépôt'}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {search ? 'Essayez un autre nom ou numéro.' : 'Enregistrez le premier dépôt d’un client.'}
            </p>
          </div>
          {!search && (
            <button className="btn-cta mt-1" onClick={() => openOperation('depot')}>
              <ArrowDownToLine size={16} /> Nouveau dépôt
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Tableau (desktop / tablette) */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.03]">
                    <th className="table-th">Client</th>
                    <th className="table-th">Téléphone</th>
                    <th className="table-th">Dernière opération</th>
                    <th className="table-th text-right">Solde du dépôt</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {paginated.map((c) => {
                    const b = balances.get(c.id)
                    const balance = b?.balance || 0
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="table-td">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-gray-400">{b ? `${b.operations} opération${b.operations > 1 ? 's' : ''}` : 'Aucune opération'}</p>
                        </td>
                        <td className="table-td text-sm text-gray-500 dark:text-gray-400 tabular-nums">{c.phone || '—'}</td>
                        <td className="table-td text-sm text-gray-500 dark:text-gray-400">{formatDate(b?.lastOperationAt)}</td>
                        <td className="table-td text-right">
                          <span className={`tabular-nums font-semibold ${balance > 0 ? 'text-[#1d4fb8] dark:text-blue-300' : 'text-gray-400'}`}>
                            {currency(balance)}
                          </span>
                        </td>
                        <td className="table-td">
                          <div className="flex justify-end gap-0.5">
                            <ActionButton icon={ArrowDownToLine} title="Déposer" tone="emerald" onClick={() => openOperation('depot', c.id)} />
                            <ActionButton icon={ArrowUpFromLine} title="Retirer" tone="red" disabled={balance <= 0} onClick={() => openOperation('retrait', c.id)} />
                            <ActionButton icon={History} title="Historique" disabled={!b} onClick={() => setHistoryClient(c)} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cartes (mobile) */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-white/[0.06] border-t border-gray-100 dark:border-white/[0.06]">
            {paginated.map((c) => {
              const b = balances.get(c.id)
              const balance = b?.balance || 0
              return (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-brand-900 dark:text-gray-100 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone || 'Sans téléphone'} · {formatDate(b?.lastOperationAt)}</p>
                    </div>
                    <p className={`tabular-nums font-semibold shrink-0 ${balance > 0 ? 'text-[#1d4fb8] dark:text-blue-300' : 'text-gray-400'}`}>{currency(balance)}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button className="btn-secondary text-xs px-2" onClick={() => openOperation('depot', c.id)}>
                      <ArrowDownToLine size={14} /> Déposer
                    </button>
                    <button className="btn-secondary text-xs px-2" disabled={balance <= 0} onClick={() => openOperation('retrait', c.id)}>
                      <ArrowUpFromLine size={14} /> Retirer
                    </button>
                    <button className="btn-secondary text-xs px-2" disabled={!b} onClick={() => setHistoryClient(c)}>
                      <History size={14} /> Historique
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} pageSize={pageSize} itemLabel="clients" />
        </>
      )}
      </section>

      {/* ---- Dépôt / retrait ---- */}
      <Modal open={operation.open} onClose={closeOperation} icon={PiggyBank} title={isWithdrawal ? 'Retrait d’argent' : 'Nouveau dépôt'}>
        <form onSubmit={handleOperation} className="space-y-4">
          <Segmented
            label="Type d'opération"
            value={operation.type}
            onChange={(type) => {
              setFormError('')
              setOperation((o) => ({ ...o, type }))
            }}
            options={[
              { value: 'depot', label: 'Dépôt' },
              { value: 'retrait', label: 'Retrait' },
            ]}
          />

          <div>
            <label className="label">Client</label>
            <SearchableSelect
              value={operation.clientId}
              onChange={(clientId) => setOperation((o) => ({ ...o, clientId }))}
              options={clientOptions}
              placeholder="Tapez le nom ou le téléphone..."
              emptyMessage="Aucun client trouvé (créez-le d’abord dans Clients)"
              autoFocus={!operation.clientId}
            />
            {operation.clientId && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Dépôt actuel : <strong className="tabular-nums">{currency(currentBalance)}</strong>
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="deposit-amount">{isWithdrawal ? 'Montant retiré' : 'Montant déposé'}</label>
            <input
              id="deposit-amount"
              type="number"
              inputMode="numeric"
              min="1"
              max={isWithdrawal ? currentBalance || undefined : undefined}
              className="input"
              placeholder="0"
              value={operation.amount}
              onChange={(e) => setOperation((o) => ({ ...o, amount: e.target.value }))}
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(isWithdrawal ? [5000, 10000, 25000] : [10000, 25000, 50000, 100000]).map((v) => (
                <button key={v} type="button" className="badge bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]" onClick={() => setOperation((o) => ({ ...o, amount: String(v) }))}>
                  {currency(v)}
                </button>
              ))}
              {isWithdrawal && currentBalance > 0 && (
                <button type="button" className="badge bg-blue-50 text-[#1d4fb8] hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300" onClick={() => setOperation((o) => ({ ...o, amount: String(currentBalance) }))}>
                  Tout ({currency(currentBalance)})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="deposit-method">{isWithdrawal ? 'Remis en' : 'Reçu en'}</label>
              <select id="deposit-method" className="input" value={operation.method} onChange={(e) => setOperation((o) => ({ ...o, method: e.target.value }))}>
                {CASH_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="deposit-notes">Note <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <input id="deposit-notes" className="input" value={operation.notes} onChange={(e) => setOperation((o) => ({ ...o, notes: e.target.value }))} placeholder={isWithdrawal ? 'Récupéré par...' : 'Pour le chantier...'} />
            </div>
          </div>

          {operation.clientId && amountValue > 0 && (
            <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-3 text-sm flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Solde après l’opération</span>
              <span className={`tabular-nums font-semibold ${newBalance < 0 ? 'text-red-500' : ''}`}>
                {currency(currentBalance)} → {currency(newBalance)}
              </span>
            </div>
          )}

          {formError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

          <DetailActions>
            <button type="button" className="btn-secondary" onClick={closeOperation}>Annuler</button>
            <button type="submit" className={isWithdrawal ? 'btn-danger' : 'btn-primary'} disabled={pending || !operation.clientId}>
              {pending ? 'Enregistrement...' : isWithdrawal ? 'Enregistrer le retrait' : 'Enregistrer le dépôt'}
            </button>
          </DetailActions>
        </form>
      </Modal>

      {/* ---- Opération enregistrée ---- */}
      <Modal open={!!done} onClose={() => setDone(null)} icon={CheckCircle2} title="Opération enregistrée" maxWidth="max-w-sm">
        {done && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-2">
              <CheckCircle2 size={36} className="text-emerald-500" />
              <p className="font-medium">
                {done.entry.type === 'retrait' ? 'Retrait' : 'Dépôt'} de {currency(Math.abs(Number(done.entry.amount)))}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {done.client.name} · N° {done.entry.number}
              </p>
            </div>
            <DetailList>
              <DetailRow label="Nouveau solde du dépôt" strong>{currency(done.entry.balance_after)}</DetailRow>
            </DetailList>
            <DocumentSignatureSection docType="deposit_receipt" docId={done.entry.id} amount={done.entry.amount} isAdmin={isAdmin} />
            <DetailActions>
              <button className="btn-secondary" onClick={() => setDone(null)}>Fermer</button>
              <button className="btn-secondary" disabled={!normalizePhone(done.client.phone)} onClick={() => sendDepositReceiptViaWhatsApp(done.entry, done.client)}>
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button className="btn-primary" onClick={() => downloadReceipt(done.entry, done.client)}>
                <Download size={15} /> Reçu PDF
              </button>
            </DetailActions>
          </div>
        )}
      </Modal>

      {/* ---- Historique d'un client (le « carnet ») ---- */}
      <Modal open={!!historyClient} onClose={() => setHistoryClient(null)} icon={History} title="Historique du dépôt" maxWidth="max-w-2xl">
        {historyClient && (
          <div className="space-y-4">
            <DetailHeader
              avatar={
                <div className="h-10 w-10 rounded-full bg-blue-50 text-[#1d4fb8] dark:bg-blue-500/10 dark:text-blue-300 flex items-center justify-center">
                  <PiggyBank size={18} />
                </div>
              }
              title={historyClient.name}
              subtitle={historyClient.phone || 'Sans téléphone'}
            >
              <span className="text-lg font-semibold tabular-nums text-[#1d4fb8] dark:text-blue-300">{currency(historyBalance)}</span>
            </DetailHeader>

            {loadingHistory ? (
              <div className="h-24 rounded bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
            ) : (
              <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-white/[0.06]">
                      <tr className="border-b border-gray-200 dark:border-white/[0.08]">
                        <th className="table-th">Date</th>
                        <th className="table-th">Opération</th>
                        <th className="table-th text-right">Montant</th>
                        <th className="table-th text-right">Reste</th>
                        <th className="table-th text-right"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                      {[...history].reverse().map((entry) => (
                        <tr key={entry.id} className={entry.reversed_at ? 'opacity-50' : ''}>
                          <td className="table-td whitespace-nowrap text-gray-500 dark:text-gray-400">{formatDateTime(entry.created_at)}</td>
                          <td className="table-td">
                            <p className={`font-medium ${entry.reversed_at ? 'line-through' : ''}`}>{depositEntryLabel(entry)}</p>
                            <p className="text-xs text-gray-400">
                              {entry.number}
                              {entry.method && entry.method !== 'depot' ? ` · ${PAYMENT_METHOD_LABELS[entry.method] || entry.method}` : ''}
                              {entry.notes ? ` · ${entry.notes}` : ''}
                              {entry.reversed_at ? ' · annulée' : ''}
                            </p>
                          </td>
                          <td className="table-td text-right whitespace-nowrap"><AmountCell amount={entry.amount} /></td>
                          <td className="table-td text-right whitespace-nowrap tabular-nums font-semibold">{currency(entry.balance_after)}</td>
                          <td className="table-td">
                            <div className="flex justify-end items-center gap-0.5">
                              {['depot', 'retrait'].includes(entry.type) && (
                                <DocumentSignatureSection
                                  compact
                                  docType="deposit_receipt"
                                  docId={entry.id}
                                  amount={entry.amount}
                                  isAdmin={isAdmin}
                                  cancelled={!!entry.reversed_at}
                                />
                              )}
                              {['depot', 'retrait'].includes(entry.type) && (
                                <ActionButton icon={Download} title="Reçu PDF" onClick={() => downloadReceipt(entry, historyClient)} />
                              )}
                              {isAdmin && ['depot', 'retrait'].includes(entry.type) && !entry.reversed_at && (
                                <ActionButton icon={Undo2} title="Annuler (erreur de saisie)" tone="red" onClick={() => setReverseTarget(entry)} />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!loadingHistory && history.length > 0 && (
              <DocumentSignatureSection
                docType="deposit_statement"
                docId={historyClient.id}
                amount={Number(history[history.length - 1].balance_after || 0)}
                isAdmin={isAdmin}
              />
            )}

            <DetailActions>
              <button className="btn-secondary" disabled={!history.length} onClick={() => downloadStatement(historyClient, history)}>
                <FileText size={15} /> Relevé PDF
              </button>
              <button className="btn-secondary" disabled={historyBalance <= 0} onClick={() => { const c = historyClient; setHistoryClient(null); openOperation('retrait', c.id) }}>
                <ArrowUpFromLine size={15} /> Retrait
              </button>
              <button className="btn-primary" onClick={() => { const c = historyClient; setHistoryClient(null); openOperation('depot', c.id) }}>
                <ArrowDownToLine size={15} /> Dépôt
              </button>
            </DetailActions>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        onConfirm={handleReverse}
        loading={reverse.isPending}
        title="Annuler l’opération"
        confirmLabel="Annuler l’opération"
        loadingLabel="Annulation..."
        cancelLabel="Retour"
        message={
          reverseTarget
            ? `Annuler ${reverseTarget.type === 'depot' ? 'le dépôt' : 'le retrait'} ${reverseTarget.number} de ${currency(Math.abs(Number(reverseTarget.amount)))} ? Une ligne de correction sera ajoutée : rien n’est effacé de l’historique.`
            : ''
        }
      />
    </div>
  )
}
