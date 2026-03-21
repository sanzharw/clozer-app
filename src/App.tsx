import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AppLayout } from "./components/layout/AppLayout"
import Dashboard from "./pages/Dashboard"
import LiveCall from "./pages/LiveCall"
import Summary from "./pages/Summary"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { Onboarding } from "./pages/Onboarding"
import { ProtectedRoute } from "./components/layout/ProtectedRoute"
import { AuthProvider } from "./lib/AuthContext"
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/call/:id" element={<LiveCall />} />
            <Route path="/summary/:id" element={<Summary />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
