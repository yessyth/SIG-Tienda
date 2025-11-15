import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaShoppingCart, FaBoxOpen, FaUsers, FaChartBar } from 'react-icons/fa';
import './Dashboard.css';

const DashboardCard = ({ icon, title, description, link }) => (
  <div className="dashboard-card">
    <div className="card-icon">{icon}</div>
    <h3>{title}</h3>
    <p>{description}</p>
    <a href={link} className="card-link">Abrir módulo →</a>
  </div>
);

const SummaryCard = ({ title, value }) => (
  <div className="summary-item">
    <h4>{title}</h4>
    <p>{typeof value === 'number' && (title.includes('$') || title.includes('Ventas')) ? `$${Math.round(value).toLocaleString('es-CO')}` : value}</p>
  </div>
);

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('http://localhost:3001/api/dashboard/summary')
      .then(response => {
        setSummary(response.data);
      })
      .catch(error => {
        console.error("Error al cargar el resumen del día:", error);
        setError('No se pudo cargar el resumen del día. Verifique que el servidor backend esté funcionando.');
      });
  }, []);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Mi Tienda</h1>
        <p>Sistema de Gestión Inteligente</p>
      </div>

      <div className="dashboard-grid">
        <DashboardCard icon={<FaShoppingCart />} title="Ventas" description="Registrar ventas y cobros" link="/ventas" />
        <DashboardCard icon={<FaBoxOpen />} title="Inventario" description="Gestionar productos y stock" link="/inventario" />
        <DashboardCard icon={<FaUsers />} title="Clientes" description="Administrar clientes y créditos" link="/clientes" />
        <DashboardCard icon={<FaChartBar />} title="Reportes" description="Ver estadísticas y análisis" link="/reportes" />
      </div>

      <div className="summary-section">
        <h3>Resumen del Día</h3>
        {error && <p className="error-message">{error}</p>}
        {!error && (
          summary ? (
            <div className="summary-grid">
              <SummaryCard title="Ventas Hoy" value={summary.ventas_hoy} />
              <SummaryCard title="Transacciones" value={summary.transacciones} />
              <SummaryCard title="Productos Bajos" value={summary.productos_bajos} />
              <SummaryCard title="Créditos Pendientes $" value={summary.creditos_pendientes} />
            </div>
          ) : (
            <p>Cargando resumen...</p>
          )
        )}
      </div>
    </div>
  );
};

export default Dashboard;