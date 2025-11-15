import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PuntoDeVenta from './pages/PuntoDeVenta';
import Inventario from './pages/Inventario';
import Proveedores from './pages/Proveedores';
import Clientes from './pages/Clientes';
import Reportes from './pages/Reportes';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/ventas" element={<PuntoDeVenta />} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/proveedores" element={<Proveedores />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/reportes" element={<Reportes />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
    </Router>
  );
}

export default App;