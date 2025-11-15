import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import './Reportes.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

// --- COMPONENTES AUXILIARES ---

const KpiCard = ({ title, value, isLoading }) => (
    <div className="kpi-card">
        <h4>{title}</h4>
        <div className="kpi-value">{isLoading ? 'Cargando...' : value}</div>
    </div>
);

const TransactionsListModal = ({ transactions, date, onViewDetail, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h2>Transacciones del {date}</h2>
            <div className="transactions-list">
                {transactions.length > 0 ? transactions.map(tx => (
                    <div key={tx.id} className="transaction-card">
                        <div className="tx-info">
                            <span className="tx-time">{new Date(tx.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="tx-customer">{tx.cliente_nombre || 'Venta de Contado'}</span>
                            <span className="tx-total">${parseFloat(tx.total).toLocaleString('es-CO')}</span>
                        </div>
                        <button onClick={() => onViewDetail(tx)} className="details-button">Ver Detalle</button>
                    </div>
                )) : <p>No hay transacciones para esta fecha.</p>}
            </div>
            <div className="modal-actions">
                <button onClick={onClose}>Cerrar</button>
            </div>
        </div>
    </div>
);

const TransactionDetailModal = ({ transaction, details, onBack, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h2>Detalle de la Venta #{transaction.id}</h2>
            <div className="tx-summary">
                <span><strong>Cliente:</strong> {transaction.cliente_nombre || 'Venta de Contado'}</span>
                <span><strong>Total:</strong> ${parseFloat(transaction.total).toLocaleString('es-CO')}</span>
                <span><strong>Hora:</strong> {new Date(transaction.fecha).toLocaleTimeString('es-CO')}</span>
            </div>
            <table className="details-table">
                <thead>
                    <tr><th>Producto</th><th>Cantidad</th><th>Precio Unitario</th><th>Subtotal</th></tr>
                </thead>
                <tbody>
                    {details.map((item, index) => (
                        <tr key={index}>
                            <td>{item.producto_nombre}</td>
                            <td>{item.cantidad}</td>
                            <td>${parseFloat(item.precio_unitario).toLocaleString('es-CO')}</td>
                            <td>${parseFloat(item.subtotal).toLocaleString('es-CO')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="modal-actions">
                <button onClick={onBack} className="back-button">Volver a Transacciones</button>
                <button onClick={onClose}>Cerrar</button>
            </div>
        </div>
    </div>
);


// --- COMPONENTE PRINCIPAL ---

const Reportes = () => {
    const [kpis, setKpis] = useState(null);
    const [tendenciaData, setTendenciaData] = useState(null);
    const [categoriaData, setCategoriaData] = useState(null);
    const [ventasDiarias, setVentasDiarias] = useState([]);
    const [modalStep, setModalStep] = useState(null);
    const [dailyTransactions, setDailyTransactions] = useState([]);
    const [transactionDetails, setTransactionDetails] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            axios.get('http://localhost:3001/api/reportes/kpis'),
            axios.get('http://localhost:3001/api/reportes/tendencia-ventas'),
            axios.get('http://localhost:3001/api/reportes/ventas-por-categoria'),
            axios.get('http://localhost:3001/api/reportes/ventas-diarias')
        ]).then(([kpisRes, tendenciaRes, categoriaRes, diariasRes]) => {
            setKpis(kpisRes.data);
            setTendenciaData({
                labels: tendenciaRes.data.map(d => new Date(d.dia).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })),
                datasets: [{ label: 'Ventas ($)', data: tendenciaRes.data.map(d => d.total_ventas), borderColor: '#20c997', backgroundColor: 'rgba(32, 201, 151, 0.1)', fill: true, tension: 0.4 }]
            });
            setCategoriaData({
                labels: categoriaRes.data.map(c => c.categoria),
                datasets: [{ label: 'Ventas por Categoría', data: categoriaRes.data.map(c => c.total), backgroundColor: ['#20c997', '#ffc107', '#fd7e14', '#0d6efd', '#6f42c1'] }]
            });
            setVentasDiarias(diariasRes.data);
        }).catch(() => toast.error("Error al cargar los datos de reportes."))
          .finally(() => setIsLoading(false));
    }, []);
    
    const handleViewDayTransactions = (fecha) => {
        const formattedDate = new Date(fecha).toISOString().split('T')[0];
        setSelectedDate(new Date(fecha).toLocaleDateString('es-CO', {dateStyle: 'long'}));
        axios.get(`http://localhost:3001/api/reportes/transacciones-dia/${formattedDate}`)
            .then(res => {
                setDailyTransactions(res.data);
                setModalStep('list');
            })
            .catch(() => toast.error("No se pudo cargar la lista de transacciones."));
    };
    
    const handleViewTransactionDetail = (transaction) => {
        setSelectedTransaction(transaction);
        axios.get(`http://localhost:3001/api/reportes/venta-detalle/${transaction.id}`)
            .then(res => {
                setTransactionDetails(res.data);
                setModalStep('detail');
            })
            .catch(() => toast.error("No se pudo cargar el detalle de la venta."));
    };

    const handleCloseModal = () => {
        setModalStep(null);
        setDailyTransactions([]);
        setTransactionDetails([]);
        setSelectedTransaction(null);
    };

    return (
        <div className="page-container reports-page">
            <div className="page-header">
                <h1>Reportes y Estadísticas</h1>
                <button className="export-button">Exportar Reporte</button>
            </div>
            
            <div className="kpi-grid">
                <KpiCard title="Ventas Totales (Última Semana)" value={kpis ? `$${kpis.ventasTotales.toLocaleString('es-CO')}` : '$0'} isLoading={isLoading} />
                <KpiCard title="Promedio Diario" value={kpis ? `$${Math.round(kpis.promedioDiario).toLocaleString('es-CO')}` : '$0'} isLoading={isLoading} />
                <KpiCard title="Clientes Registrados" value={kpis ? kpis.clientesNuevos : '0'} isLoading={isLoading} />
                <KpiCard title="Categoría Más Vendida" value={kpis ? kpis.productoMasVendido : 'N/A'} isLoading={isLoading} />
            </div>

            <div className="charts-grid">
                <div className="chart-container">
                    <h3>Tendencia de Ventas (Últimos 30 días)</h3>
                    {isLoading ? <p>Cargando gráfico...</p> : tendenciaData && <Line data={tendenciaData} options={{ responsive: true }} />}
                </div>
                <div className="chart-container">
                    <h3>Ventas por Categoría</h3>
                    {isLoading ? <p>Cargando gráfico...</p> : categoriaData && <Pie data={categoriaData} options={{ responsive: true }} />}
                </div>
            </div>

            <div className="table-container">
                <h3>Resumen de Ventas por Día</h3>
                <table className="styled-table">
                     <thead>
                        <tr><th>Fecha</th><th>Transacciones</th><th>Total Ventas</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="4" style={{textAlign: 'center'}}>Cargando datos...</td></tr>
                        ) : ventasDiarias.map(venta => (
                            <tr key={venta.dia}>
                                <td>{new Date(venta.dia).toLocaleDateString('es-CO', {dateStyle: 'long'})}</td>
                                <td>{venta.numero_transacciones}</td>
                                <td>${parseFloat(venta.total_ventas).toLocaleString('es-CO')}</td>
                                <td><button onClick={() => handleViewDayTransactions(venta.dia)} className="details-button">Ver Detalle</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalStep === 'list' && (
                <TransactionsListModal 
                    transactions={dailyTransactions}
                    date={selectedDate}
                    onViewDetail={handleViewTransactionDetail}
                    onClose={handleCloseModal}
                />
            )}
            
            {modalStep === 'detail' && (
                <TransactionDetailModal 
                    transaction={selectedTransaction}
                    details={transactionDetails}
                    onBack={() => setModalStep('list')}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default Reportes;