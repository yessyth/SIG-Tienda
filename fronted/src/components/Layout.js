// frontend/src/components/Layout.js

import React from 'react';
import Sidebar from './Sidebar';
import Asistente from './Asistente';
import './Layout.css'; // Aquí aplicaremos la solución principal

const Layout = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content-wrapper">
        <header className="app-header">
          <div className="welcome-message">
            Bienvenido, <strong>{user?.nombre || 'Usuario'}</strong>
          </div>
        </header>
        <main className="content-area">
          {children}
        </main>
      </div>
      <Asistente />
    </div>
  );
};

export default Layout;