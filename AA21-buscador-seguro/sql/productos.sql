-- AA21 - Script de base de datos
-- Ejecutar en phpMyAdmin (pestaña SQL)

CREATE DATABASE IF NOT EXISTS clase_backend
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE clase_backend;

CREATE TABLE IF NOT EXISTS productos (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    nombre    VARCHAR(100)  NOT NULL,
    categoria VARCHAR(50)   NOT NULL,
    precio    DECIMAL(10,2) NOT NULL,
    stock     INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO productos (nombre, categoria, precio, stock) VALUES
    ('Teclado Mecánico RGB',          'Periféricos', 25000.00,  15),
    ('Monitor 24 IPS Full HD',        'Monitores',   135000.00,  8),
    ('Mouse Inalámbrico Ergonómico',  'Periféricos', 18500.00,  20),
    ('Auriculares Gamer 7.1',         'Audio',       42000.00,   5);
