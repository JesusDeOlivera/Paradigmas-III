-- =========================================================
-- RN Inmobiliaria — Base de datos (Paso 1: Capa de Datos)
-- Ejecutar completo en phpMyAdmin → pestaña SQL
-- =========================================================

CREATE DATABASE IF NOT EXISTS rn_inmobiliaria
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE rn_inmobiliaria;

-- ---------------------------------------------------------
-- Usuarios del sitio (clientes y agentes)
-- password es VARCHAR(255) para guardar el hash BCRYPT
-- (password_hash genera 60 caracteres; 255 deja margen si
--  en el futuro se cambia a un algoritmo con hash más largo)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    nombre     VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    rol        ENUM('cliente', 'agente') NOT NULL DEFAULT 'cliente',
    creado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- Propiedades favoritas de cada usuario (dato privado)
-- propiedad_id corresponde al "id" de data/propiedades.json
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS favoritos (
    usuario_id   INT         NOT NULL,
    propiedad_id VARCHAR(50) NOT NULL,
    creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, propiedad_id),
    CONSTRAINT fk_favoritos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- Cuentas de prueba (las mismas que tenía data/usuarios.json,
-- ahora con la contraseña hasheada con BCRYPT)
--   ana@rninmobiliaria.com     / tierraroja26
--   rodrigo@rninmobiliaria.com / posadas2026
-- ---------------------------------------------------------
INSERT INTO usuarios (nombre, email, password, rol) VALUES
    ('Ana Benítez',   'ana@rninmobiliaria.com',
     '$2y$10$5VVCThW2SC6TkKLVgaO5Du9M/VwdWXaBHaWiWGBkQYiyCB23Cpvty', 'cliente'),
    ('Rodrigo Núñez', 'rodrigo@rninmobiliaria.com',
     '$2y$10$FKQkvWtL3c4TxNQhsoQ6J.Qqg7Lpfb7oYy5XfwIzlc1SAj0iQOdhK', 'agente');

INSERT INTO favoritos (usuario_id, propiedad_id) VALUES
    (1, 'villa-sarita');
