import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import NovoContrato from "./pages/NovoContrato";
import Historico from "./pages/Historico";
import Cadastro from "./pages/Cadastro";
import Admin from "./pages/Admin";
import Imoveis from "./pages/Imoveis";
import NovoImovel from "./pages/NovoImovel";
import Imovel from "./pages/Imovel";
import ModelosContrato from "./pages/ModelosContrato";
import ModeloContrato from "./pages/ModeloContrato";
import Perfil from "./pages/Perfil";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
      Carregando...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, nivel } = useAuth();
  if (user === undefined) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
      Carregando...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (nivel !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />

          {/* Privadas */}
          <Route path="/" element={<PrivateRoute><Layout><NovoContrato /></Layout></PrivateRoute>} />
          <Route path="/historico" element={<PrivateRoute><Layout><Historico /></Layout></PrivateRoute>} />
          <Route path="/imoveis" element={<PrivateRoute><Layout><Imoveis /></Layout></PrivateRoute>} />
          <Route path="/imoveis/novo" element={<PrivateRoute><Layout><NovoImovel /></Layout></PrivateRoute>} />
          <Route path="/imoveis/:id" element={<PrivateRoute><Layout><Imovel /></Layout></PrivateRoute>} />

          {/* Modelos de contrato */}
          <Route path="/modelos" element={<PrivateRoute><Layout><ModelosContrato /></Layout></PrivateRoute>} />
          <Route path="/modelos/novo" element={<PrivateRoute><Layout><ModeloContrato /></Layout></PrivateRoute>} />
          <Route path="/modelos/:id" element={<PrivateRoute><Layout><ModeloContrato /></Layout></PrivateRoute>} />

          {/* Perfil */}
          <Route path="/perfil" element={<PrivateRoute><Layout><Perfil /></Layout></PrivateRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><Layout><Admin /></Layout></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
