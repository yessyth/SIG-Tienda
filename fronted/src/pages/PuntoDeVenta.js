import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaSearch, FaPlus, FaMinus, FaTrash, FaShoppingCart } from 'react-icons/fa';
import './PuntoDeVenta.css';

const PuntoDeVenta = () => {
    const [productos, setProductos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [carrito, setCarrito] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Efectivo');
    const [selectedClient, setSelectedClient] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = () => {
        setIsLoading(true);
        Promise.all([
            axios.get('http://localhost:3001/api/productos'),
            axios.get('http://localhost:3001/api/clientes')
        ]).then(([productosRes, clientesRes]) => {
            setProductos(productosRes.data);
            setClientes(clientesRes.data);
        }).catch(() => {
            toast.error("Error al cargar datos iniciales.");
        }).finally(() => {
            setIsLoading(false);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCartChange = (producto, action) => {
        setCarrito(currentCart => {
            const existingItem = currentCart.find(item => item.id === producto.id);
            const productoInfo = productos.find(p => p.id === producto.id);
            const currentStock = productoInfo ? productoInfo.stock_actual : 0;

            if (action === 'add') {
                const cantidadEnCarrito = existingItem ? existingItem.cantidad : 0;
                if (cantidadEnCarrito >= currentStock) {
                    toast.warn(`No hay más stock disponible para "${producto.nombre}".`);
                    return currentCart;
                }
                
                if (existingItem) {
                    return currentCart.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
                }
                return [...currentCart, { ...producto, cantidad: 1 }];
            }
            if (action === 'remove' && existingItem) {
                if (existingItem.cantidad === 1) {
                    return currentCart.filter(item => item.id !== producto.id);
                }
                return currentCart.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad - 1 } : item);
            }
            if (action === 'delete') {
                return currentCart.filter(item => item.id !== producto.id);
            }
            return currentCart;
        });
    };

    const handleCompleteSale = () => {
        if (carrito.length === 0) return;
        if (paymentMethod === 'Crédito (Fiado)' && !selectedClient) {
            toast.error("Debe seleccionar un cliente para una venta a crédito.");
            return;
        }

        const ventaData = {
            total: total,
            items: carrito.map(item => ({ producto_id: item.id, cantidad: item.cantidad, precio_unitario: item.precio_venta })),
            ...(paymentMethod === 'Crédito (Fiado)' && { cliente_id: selectedClient })
        };
        
        axios.post('http://localhost:3001/api/ventas', ventaData)
            .then(() => {
                toast.success('¡Venta registrada con éxito!');
                setCarrito([]);
                setSelectedClient('');
                setPaymentMethod('Efectivo');
                fetchData();
            })
            .catch(error => {
                const errorMessage = error.response?.data?.error || 'Hubo un error al registrar la venta.';
                toast.error(errorMessage);
            });
    };

    const filteredProducts = productos.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
    const total = carrito.reduce((sum, item) => sum + item.cantidad * item.precio_venta, 0);
    const totalItems = carrito.reduce((count, item) => count + item.cantidad, 0);

    return (
        <div className="pos-page">
            <div className="product-grid">
                <div className="page-header">
                    <h1>Punto de Venta</h1>
                    <p>Registrar nueva venta</p>
                </div>
                <div className="search-bar">
                    <FaSearch color="#888"/>
                    <input type="text" placeholder="Buscar por nombre o código de barras..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="grid-container">
                    {isLoading ? <p>Cargando productos...</p> : 
                    filteredProducts.map(p => (
                        <div 
                            key={p.id} 
                            className={`product-card ${p.stock_actual <= 0 ? 'no-stock' : ''}`} 
                            onClick={() => {
                                if (p.stock_actual > 0) {
                                    handleCartChange(p, 'add');
                                }
                            }}
                        >
                            <h4>{p.nombre}</h4>
                            <p className="price">${parseFloat(p.precio_venta).toLocaleString('es-CO')}</p>
                            <span className="stock">Stock: {p.stock_actual}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="cart-summary">
                <h3><FaShoppingCart /> Carrito ({totalItems})</h3>
                <div className="cart-items">
                    {carrito.length === 0 ? <p className="empty-cart">El carrito está vacío</p> : 
                    carrito.map(item => (
                        <div key={item.id} className="cart-item">
                            <div className="item-info">
                                <p>{item.nombre}</p>
                                <span>${parseFloat(item.precio_venta).toLocaleString('es-CO')} c/u</span>
                            </div>
                            <div className="item-controls">
                                <button onClick={() => handleCartChange(item, 'remove')}><FaMinus /></button>
                                <span>{item.cantidad}</span>
                                <button onClick={() => handleCartChange(item, 'add')}><FaPlus /></button>
                                <button className="trash-btn" onClick={() => handleCartChange(item, 'delete')}><FaTrash /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="payment-method">
                    <h4>Método de Pago</h4>
                    <div className="radio-group">
                        <input type="radio" id="efectivo" name="paymentMethod" value="Efectivo" checked={paymentMethod === 'Efectivo'} onChange={(e) => setPaymentMethod(e.target.value)} />
                        <label htmlFor="efectivo">Efectivo</label>
                    </div>
                    <div className="radio-group">
                        <input type="radio" id="tarjeta" name="paymentMethod" value="Tarjeta" checked={paymentMethod === 'Tarjeta'} onChange={(e) => setPaymentMethod(e.target.value)} disabled/>
                        <label htmlFor="tarjeta" className="disabled-label">Tarjeta (Próximamente)</label>
                    </div>
                    <div className="radio-group">
                        <input type="radio" id="fiado" name="paymentMethod" value="Crédito (Fiado)" checked={paymentMethod === 'Crédito (Fiado)'} onChange={(e) => setPaymentMethod(e.target.value)} />
                        <label htmlFor="fiado">Crédito (Fiado)</label>
                    </div>
                    {paymentMethod === 'Crédito (Fiado)' && (
                        <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="client-select">
                            <option value="">-- Seleccione un cliente --</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    )}
                </div>
                <div className="totals">
                    <div className="line-item"><span>Subtotal</span><span>${total.toLocaleString('es-CO')}</span></div>
                    <div className="line-item total"><span>Total</span><span>${total.toLocaleString('es-CO')}</span></div>
                </div>
                <button 
                    className="complete-sale-btn" 
                    onClick={handleCompleteSale}
                    disabled={carrito.length === 0 || (paymentMethod === 'Crédito (Fiado)' && !selectedClient)}
                >
                    Completar Venta
                </button>
            </div>
        </div>
    );
};

export default PuntoDeVenta;