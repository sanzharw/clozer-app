import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  if (session) {
    return <Navigate to="/" replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('Пожалуйста, подтвердите ваш Email через ссылку в письме, или отключите "Confirm email" в настройках Supabase.')
      } else {
        setError(`Ошибка: ${error.message}`)
      }
      setIsLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Tyndap.</h1>
          <p className="text-zinc-500">Войдите в свой аккаунт</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 text-sm p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#00C853] hover:bg-[#00E676] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

      </div>
    </div>
  )
}
