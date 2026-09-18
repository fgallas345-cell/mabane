import { useEffect, useState } from 'react'
import { Eye, Search, User, UserPlus, Trash2 } from 'lucide-react'
import { useSupabaseTable } from '../../hooks/useSupabaseTable'
import { useCreateUser, useDeleteUser } from '../../hooks/useUsersAdmin'
import { ROLE_LABELS } from '../../lib/constants'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Gérez les comptes et les rôles de l'équipe (admin, caissier, employé)</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setCreateOpen(true) }}>
          <UserPlus size={16} /> Nouveau compte
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Rechercher un utilisateur ou email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 dark:border-gray-700/60">
              <tr>
                <th className="table-th">Nom</th>
                <th className="table-th">Email</th>
                <th className="table-th">Rôle</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedUsers.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="table-td font-medium flex items-center gap-2">
                      {u.full_name}
                      {isSelf && <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">Vous</span>}
                    </td>
                    <td className="table-td">{u.email}</td>
                    <td className="table-td">
                      <select
                        className="input !py-1.5 !w-40"
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
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Voir le détail"
                          onClick={() => setDetailUser(u)}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            title="Supprimer le compte"
                            onClick={() => setConfirmDelete(u)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau compte">
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
            <input type="password" required minLength={6} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 caractères" />
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
          <div className="flex justify-end gap-2 pt-2">
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

      <Modal open={!!detailUser} onClose={() => setDetailUser(null)} title="Détail utilisateur">
        {detailUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                <User size={18} />
              </div>
              <div>
                <p className="font-semibold">{detailUser.full_name}</p>
                <p className="text-xs text-gray-400">{detailUser.email}</p>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              <div className="flex justify-between p-3 text-sm">
                <span className="text-gray-500">Rôle</span>
                <span className="font-medium">{ROLE_LABELS[detailUser.role] || detailUser.role}</span>
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span className="text-gray-500">Téléphone</span>
                <span>{detailUser.phone || '—'}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
