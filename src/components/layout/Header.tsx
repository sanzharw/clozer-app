import { Link, useNavigate } from "react-router-dom"
import { Play, Settings, LogOut, ChevronDown } from "lucide-react"
import { useLanguage } from "../../lib/LanguageContext"
import { useAuth } from "../../lib/AuthContext"
import { useState, useRef, useEffect } from "react"

export function Header() {
  const { language, setLanguage } = useLanguage()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const rawName = user?.user_metadata?.full_name || user?.email || "U"
  const initials = rawName.substring(0, 2).toUpperCase()

  return (
    <header className="flex h-16 items-center justify-between border-b px-6 bg-white shrink-0 relative z-50">
      <Link to="/" className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
        <div className="w-6 h-6 bg-green-500 rounded-sm flex items-center justify-center">
          <Play className="w-3 h-3 text-white fill-current" />
        </div>
        Tyndap.
      </Link>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
          className="flex items-center gap-2 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-full transition-colors"
        >
          {language === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
        </button>

        {user && (
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 bg-zinc-900 text-white rounded-full flex items-center justify-center text-sm font-semibold tracking-wider">
                {initials}
              </div>
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-zinc-200 py-1 overflow-hidden">
                <Link 
                  to="/settings" 
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors w-full text-left"
                >
                  <Settings className="w-4 h-4 text-zinc-400" />
                  {language === 'ru' ? 'Настройки' : 'Settings'}
                </Link>
                <div className="h-px bg-zinc-100 my-1" />
                <button 
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  {language === 'ru' ? 'Выйти' : 'Sign Out'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
