import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Загрузка...</div>
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
