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
  database: 'sig_tienda',  // ← Cambiar aquí
  password: '12345',  // ← Poner tu contraseña de postgres
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

// ==========================================================
// --- NUEVA RUTA DE IA ---
// ==========================================================
// NOTA: Asegúrate de tener un archivo llamado 'ia.routes.js' en la misma carpeta.




// ==========================================================
// --- DASHBOARD & REPORTES ---
// ==========================================================
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



// ============================================
// AGREGAR AL FINAL DEL ARCHIVO backend/index.js
// ANTES DE app.listen()
// ============================================

// ==========================================================
// --- INTEGRACIÓN CON OLLAMA (IA LOCAL) ---
// ==========================================================

// Función auxiliar para llamar a Ollama
async function llamarOllama(prompt, systemPrompt = "") {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:1b',
        prompt: prompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 500
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error llamando a Ollama:', error);
    throw new Error('No se pudo conectar con el asistente de IA. Asegúrate de que Ollama esté corriendo.');
  }
}

// --- CHAT GENERAL CON IA ---
app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  
  try {
    // Obtener contexto de la base de datos
    const ventasHoyResult = await pool.query(
      "SELECT COUNT(*) as total, SUM(total) as monto FROM Ventas WHERE DATE(fecha) = CURRENT_DATE"
    );
    const productosResult = await pool.query(
      "SELECT COUNT(*) as total, COUNT(CASE WHEN stock_actual < 10 THEN 1 END) as bajos FROM Productos"
    );
    const clientesResult = await pool.query(
      "SELECT COUNT(*) as total, SUM(deuda_actual) as deuda_total FROM Clientes WHERE deuda_actual > 0"
    );
    
    const contexto = {
      ventas_hoy: ventasHoyResult.rows[0],
      productos: productosResult.rows[0],
      clientes: clientesResult.rows[0]
    };

    const systemPrompt = `Eres un asistente experto en gestión de tiendas y negocios minoristas. 
Ayudas al dueño de una tienda a tomar mejores decisiones basándote en datos.
Contexto actual de la tienda:
- Ventas hoy: ${contexto.ventas_hoy.total} transacciones por $${contexto.ventas_hoy.monto || 0}
- Productos: ${contexto.productos.total} total, ${contexto.productos.bajos} con stock bajo
- Clientes con deuda: ${contexto.clientes.total}, deuda total: $${contexto.clientes.deuda_total || 0}

Responde de manera concisa, práctica y en español. Usa datos colombianos cuando sea relevante.`;

    const respuesta = await llamarOllama(message, systemPrompt);
    
    res.json({ 
      respuesta,
      contexto 
    });
  } catch (err) {
    console.error('Error en /api/ai/chat:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- PREDICCIÓN DE DEMANDA ---
app.post('/api/ai/predict-demand', async (req, res) => {
  try {
    // Obtener datos históricos de ventas por producto
    const ventasHistoricas = await pool.query(`
      SELECT 
        p.nombre,
        p.categoria,
        COUNT(dv.id) as veces_vendido,
        SUM(dv.cantidad) as cantidad_total,
        AVG(dv.cantidad) as promedio_por_venta,
        MAX(v.fecha) as ultima_venta
      FROM Detalle_Ventas dv
      JOIN Productos p ON dv.producto_id = p.id
      JOIN Ventas v ON dv.venta_id = v.id
      WHERE v.fecha >= NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.nombre, p.categoria
      ORDER BY cantidad_total DESC
      LIMIT 10
    `);

    const productosStockBajo = await pool.query(`
      SELECT nombre, stock_actual, precio_venta
      FROM Productos
      WHERE stock_actual < 10
      ORDER BY stock_actual ASC
    `);

    const prompt = `Analiza estos datos de ventas de los últimos 30 días y genera predicciones de demanda:

PRODUCTOS MÁS VENDIDOS:
${ventasHistoricas.rows.map(p => 
  `- ${p.nombre}: ${p.cantidad_total} unidades vendidas, promedio ${parseFloat(p.promedio_por_venta).toFixed(1)} por venta`
).join('\n')}

PRODUCTOS CON STOCK BAJO:
${productosStockBajo.rows.map(p => 
  `- ${p.nombre}: solo ${p.stock_actual} unidades disponibles`
).join('\n')}

Proporciona:
1. Top 3 productos que debes reabastecer urgentemente
2. Cantidad sugerida a pedir para cada uno
3. Productos que podrían tener mayor demanda próximamente
4. Recomendación de acción inmediata

Sé específico y práctico.`;

    const respuesta = await llamarOllama(prompt, 
      "Eres un analista de inventarios experto. Analiza patrones de venta y genera predicciones accionables."
    );

    res.json({
      respuesta,
      datos: {
        productos_mas_vendidos: ventasHistoricas.rows,
        stock_bajo: productosStockBajo.rows
      }
    });
  } catch (err) {
    console.error('Error en predicción de demanda:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- ANÁLISIS CREDITICIO ---
app.post('/api/ai/credit-analysis', async (req, res) => {
  const { cliente_id } = req.body;
  
  try {
    // Obtener historial del cliente
    const clienteInfo = await pool.query(
      'SELECT * FROM Clientes WHERE id = $1',
      [cliente_id]
    );

    if (clienteInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const historialVentas = await pool.query(`
      SELECT 
        COUNT(*) as total_compras,
        SUM(total) as monto_total,
        AVG(total) as ticket_promedio,
        MAX(fecha) as ultima_compra,
        MIN(fecha) as primera_compra
      FROM Ventas
      WHERE cliente_id = $1
    `, [cliente_id]);

    const cliente = clienteInfo.rows[0];
    const historial = historialVentas.rows[0];

    const prompt = `Analiza el perfil crediticio de este cliente:

DATOS DEL CLIENTE:
- Nombre: ${cliente.nombre}
- Deuda actual: $${cliente.deuda_actual}
- Total de compras: ${historial.total_compras || 0}
- Monto total comprado: $${historial.monto_total || 0}
- Ticket promedio: $${parseFloat(historial.ticket_promedio || 0).toFixed(0)}
- Cliente desde: ${historial.primera_compra || 'Nuevo'}
- Última compra: ${historial.ultima_compra || 'Sin compras'}

Proporciona:
1. Evaluación de riesgo (Bajo/Medio/Alto)
2. Límite de crédito recomendado
3. Estrategia de cobranza si tiene deuda
4. Recomendaciones específicas

Sé objetivo y basado en datos.`;

    const respuesta = await llamarOllama(prompt,
      "Eres un analista de crédito experto. Evalúa riesgos y genera recomendaciones prudentes."
    );

    res.json({
      respuesta,
      datos: {
        cliente: cliente,
        historial: historial
      }
    });
  } catch (err) {
    console.error('Error en análisis crediticio:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- ASISTENTE DE PRECIOS ---
app.post('/api/ai/price-assistant', async (req, res) => {
  try {
    // Análisis de rentabilidad por producto
    const analisisProductos = await pool.query(`
      SELECT 
        p.nombre,
        p.precio_venta,
        p.stock_actual,
        COUNT(dv.id) as veces_vendido,
        SUM(dv.cantidad * dv.precio_unitario) as ingresos_totales,
        AVG(dv.precio_unitario) as precio_promedio_venta
      FROM Productos p
      LEFT JOIN Detalle_Ventas dv ON p.id = dv.producto_id
      LEFT JOIN Ventas v ON dv.venta_id = v.id
      WHERE v.fecha >= NOW() - INTERVAL '30 days' OR v.fecha IS NULL
      GROUP BY p.id, p.nombre, p.precio_venta, p.stock_actual
      ORDER BY veces_vendido DESC
    `);

    const prompt = `Analiza la estrategia de precios de estos productos:

${analisisProductos.rows.slice(0, 10).map(p => `
Producto: ${p.nombre}
- Precio actual: $${p.precio_venta}
- Stock: ${p.stock_actual} unidades
- Veces vendido (30 días): ${p.veces_vendido || 0}
- Ingresos generados: $${p.ingresos_totales || 0}
`).join('\n---\n')}

Proporciona:
1. Productos con precio óptimo (mantener)
2. Productos subvalorados (aumentar precio)
3. Productos sobrevalorados (reducir precio o promocionar)
4. Estrategia de promoción para productos de baja rotación

Sé específico con porcentajes y justifica cada recomendación.`;

    const respuesta = await llamarOllama(prompt,
      "Eres un experto en pricing y estrategia comercial. Optimiza precios para maximizar rentabilidad."
    );

    res.json({
      respuesta,
      datos: {
        productos_analizados: analisisProductos.rows
      }
    });
  } catch (err) {
    console.error('Error en asistente de precios:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- ANÁLISIS GENERAL DEL NEGOCIO ---
app.post('/api/ai/business-insights', async (req, res) => {
  try {
    // Resumen completo del negocio
    const ventasMes = await pool.query(`
      SELECT 
        DATE_TRUNC('day', fecha) as dia,
        COUNT(*) as transacciones,
        SUM(total) as ventas
      FROM Ventas
      WHERE fecha >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', fecha)
      ORDER BY dia DESC
    `);

    const mejoresClientes = await pool.query(`
      SELECT 
        c.nombre,
        COUNT(v.id) as compras,
        SUM(v.total) as total_gastado
      FROM Clientes c
      JOIN Ventas v ON c.id = v.cliente_id
      GROUP BY c.id, c.nombre
      ORDER BY total_gastado DESC
      LIMIT 5
    `);

    const ventasTotales = ventasMes.rows.reduce((sum, dia) => sum + parseFloat(dia.ventas), 0);
    const promedioDiario = ventasTotales / 30;

    const prompt = `Genera un análisis completo del negocio:

RENDIMIENTO ÚLTIMOS 30 DÍAS:
- Ventas totales: $${ventasTotales.toFixed(0)}
- Promedio diario: $${promedioDiario.toFixed(0)}
- Días con ventas: ${ventasMes.rows.length}

MEJORES CLIENTES:
${mejoresClientes.rows.map(c => 
  `- ${c.nombre}: ${c.compras} compras, $${parseFloat(c.total_gastado).toFixed(0)} total`
).join('\n')}

Proporciona:
1. Evaluación general del rendimiento
2. Tendencias identificadas
3. Oportunidades de crecimiento
4. Riesgos o áreas de mejora
5. 3 acciones concretas para el próximo mes`;

    const respuesta = await llamarOllama(prompt,
      "Eres un consultor de negocios experto. Analiza datos y genera insights estratégicos accionables."
    );

    res.json({
      respuesta,
      datos: {
        ventas_mes: ventasMes.rows,
        mejores_clientes: mejoresClientes.rows,
        metricas: {
          ventas_totales: ventasTotales,
          promedio_diario: promedioDiario
        }
      }
    });
  } catch (err) {
    console.error('Error en análisis de negocio:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// FIN DE LA INTEGRACIÓN CON OLLAMA
// ==========================================================

// ... todo tu código anterior ...

// ==========================================================
// --- INTEGRACIÓN CON OLLAMA (IA LOCAL) ---
// ==========================================================

// Función auxiliar para llamar a Ollama
async function llamarOllama(prompt, systemPrompt = "") {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:1b',
        prompt: prompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 500
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error llamando a Ollama:', error);
    throw new Error('No se pudo conectar con el asistente de IA. Asegúrate de que Ollama esté corriendo.');
  }
}

// --- CHAT GENERAL CON IA ---
app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  
  try {
    // Obtener contexto de la base de datos
    const ventasHoyResult = await pool.query(
      "SELECT COUNT(*) as total, SUM(total) as monto FROM Ventas WHERE DATE(fecha) = CURRENT_DATE"
    );
    const productosResult = await pool.query(
      "SELECT COUNT(*) as total, COUNT(CASE WHEN stock_actual < 10 THEN 1 END) as bajos FROM Productos"
    );
    const clientesResult = await pool.query(
      "SELECT COUNT(*) as total, SUM(deuda_actual) as deuda_total FROM Clientes WHERE deuda_actual > 0"
    );
    
    const contexto = {
      ventas_hoy: ventasHoyResult.rows[0],
      productos: productosResult.rows[0],
      clientes: clientesResult.rows[0]
    };

    const systemPrompt = `Eres un asistente experto en gestión de tiendas y negocios minoristas. 
Ayudas al dueño de una tienda a tomar mejores decisiones basándote en datos.
Contexto actual de la tienda:
- Ventas hoy: ${contexto.ventas_hoy.total} transacciones por $${contexto.ventas_hoy.monto || 0}
- Productos: ${contexto.productos.total} total, ${contexto.productos.bajos} con stock bajo
- Clientes con deuda: ${contexto.clientes.total}, deuda total: $${contexto.clientes.deuda_total || 0}

Responde de manera concisa, práctica y en español. Usa datos colombianos cuando sea relevante.`;

    const respuesta = await llamarOllama(message, systemPrompt);
    
    res.json({ 
      respuesta,
      contexto 
    });
  } catch (err) {
    console.error('Error en /api/ai/chat:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- PREDICCIÓN DE DEMANDA ---
app.post('/api/ai/predict-demand', async (req, res) => {
  try {
    const ventasHistoricas = await pool.query(`
      SELECT 
        p.nombre,
        p.categoria,
        COUNT(dv.id) as veces_vendido,
        SUM(dv.cantidad) as cantidad_total,
        AVG(dv.cantidad) as promedio_por_venta,
        MAX(v.fecha) as ultima_venta
      FROM Detalle_Ventas dv
      JOIN Productos p ON dv.producto_id = p.id
      JOIN Ventas v ON dv.venta_id = v.id
      WHERE v.fecha >= NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.nombre, p.categoria
      ORDER BY cantidad_total DESC
      LIMIT 10
    `);

    const productosStockBajo = await pool.query(`
      SELECT nombre, stock_actual, precio_venta
      FROM Productos
      WHERE stock_actual < 10
      ORDER BY stock_actual ASC
    `);

    const prompt = `Analiza estos datos de ventas de los últimos 30 días y genera predicciones de demanda:

PRODUCTOS MÁS VENDIDOS:
${ventasHistoricas.rows.map(p => 
  `- ${p.nombre}: ${p.cantidad_total} unidades vendidas, promedio ${parseFloat(p.promedio_por_venta).toFixed(1)} por venta`
).join('\n')}

PRODUCTOS CON STOCK BAJO:
${productosStockBajo.rows.map(p => 
  `- ${p.nombre}: solo ${p.stock_actual} unidades disponibles`
).join('\n')}

Proporciona:
1. Top 3 productos que debes reabastecer urgentemente
2. Cantidad sugerida a pedir para cada uno
3. Productos que podrían tener mayor demanda próximamente
4. Recomendación de acción inmediata

Sé específico y práctico.`;

    const respuesta = await llamarOllama(prompt, 
      "Eres un analista de inventarios experto. Analiza patrones de venta y genera predicciones accionables."
    );

    res.json({
      respuesta,
      datos: {
        productos_mas_vendidos: ventasHistoricas.rows,
        stock_bajo: productosStockBajo.rows
      }
    });
  } catch (err) {
    console.error('Error en predicción de demanda:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- ANÁLISIS CREDITICIO ---
app.post('/api/ai/credit-analysis', async (req, res) => {
  const { cliente_id } = req.body;
  
  try {
    const clienteInfo = await pool.query(
      'SELECT * FROM Clientes WHERE id = $1',
      [cliente_id]
    );

    if (clienteInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const historialVentas = await pool.query(`
      SELECT 
        COUNT(*) as total_compras,
        SUM(total) as monto_total,
        AVG(total) as ticket_promedio,
        MAX(fecha) as ultima_compra,
        MIN(fecha) as primera_compra
      FROM Ventas
      WHERE cliente_id = $1
    `, [cliente_id]);

    const cliente = clienteInfo.rows[0];
    const historial = historialVentas.rows[0];

    const prompt = `Analiza el perfil crediticio de este cliente:

DATOS DEL CLIENTE:
- Nombre: ${cliente.nombre}
- Deuda actual: $${cliente.deuda_actual}
- Total de compras: ${historial.total_compras || 0}
- Monto total comprado: $${historial.monto_total || 0}
- Ticket promedio: $${parseFloat(historial.ticket_promedio || 0).toFixed(0)}
- Cliente desde: ${historial.primera_compra || 'Nuevo'}
- Última compra: ${historial.ultima_compra || 'Sin compras'}

Proporciona:
1. Evaluación de riesgo (Bajo/Medio/Alto)
2. Límite de crédito recomendado
3. Estrategia de cobranza si tiene deuda
4. Recomendaciones específicas

Sé objetivo y basado en datos.`;

    const respuesta = await llamarOllama(prompt,
      "Eres un analista de crédito experto. Evalúa riesgos y genera recomendaciones prudentes."
    );

    res.json({
      respuesta,
      datos: {
        cliente: cliente,
        historial: historial
      }
    });
  } catch (err) {
    console.error('Error en análisis crediticio:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- ASISTENTE DE PRECIOS ---
app.post('/api/ai/price-assistant', async (req, res) => {
  try {
    const analisisProductos = await pool.query(`
      SELECT 
        p.nombre,
        p.precio_venta,
        p.stock_actual,
        COUNT(dv.id) as veces_vendido,
        SUM(dv.cantidad * dv.precio_unitario) as ingresos_totales,
        AVG(dv.precio_unitario) as precio_promedio_venta
      FROM Productos p
      LEFT JOIN Detalle_Ventas dv ON p.id = dv.producto_id
      LEFT JOIN Ventas v ON dv.venta_id = v.id
      WHERE v.fecha >= NOW() - INTERVAL '30 days' OR v.fecha IS NULL
      GROUP BY p.id, p.nombre, p.precio_venta, p.stock_actual
      ORDER BY veces_vendido DESC
    `);

    const prompt = `Analiza la estrategia de precios de estos productos:

${analisisProductos.rows.slice(0, 10).map(p => `
Producto: ${p.nombre}
- Precio actual: $${p.precio_venta}
- Stock: ${p.stock_actual} unidades
- Veces vendido (30 días): ${p.veces_vendido || 0}
- Ingresos generados: $${p.ingresos_totales || 0}
`).join('\n---\n')}

Proporciona:
1. Productos con precio óptimo (mantener)
2. Productos subvalorados (aumentar precio)
3. Productos sobrevalorados (reducir precio o promocionar)
4. Estrategia de promoción para productos de baja rotación

Sé específico con porcentajes y justifica cada recomendación.`;

    const respuesta = await llamarOllama(prompt,
      "Eres un experto en pricing y estrategia comercial. Optimiza precios para maximizar rentabilidad."
    );

    res.json({
      respuesta,
      datos: {
        productos_analizados: analisisProductos.rows
      }
    });
  } catch (err) {
    console.error('Error en asistente de precios:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- ANÁLISIS GENERAL DEL NEGOCIO ---
app.post('/api/ai/business-insights', async (req, res) => {
  try {
    const ventasMes = await pool.query(`
      SELECT 
        DATE_TRUNC('day', fecha) as dia,
        COUNT(*) as transacciones,
        SUM(total) as ventas
      FROM Ventas
      WHERE fecha >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', fecha)
      ORDER BY dia DESC
    `);

    const mejoresClientes = await pool.query(`
      SELECT 
        c.nombre,
        COUNT(v.id) as compras,
        SUM(v.total) as total_gastado
      FROM Clientes c
      JOIN Ventas v ON c.id = v.cliente_id
      GROUP BY c.id, c.nombre
      ORDER BY total_gastado DESC
      LIMIT 5
    `);

    const ventasTotales = ventasMes.rows.reduce((sum, dia) => sum + parseFloat(dia.ventas), 0);
    const promedioDiario = ventasTotales / 30;

    const prompt = `Genera un análisis completo del negocio:

RENDIMIENTO ÚLTIMOS 30 DÍAS:
- Ventas totales: $${ventasTotales.toFixed(0)}
- Promedio diario: $${promedioDiario.toFixed(0)}
- Días con ventas: ${ventasMes.rows.length}

MEJORES CLIENTES:
${mejoresClientes.rows.map(c => 
  `- ${c.nombre}: ${c.compras} compras, $${parseFloat(c.total_gastado).toFixed(0)} total`
).join('\n')}

Proporciona:
1. Evaluación general del rendimiento
2. Tendencias identificadas
3. Oportunidades de crecimiento
4. Riesgos o áreas de mejora
5. 3 acciones concretas para el próximo mes`;

    const respuesta = await llamarOllama(prompt,
      "Eres un consultor de negocios experto. Analiza datos y genera insights estratégicos accionables."
    );

    res.json({
      respuesta,
      datos: {
        ventas_mes: ventasMes.rows,
        mejores_clientes: mejoresClientes.rows,
        metricas: {
          ventas_totales: ventasTotales,
          promedio_diario: promedioDiario
        }
      }
    });
  } catch (err) {
    console.error('Error en análisis de negocio:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Iniciar el servidor ---
app.listen(port, () => {
  console.log(`Servidor backend corriendo en http://localhost:${port}`);
});