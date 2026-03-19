import { Outlet } from "react-router-dom"
import { Header } from "./Header"

export function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 selection:bg-green-100 selection:text-green-900">
      <Header />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
