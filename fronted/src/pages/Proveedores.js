import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTruck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './Proveedores.css';
import './Page.css'

const Proveedores = () => {
    const [proveedores, setProveedores] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchProveedores();
    }, []);

    const fetchProveedores = () => {
        setIsLoading(true);
        axios.get('http://localhost:3001/api/proveedores')
            .then(res => {
                setProveedores(res.data);
                setIsLoading(false);
            })
            .catch(() => {
                toast.error("No se pudieron cargar los proveedores.");
                setIsLoading(false);
            });
    };

    const handleOpenModal = (proveedor = null) => {
        setEditingProvider(proveedor);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProvider(null);
    };

    const handleSave = (providerData) => {
        const request = editingProvider
            ? axios.put(`http://localhost:3001/api/proveedores/${editingProvider.id}`, providerData)
            : axios.post('http://localhost:3001/api/proveedores', providerData);
        
        request.then(response => {
            if (editingProvider) {
                setProveedores(proveedores.map(p => p.id === editingProvider.id ? response.data : p));
            } else {
                setProveedores([...proveedores, response.data]);
            }
            handleCloseModal();
            toast.success(`¡Proveedor ${editingProvider ? 'actualizado' : 'guardado'}!`);
        }).catch(() => toast.error("Error al guardar el proveedor."));
    };

    const handleDelete = (providerId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
            axios.delete(`http://localhost:3001/api/proveedores/${providerId}`)
                .then(() => {
                    setProveedores(proveedores.filter(p => p.id !== providerId));
                    toast.success('¡Proveedor eliminado con éxito!');
                })
                .catch(() => toast.error('Error al eliminar el proveedor.'));
        }
    };

    const filteredProveedores = proveedores.filter(p => 
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Gestión de Proveedores</h1>
                <button onClick={() => handleOpenModal()} className="add-button"><FaPlus /> Nuevo Proveedor</button>
            </div>

            <div className="table-container">
                <div className="table-header">
                    <div className="search-bar-table">
                        <FaSearch color="#888"/>
                        <input type="text" placeholder="Buscar proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <table className="styled-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Proveedor</th>
                            <th>Teléfono</th>
                            <th>Correo</th>
                            <th>Categoría</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="7">Cargando proveedores...</td></tr>
                        ) : filteredProveedores.length > 0 ? (
                            filteredProveedores.map(prov => (
                                <tr key={prov.id}>
                                    <td>{String(prov.id).padStart(3, '0')}</td>
                                    <td><FaTruck style={{marginRight: '10px', color: '#555'}}/>{prov.nombre}</td>
                                    <td>{prov.telefono || 'N/A'}</td>
                                    <td>{prov.email || 'N/A'}</td>
                                    <td>{prov.categoria_suministro || 'N/A'}</td>
                                    <td>
                                        <span className={`status-badge ${prov.estado === 'Activo' ? 'status-activo' : 'status-inactivo'}`}>
                                            {prov.estado}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="edit-btn" title="Editar Proveedor" onClick={() => handleOpenModal(prov)}><FaEdit /></button>
                                            <button className="delete-btn" title="Eliminar Proveedor" onClick={() => handleDelete(prov.id)}><FaTrash /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="7">No se encontraron proveedores.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {isModalOpen && <ProviderForm proveedor={editingProvider} onSave={handleSave} onCancel={handleCloseModal} />}
        </div>
    );
};

const ProviderForm = ({ proveedor, onSave, onCancel }) => {
    const [formData, setFormData] = useState(
      proveedor || { nombre: '', nit: '', direccion: '', telefono: '', email: '', categoria_suministro: '', estado: 'Activo' }
    );
  
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };
  
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>{proveedor ? 'Editar Proveedor' : 'Registro de Proveedor'}</h2>
                <form onSubmit={handleSubmit} className="provider-form">
                    <div className="form-grid">
                        <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre del Proveedor" required />
                        <input type="text" name="nit" value={formData.nit} onChange={handleChange} placeholder="NIT o Identificación" />
                        <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Dirección" />
                        <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="Teléfono" />
                        <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Correo Electrónico" />
                        <input type="text" name="categoria_suministro" value={formData.categoria_suministro} onChange={handleChange} placeholder="Categoría de Suministro (ej. Lácteos)" />
                    </div>
                    <div className="modal-actions">
                        <button type="button" onClick={onCancel}>Cancelar</button>
                        <button type="submit" className="save-btn">Guardar Proveedor</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Proveedores;