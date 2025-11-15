const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;
const JWT_SECRET = 'este-es-un-secreto-muy-seguro-para-tu-proyecto-final';

// --- Configuración ---
app.use(cors());
app.use(express.json());

// --- Conexión a la Base de Datos PostgreSQL ---
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'sig_tienda_db',
  password: 'admin', // Tu contraseña actual
  port: 5432,
});

// ==========================================================
// --- RUTAS DE AUTENTICACIÓN ---
// ==========================================================
app.post('/api/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    try {
        const password_hash = await bcrypt.hash(password, 10);
        const { rows } = await pool.query('INSERT INTO Usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email', [nombre, email, password_hash]);
        res.status(201).json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM Usuarios WHERE email = $1', [email]);
        if (rows.length === 0) return res.status(400).json({ error: 'Credenciales inválidas' });
        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) return res.status(400).json({ error: 'Credenciales inválidas' });
        const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user: { nombre: user.nombre, email: user.email } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================================
// --- RUTAS DE LA APLICACIÓN ---
// ==========================================================

// -- PRODUCTOS --
app.get('/api/productos', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM Productos ORDER BY nombre');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/productos', async (req, res) => {
  const { nombre, categoria, precio_venta, stock_actual } = req.body;
  try {
    const { rows } = await pool.query('INSERT INTO Productos (nombre, categoria, precio_venta, stock_actual) VALUES ($1, $2, $3, $4) RETURNING *', [nombre, categoria, precio_venta, stock_actual]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, precio_venta, stock_actual } = req.body;
  try {
    const { rows } = await pool.query('UPDATE Productos SET nombre = $1, categoria = $2, precio_venta = $3, stock_actual = $4 WHERE id = $5 RETURNING *', [nombre, categoria, precio_venta, stock_actual, id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM Productos WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// -- VENTAS (VERSIÓN FINAL Y SEGURA) --
app.post('/api/ventas', async (req, res) => {
  const { total, items, cliente_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- ¡VALIDACIÓN DE STOCK EN EL BACKEND! ---
    for (const item of items) {
      // FOR UPDATE bloquea la fila para prevenir condiciones de carrera (ej. dos personas vendiendo el último item a la vez)
      const stockResult = await client.query('SELECT nombre, stock_actual FROM Productos WHERE id = $1 FOR UPDATE', [item.producto_id]);
      
      if (stockResult.rows.length === 0) {
        // Lanza un error si el producto ya no existe
        throw new Error(`El producto con ID ${item.producto_id} no existe.`);
      }
      
      const producto = stockResult.rows[0];
      if (producto.stock_actual < item.cantidad) {
        // Lanza un error si no hay suficiente stock, deteniendo la transacción
        throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock_actual}, Solicitado: ${item.cantidad}.`);
      }
    }

    // Si pasamos la validación, procedemos a registrar la venta
    const ventaResult = await client.query('INSERT INTO Ventas (total, cliente_id) VALUES ($1, $2) RETURNING id', [total, cliente_id || null]);
    const ventaId = ventaResult.rows[0].id;

    for (const item of items) {
      await client.query('INSERT INTO Detalle_Ventas (venta_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)', [ventaId, item.producto_id, item.cantidad, item.precio_unitario]);
      await client.query('UPDATE Productos SET stock_actual = stock_actual - $1 WHERE id = $2', [item.cantidad, item.producto_id]);
    }
    
    if (cliente_id) {
      await client.query('UPDATE Clientes SET deuda_actual = deuda_actual + $1 WHERE id = $2', [total, cliente_id]);
    }
    
    await client.query('COMMIT'); // Confirma todos los cambios en la base de datos
    res.status(201).json({ message: 'Venta registrada con éxito', ventaId });
  } catch (err) {
    await client.query('ROLLBACK'); // Deshace todos los cambios si hubo un error
    console.error("Error en POST /api/ventas:", err.message); 
    // Envía el mensaje de error específico al frontend (ej. "Stock insuficiente para...")
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// -- CLIENTES --
app.get('/api/clientes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM Clientes ORDER BY nombre');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes', async (req, res) => {
  const { nombre, telefono, direccion } = req.body;
  try {
    const { rows } = await pool.query('INSERT INTO Clientes (nombre, telefono, direccion) VALUES ($1, $2, $3) RETURNING *', [nombre, telefono, direccion]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/clientes/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, direccion } = req.body;
  try {
    const { rows } = await pool.query('UPDATE Clientes SET nombre = $1, telefono = $2, direccion = $3 WHERE id = $4 RETURNING *', [nombre, telefono, direccion, id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/clientes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM Clientes WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes/:id/pago', async (req, res) => {
    const { id } = req.params;
    const { monto_pago } = req.body;
    if (!monto_pago || monto_pago <= 0) return res.status(400).json({ error: 'El monto del pago debe ser positivo.' });
    try {
        const { rows } = await pool.query('UPDATE Clientes SET deuda_actual = GREATEST(0, deuda_actual - $1) WHERE id = $2 RETURNING *', [monto_pago, id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// -- PROVEEDORES --
app.get('/api/proveedores', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Proveedores ORDER BY nombre');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/proveedores', async (req, res) => {
    const { nombre, nit, direccion, telefono, email, categoria_suministro, estado } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO Proveedores (nombre, nit, direccion, telefono, email, categoria_suministro, estado) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [nombre, nit, direccion, telefono, email, categoria_suministro, estado || 'Activo']);
        res.status(201).json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// -- DASHBOARD & REPORTES --
app.get('/api/dashboard/summary', async (req, res) => {
    try {
        const ventasHoyResult = await pool.query("SELECT SUM(total) as total, COUNT(id) as transacciones FROM Ventas WHERE DATE(fecha) = CURRENT_DATE");
        const productosBajosResult = await pool.query("SELECT COUNT(id) as bajos FROM Productos WHERE stock_actual < 10");
        const creditosPendientesResult = await pool.query("SELECT SUM(deuda_actual) as total FROM Clientes");
        const summary = {
            ventas_hoy: parseFloat(ventasHoyResult.rows[0].total) || 0,
            transacciones: parseInt(ventasHoyResult.rows[0].transacciones) || 0,
            productos_bajos: parseInt(productosBajosResult.rows[0].bajos) || 0,
            creditos_pendientes: parseFloat(creditosPendientesResult.rows[0].total) || 0,
        };
        res.json(summary);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reportes/kpis', async (req, res) => {
    try {
        const ventasTotalesRes = await pool.query("SELECT SUM(total) as total FROM Ventas WHERE fecha >= NOW() - interval '7 day'");
        const promedioDiarioRes = await pool.query("SELECT AVG(daily_total) as promedio FROM (SELECT SUM(total) as daily_total FROM Ventas WHERE fecha >= NOW() - interval '7 day' GROUP BY DATE(fecha)) as daily_sums");
        const clientesNuevosRes = await pool.query("SELECT COUNT(id) as nuevos FROM Clientes WHERE id > 0");
        res.json({
            ventasTotales: parseFloat(ventasTotalesRes.rows[0].total) || 0,
            promedioDiario: parseFloat(promedioDiarioRes.rows[0].promedio) || 0,
            clientesNuevos: parseInt(clientesNuevosRes.rows[0].nuevos) || 0,
            productoMasVendido: "Gaseosas"
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reportes/tendencia-ventas', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT DATE_TRUNC('day', fecha)::date as dia, SUM(total) as total_ventas FROM Ventas WHERE fecha >= NOW() - interval '30 day' GROUP BY dia ORDER BY dia;`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reportes/ventas-por-categoria', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT p.categoria, SUM(dv.cantidad * dv.precio_unitario) as total FROM Detalle_Ventas dv JOIN Productos p ON dv.producto_id = p.id GROUP BY p.categoria HAVING p.categoria IS NOT NULL;`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reportes/transacciones-dia/:fecha', async (req, res) => {
    const { fecha } = req.params;
    try {
        const { rows } = await pool.query(`SELECT v.id, v.fecha, v.total, c.nombre as cliente_nombre FROM Ventas v LEFT JOIN Clientes c ON v.cliente_id = c.id WHERE DATE(v.fecha) = $1 ORDER BY v.fecha DESC;`, [fecha]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reportes/venta-detalle/:venta_id', async (req, res) => {
    const { venta_id } = req.params;
    try {
        const { rows } = await pool.query(`SELECT p.nombre as producto_nombre, dv.cantidad, dv.precio_unitario, (dv.cantidad * dv.precio_unitario) as subtotal FROM Detalle_Ventas dv JOIN Productos p ON dv.producto_id = p.id WHERE dv.venta_id = $1;`, [venta_id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reportes/ventas-diarias', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT DATE(fecha) as dia, SUM(total) as total_ventas, COUNT(id) as numero_transacciones FROM Ventas GROUP BY DATE(fecha) ORDER BY dia DESC`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Iniciar el servidor ---
app.listen(port, () => {
  console.log(`Servidor backend corriendo en http://localhost:${port}`);
});