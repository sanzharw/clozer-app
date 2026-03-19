import { Link } from "react-router-dom"
import { Play } from "lucide-react"

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6 bg-white shrink-0">
      <Link to="/" className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
        <div className="w-6 h-6 bg-green-500 rounded-sm flex items-center justify-center">
          <Play className="w-3 h-3 text-white fill-current" />
        </div>
        Clozer.
      </Link>
    </header>
  )
}
