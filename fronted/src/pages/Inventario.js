import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaEdit, FaTrash, FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './Inventario.css';
import './Page.css'

const Inventario = () => {
    const [productos, setProductos] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchProductos();
    }, []);

    const fetchProductos = () => {
        setIsLoading(true);
        axios.get('http://localhost:3001/api/productos')
            .then(res => {
                setProductos(res.data);
                setIsLoading(false);
            })
            .catch(() => {
                toast.error("No se pudieron cargar los productos.");
                setIsLoading(false);
            });
    };
    
    // ... (las funciones handleSave, handleDelete, handleOpenModal, handleCloseModal no cambian en su lógica principal)
    // Se copian de nuevo aquí para tener el archivo completo.
    
    const handleOpenModal = (producto = null) => {
        setEditingProduct(producto);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };
    
    const handleSave = (productoData) => {
        const request = editingProduct
          ? axios.put(`http://localhost:3001/api/productos/${editingProduct.id}`, productoData)
          : axios.post('http://localhost:3001/api/productos', productoData);

        request.then(response => {
            if (editingProduct) {
              setProductos(productos.map(p => p.id === editingProduct.id ? response.data : p));
            } else {
              setProductos([...productos, response.data]);
            }
            handleCloseModal();
            toast.success(`¡Producto ${editingProduct ? 'actualizado' : 'creado'} con éxito!`);
          })
          .catch(() => toast.error(`Error al ${editingProduct ? 'actualizar' : 'crear'} el producto.`));
    };

    const handleDelete = (productoId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
            axios.delete(`http://localhost:3001/api/productos/${productoId}`)
                .then(() => {
                    setProductos(productos.filter(p => p.id !== productoId));
                    toast.success('¡Producto eliminado con éxito!');
                })
                .catch(() => toast.error('Error al eliminar el producto.'));
        }
    };

    const getStatus = (stock) => {
        if (stock > 20) return { text: 'Suficiente', className: 'status-suficiente' };
        if (stock > 5) return { text: 'Medio', className: 'status-medio' };
        return { text: 'Bajo', className: 'status-bajo' };
    };

    const filteredProducts = productos.filter(p => 
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page-container">
            <div className="page-header-inv">
                <h1>Gestión de Inventario</h1>
                <button onClick={() => handleOpenModal()} className="add-button-inv"><FaPlus /> Nuevo Producto</button>
            </div>

            <div className="table-container">
                <div className="table-controls">
                    <h3>Lista de Productos</h3>
                    <div className="search-bar-table">
                        <FaSearch color="#888"/>
                        <input type="text" placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <table className="styled-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre del Producto</th>
                            <th>Categoría</th>
                            <th>Cantidad Disponible</th>
                            <th>Precio Unitario</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="7" style={{textAlign: 'center'}}>Cargando productos...</td></tr>
                        ) : filteredProducts.length > 0 ? (
                            filteredProducts.map(prod => {
                                const status = getStatus(prod.stock_actual);
                                return (
                                    <tr key={prod.id}>
                                        <td>{String(prod.id).padStart(3, '0')}</td>
                                        <td>{prod.nombre}</td>
                                        <td>{prod.categoria || 'N/A'}</td>
                                        <td>{prod.stock_actual}</td>
                                        <td>${parseFloat(prod.precio_venta).toLocaleString('es-CO')}</td>
                                        <td>
                                            <span className={`status-badge ${status.className}`}>
                                                {status.text}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="edit-btn-inv" onClick={() => handleOpenModal(prod)}><FaEdit /> Editar</button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr><td colSpan="7" style={{textAlign: 'center'}}>No se encontraron productos.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {isModalOpen && <ProductForm producto={editingProduct} onSave={handleSave} onCancel={handleCloseModal} />}
        </div>
    );
};

// Componente del Modal para Crear/Editar productos
const ProductForm = ({ producto, onSave, onCancel }) => {
    const [formData, setFormData] = useState(
      producto || { nombre: '', categoria: '', precio_venta: '', stock_actual: '' }
    );
  
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };
  
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>{producto ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                <form onSubmit={handleSubmit}>
                    <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre del producto" required autoFocus/>
                    <input type="text" name="categoria" value={formData.categoria} onChange={handleChange} placeholder="Categoría (ej. Bebidas, Lácteos)" />
                    <input type="number" name="precio_venta" value={formData.precio_venta} onChange={handleChange} placeholder="Precio de venta" required min="0"/>
                    <input type="number" name="stock_actual" value={formData.stock_actual} onChange={handleChange} placeholder="Cantidad inicial" required min="0"/>
                    <div className="modal-actions">
                        <button type="button" onClick={onCancel}>Cancelar</button>
                        <button type="submit">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Inventario;