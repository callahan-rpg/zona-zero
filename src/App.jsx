import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Location from './pages/Location.jsx'
import Character from './pages/Character.jsx'
import Characters from './pages/Characters.jsx'
import Admin from './pages/Admin.jsx'
import Map from './pages/Map.jsx'
import PublicCharacter from './pages/PublicCharacter.jsx'
import Combat from './pages/Combat.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="loading-dot" /></div>
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="loading-dot" /></div>
  return !user ? children : <Navigate to="/location/sala-hospital" replace />
}

function AdminRoute({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="loading-dot" /></div>
  if (!user) return <Navigate to="/login" replace />
  return role === 'admin' ? children : <Navigate to="/location/sala-hospital" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Rotas protegidas */}
        <Route path="/location/:slug" element={<ProtectedRoute><Location /></ProtectedRoute>} />
        <Route path="/character" element={<ProtectedRoute><Character /></ProtectedRoute>} />
        <Route path="/characters" element={<ProtectedRoute><Characters /></ProtectedRoute>} />
        <Route path="/combat" element={<ProtectedRoute><Combat /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/map" element={<ProtectedRoute><Map /></ProtectedRoute>} />
        <Route path="/characters/:uid" element={<ProtectedRoute><PublicCharacter /></ProtectedRoute>} />


        {/* Redirecionamentos */}
        <Route path="/" element={<Navigate to="/location/sala-hospital" replace />} />
        <Route path="*" element={<Navigate to="/location/sala-hospital" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
