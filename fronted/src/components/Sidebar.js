import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom'; // <--- Importa useNavigate
import { FaHome, FaShoppingCart, FaBoxOpen, FaUsers, FaChartBar, FaSignOutAlt, FaTruck } from 'react-icons/fa';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate(); // <-- Inicializa el hook de navegación
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    // 1. Borra los datos de sesión del almacenamiento
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // 2. ¡LA CLAVE! Redirige al usuario a la página de login
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>SIG-Tienda</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className="nav-link"><FaHome /> Inicio</NavLink>
        <NavLink to="/ventas" className="nav-link"><FaShoppingCart /> Ventas</NavLink>
        <NavLink to="/inventario" className="nav-link"><FaBoxOpen /> Inventario</NavLink>
        <NavLink to="/proveedores" className="nav-link"><FaTruck /> Proveedores</NavLink>
        <NavLink to="/clientes" className="nav-link"><FaUsers /> Clientes</NavLink>
        <NavLink to="/reportes" className="nav-link"><FaChartBar /> Reportes</NavLink>
      </nav>
      <div className="sidebar-footer">
        <div className="user-info">
          <p>{user?.nombre || 'Usuario'}</p>
          <span>{user?.email || ''}</span>
        </div>
        <button onClick={handleLogout} className="logout-button"><FaSignOutAlt /> Cerrar Sesión</button>
      </div>
    </div>
  );
};

export default Sidebar;