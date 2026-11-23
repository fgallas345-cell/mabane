import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f3f6fb] dark:bg-darkbg">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-500 border-t-transparent" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/" replace />

  return children
}
