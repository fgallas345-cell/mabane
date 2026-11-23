import { useEffect, useState } from 'react'
import PageHeader, { PanelTitle, InfoChip } from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import { Eye, Search, User, UserPlus, Trash2, ShieldCheck, Users, Wallet, UserCog, KeyRound } from 'lucide-react'
import { useSupabaseTable } from '../../hooks/useSupabaseTable'
import { useCreateUser, useDeleteUser } from '../../hooks/useUsersAdmin'
import { ROLE_LABELS } from '../../lib/constants'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import { DetailHeader, DetailList, DetailRow } from '../../components/Detail'
import ConfirmDialog from '../../components/ConfirmDialog'

const emptyForm = { fullName: '', email: '', password: '', role: 'employe' }

export default function UsersAdmin() {
  const { data: users = [], isLoading, updateItem } = useSupabaseTable('users', '*', { orderBy: 'full_name', ascending: true })
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const createUser = useCreateUser()
  const deleteUser = useDeleteUser()
  const [savingId, setSavingId] = useState(null)
  const [detailUser, setDetailUser] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const adminCount = users.filter((u) => u.role === 'admin').length

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  const handleRoleChange = async (u, role) => {
    if (u.id === currentUser?.id && role !== 'admin') {
      toast.error('Vous ne pouvez pas retirer votre propre rôle administrateur.')
      return
    }
    if (u.role === 'admin' && role !== 'admin' && adminCount <= 1) {
      toast.error('Il doit rester au moins un administrateur.')
      return
    }
    setSavingId(u.id)
    try {
      await updateItem.mutateAsync({ id: u.id, role })
    } catch {
      // toast déjà affiché par le hook
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createUser.mutateAsync(form)
      setCreateOpen(false)
      setForm(emptyForm)
    } catch {
      // toast déjà affiché par le hook ; on garde le formulaire ouvert
    }
  }

  const handleDelete = async () => {
    try {
      await deleteUser.mutateAsync(confirmDelete.id)
      if (detailUser?.id === confirmDelete.id) setDetailUser(null)
      setConfirmDelete(null)
    } catch {
      // toast déjà affiché par le hook
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} badge={KeyRound} title="Utilisateurs" subtitle="Gérez les comptes et les rôles de l'équipe (admin, caissier, employé)">
        <button className="btn-cta" onClick={() => { setForm(emptyForm); setCreateOpen(true) }}>
          <UserPlus size={18} strokeWidth={2.5} /> Nouveau compte
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard featured icon={Users} label="Comptes" value={users.length} sub="membres de l'équipe" />
        <StatCard icon={ShieldCheck} color="brand" label="Administrateurs" value={adminCount} sub="accès complet" />
        <StatCard icon={Wallet} color="accent" label="Caissiers" value={users.filter((u) => u.role === 'caissier').length} sub="ventes et encaissements" />
        <StatCard icon={UserCog} color="emerald" label="Employés" value={users.filter((u) => u.role === 'employe').length} sub="opérations courantes" />
      </div>

      <div className="relative">
        <Search size={18} className="search-icon" />
        <input
          className="search-field"
          placeholder="Rechercher un utilisateur ou email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <section className="panel overflow-hidden">
        <PanelTitle icon={Users} title="Comptes de l'équipe">
          {!isLoading && <InfoChip>{filteredUsers.length === users.length ? `${users.length} compte${users.length > 1 ? 's' : ''}` : `${filteredUsers.length} sur ${users.length}`}</InfoChip>}
        </PanelTitle>
        <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Nom</th>
                <th className="table-th">Email</th>
                <th className="table-th">Rôle</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
              {paginatedUsers.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white flex items-center justify-center text-sm font-bold">
                          {(u.full_name || u.email || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="font-bold text-brand-900 dark:text-gray-100">{u.full_name}</span>
                        {isSelf && <span className="badge bg-blue-100 text-[#1d4fb8] dark:bg-blue-500/20 dark:text-blue-300">Vous</span>}
                      </div>
                    </td>
                    <td className="table-td">{u.email}</td>
                    <td className="table-td">
                      <select
                        className="filter-select !py-2 !w-44"
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          title="Voir le détail"
                          onClick={() => setDetailUser(u)}
                          className="h-9 w-9 rounded-xl flex items-center justify-center bg-gray-100 text-brand-900 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.1] transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            title="Supprimer le compte"
                            onClick={() => setConfirmDelete(u)}
                            className="h-9 w-9 rounded-xl flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredUsers.length} pageSize={pageSize} itemLabel="comptes" />
      </section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} icon={UserPlus} title="Nouveau compte">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Nom complet</label>
            <input required className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Prénom Nom" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nom@exemple.com" />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input type="password" required minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 caractères" />
          </div>
          <div>
            <label className="label">Rôle</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400">
            Le compte est actif immédiatement (email confirmé). Communiquez le mot de passe à la personne concernée.
          </p>
          <div className="flex justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={createUser.isPending}>
              {createUser.isPending ? 'Création...' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleteUser.isPending}
        message={`Supprimer le compte de "${confirmDelete?.full_name}" ? La personne ne pourra plus se connecter. Ses ventes et mouvements restent dans l'historique.`}
      />

      <Modal open={!!detailUser} onClose={() => setDetailUser(null)} icon={User} title="Détail utilisateur">
        {detailUser && (
          <div className="space-y-4">
            <DetailHeader
              avatar={
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400 shrink-0">
                  <User size={18} />
                </div>
              }
              title={detailUser.full_name}
              subtitle={detailUser.email}
            />
            <DetailList>
              <DetailRow label="Rôle">{ROLE_LABELS[detailUser.role] || detailUser.role}</DetailRow>
              <DetailRow label="Téléphone">{detailUser.phone || '—'}</DetailRow>
            </DetailList>
          </div>
        )}
      </Modal>
    </div>
  )
}
