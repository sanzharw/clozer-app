import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AppLayout } from "./components/layout/AppLayout"
import Dashboard from "./pages/Dashboard"
import LiveCall from "./pages/LiveCall"
import Summary from "./pages/Summary"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/call/:id" element={<LiveCall />} />
          <Route path="/summary/:id" element={<Summary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
