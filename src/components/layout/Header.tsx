import { Link } from "react-router-dom"
import { Play } from "lucide-react"
import { useLanguage } from "../../lib/LanguageContext"

export function Header() {
  const { language, setLanguage } = useLanguage()

  return (
    <header className="flex h-16 items-center justify-between border-b px-6 bg-white shrink-0">
      <Link to="/" className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
        <div className="w-6 h-6 bg-green-500 rounded-sm flex items-center justify-center">
          <Play className="w-3 h-3 text-white fill-current" />
        </div>
        Clozer.
      </Link>
      <div className="flex items-center">
        <button 
          onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
          className="flex items-center gap-2 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-full transition-colors"
        >
          {language === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
        </button>
      </div>
    </header>
  )
}
