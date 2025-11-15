CREATE TABLE Productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo_barras VARCHAR(50) UNIQUE,
    precio_venta NUMERIC(10, 2) NOT NULL,
    stock_actual INTEGER NOT NULL
);

CREATE TABLE Ventas (
    id SERIAL PRIMARY KEY,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total NUMERIC(10, 2) NOT NULL
);

CREATE TABLE Detalle_Ventas (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES Ventas(id),
    producto_id INTEGER NOT NULL REFERENCES Productos(id),
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(10, 2) NOT NULL
);

-- Insertar algunos productos de ejemplo para probar
INSERT INTO Productos (nombre, precio_venta, stock_actual) VALUES
('Coca-Cola 600ml', 3500, 50),
('Papas Margarita Pollo', 2800, 30),
('Chocoramo', 2000, 100);