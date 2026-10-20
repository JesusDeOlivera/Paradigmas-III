-- AA22 - Tabla de usuarios con contraseñas hasheadas (BCRYPT)
-- Ejecutar en phpMyAdmin (pestaña SQL)

CREATE DATABASE IF NOT EXISTS gestion_academica
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE gestion_academica;

CREATE TABLE IF NOT EXISTS usuarios (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    -- Ya NO se guarda la contraseña: se guarda su hash.
    -- VARCHAR(255) es lo recomendado por PHP (un hash BCRYPT ocupa 60, pero el
    -- algoritmo por defecto podría cambiar en el futuro a uno más largo).
    password_hash VARCHAR(255) NOT NULL,
    rol           ENUM('alumno', 'docente', 'administrativo') NOT NULL DEFAULT 'alumno',
    creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuarios de prueba. Contraseña de ambos: Clave2026!
-- (hash generado con password_hash('Clave2026!', PASSWORD_BCRYPT, ['cost' => 12]))
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
    ('Administración Académica', 'admin@ucp.edu.ar',
     '$2y$12$i4usj6Bmw0xy0q4js3KU/eWgKjHIvEp3OVJ0Sm4CNKjbzz7Ian7uy', 'administrativo'),
    -- Usuario con el nombre malicioso del caso: con htmlspecialchars() se muestra como texto
    ('<script>alert(document.cookie)</script>', 'atacante@mail.com',
     '$2y$12$i4usj6Bmw0xy0q4js3KU/eWgKjHIvEp3OVJ0Sm4CNKjbzz7Ian7uy', 'alumno');

-- ------------------------------------------------------------------
-- Migración si la tabla vieja tenía contraseñas en texto plano:
-- no se pueden "hashear" desde SQL con BCRYPT. Se hace con un script PHP
-- que recorre los usuarios y guarda password_hash($passwordPlano), y luego
-- se elimina la columna vieja:
--   ALTER TABLE usuarios DROP COLUMN password;
-- ------------------------------------------------------------------
