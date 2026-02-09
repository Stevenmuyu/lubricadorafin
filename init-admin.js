#!/usr/bin/env node

/**
 * Script para crear o resetear el usuario administrador
 * Uso: node init-admin.js
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lubricadora_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const ADMIN_EMAIL = 'admin@lubricadora.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NOMBRE = 'Administrador';

async function crearOActualizarAdmin() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Iniciando proceso de creación/actualización del admin...\n');

    // Generar hash de la contraseña
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log('✅ Hash de contraseña generado correctamente');

    // Verificar si el usuario ya existe
    const checkQuery = 'SELECT id, nombre, email, rol FROM usuarios WHERE email = $1';
    const checkResult = await client.query(checkQuery, [ADMIN_EMAIL]);

    if (checkResult.rows.length > 0) {
      // Usuario existe - Actualizar
      const updateQuery = `
        UPDATE usuarios 
        SET password = $1, rol = $2, nombre = $3
        WHERE email = $4
        RETURNING id, nombre, email, rol
      `;
      const updateResult = await client.query(updateQuery, [
        hashedPassword,
        'admin',
        ADMIN_NOMBRE,
        ADMIN_EMAIL
      ]);

      console.log('\n✅ Usuario admin actualizado exitosamente:');
      console.log('─────────────────────────────────────────');
      console.log(`📧 Email:    ${updateResult.rows[0].email}`);
      console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
      console.log(`👤 Nombre:   ${updateResult.rows[0].nombre}`);
      console.log(`⚡ Rol:      ${updateResult.rows[0].rol}`);
      console.log(`🆔 ID:       ${updateResult.rows[0].id}`);
      console.log('─────────────────────────────────────────');
    } else {
      // Usuario no existe - Crear
      const insertQuery = `
        INSERT INTO usuarios (nombre, email, password, rol)
        VALUES ($1, $2, $3, $4)
        RETURNING id, nombre, email, rol
      `;
      const insertResult = await client.query(insertQuery, [
        ADMIN_NOMBRE,
        ADMIN_EMAIL,
        hashedPassword,
        'admin'
      ]);

      console.log('\n✅ Usuario admin creado exitosamente:');
      console.log('─────────────────────────────────────────');
      console.log(`📧 Email:    ${insertResult.rows[0].email}`);
      console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
      console.log(`👤 Nombre:   ${insertResult.rows[0].nombre}`);
      console.log(`⚡ Rol:      ${insertResult.rows[0].rol}`);
      console.log(`🆔 ID:       ${insertResult.rows[0].id}`);
      console.log('─────────────────────────────────────────');
    }

    console.log('\n🎉 Proceso completado exitosamente!');
    console.log('💡 Puedes iniciar sesión con estas credenciales en http://localhost:3000/login\n');

  } catch (error) {
    console.error('\n❌ Error al crear/actualizar admin:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Verifica que PostgreSQL esté corriendo y las credenciales en .env sean correctas');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
crearOActualizarAdmin();