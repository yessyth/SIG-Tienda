import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaEdit, FaTrash, FaUserTie, FaMoneyBillWave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './Clientes.css';
import './Page.css'

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [payingClient, setPayingClient] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = () => {
    axios.get('http://localhost:3001/api/clientes')
      .then(response => setClientes(response.data))
      .catch(error => {
        console.error("Error al cargar clientes:", error);
        toast.error("No se pudieron cargar los clientes.");
      });
  };

  const handleOpenFormModal = (cliente = null) => {
    setEditingClient(cliente);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditingClient(null);
  };
  
  const handleOpenPaymentModal = (cliente) => {
    setPayingClient(cliente);
    setIsPaymentModalOpen(true);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPayingClient(null);
    setPaymentAmount('');
  };

  const handleDelete = (clienteId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      axios.delete(`http://localhost:3001/api/clientes/${clienteId}`)
        .then(() => {
          setClientes(clientes.filter(c => c.id !== clienteId));
          toast.success('¡Cliente eliminado con éxito!');
        })
        .catch(error => {
          console.error("Error al eliminar cliente:", error);
          toast.error('Error al eliminar el cliente.');
        });
    }
  };

  const handleSave = (clienteData) => {
    const request = editingClient
      ? axios.put(`http://localhost:3001/api/clientes/${editingClient.id}`, clienteData)
      : axios.post('http://localhost:3001/api/clientes', clienteData);

    request.then(response => {
        if (editingClient) {
          setClientes(clientes.map(c => c.id === editingClient.id ? response.data : c));
        } else {
          setClientes([...clientes, response.data]);
        }
        handleCloseFormModal();
        toast.success(`¡Cliente ${editingClient ? 'actualizado' : 'creado'} con éxito!`);
      })
      .catch(error => {
        console.error("Error al guardar cliente:", error);
        toast.error(`Error al ${editingClient ? 'actualizar' : 'crear'} el cliente.`);
      });
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    axios.post(`http://localhost:3001/api/clientes/${payingClient.id}/pago`, { monto_pago: paymentAmount })
      .then(response => {
        setClientes(clientes.map(c => c.id === payingClient.id ? response.data : c));
        handleClosePaymentModal();
        toast.success('¡Pago registrado correctamente!');
      })
      .catch(error => {
        console.error("Error al registrar pago:", error);
        toast.error('Error al registrar el pago.');
      });
  };

  const ClientForm = ({ cliente, onSave, onCancel }) => {
    const [formData, setFormData] = useState(cliente || { nombre: '', telefono: '', direccion: '' });
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>{cliente ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
          <form onSubmit={handleSubmit}>
            <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre completo" required />
            <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="Teléfono" />
            <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Dirección" />
            <div className="modal-actions">
              <button type="button" onClick={onCancel}>Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="clientes-page">
      <div className="page-header">
        <h1>Gestión de Clientes</h1>
        <button className="add-button" onClick={() => handleOpenFormModal()}><FaPlus /> Agregar Cliente</button>
      </div>
      <table className="clients-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th>Deuda Actual</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map(cliente => (
            <tr key={cliente.id}>
              <td><FaUserTie style={{ marginRight: '10px', color: '#555' }} />{cliente.nombre}</td>
              <td>{cliente.telefono || 'N/A'}</td>
              <td>{cliente.direccion || 'N/A'}</td>
              <td>${parseFloat(cliente.deuda_actual).toLocaleString('es-CO')}</td>
              <td>
                <div className="action-buttons">
                  {cliente.deuda_actual > 0 && (
                    <button className="pay-btn" title="Registrar Abono" onClick={() => handleOpenPaymentModal(cliente)}>
                      <FaMoneyBillWave />
                    </button>
                  )}
                  <button className="edit-btn" title="Editar Cliente" onClick={() => handleOpenFormModal(cliente)}><FaEdit /></button>
                  <button className="delete-btn" title="Eliminar Cliente" onClick={() => handleDelete(cliente.id)}><FaTrash /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isFormModalOpen && <ClientForm cliente={editingClient} onSave={handleSave} onCancel={handleCloseFormModal} />}
      {isPaymentModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Registrar Abono</h2>
            <p>Cliente: <strong>{payingClient?.nombre}</strong></p>
            <p>Deuda Actual: <strong>${parseFloat(payingClient?.deuda_actual).toLocaleString('es-CO')}</strong></p>
            <form onSubmit={handlePaymentSubmit}>
              <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Monto del abono" required min="1" autoFocus />
              <div className="modal-actions">
                <button type="button" onClick={handleClosePaymentModal}>Cancelar</button>
                <button type="submit">Registrar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;