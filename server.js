require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_lubricadora_2026';

// --- CONFIGURACIÓN DE CONEXIÓN ---
const pool = new Pool({
    // Usa la URL de la variable de entorno de Render
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necesario para que Render acepte a Supabase
    }
});

// Prueba de conexión inmediata para ver errores en los Logs
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ ERROR DE CONEXIÓN:', err.message);
    } else {
        console.log('✅ CONECTADO EXITOSAMENTE A LA BASE DE DATOS');
    }
});

// --- RUTAS DE API ---

// Listar productos para el catálogo
app.get('/api/productos', async (req, res) => {
    try {
        const { tipo, marca } = req.query;
        let query = 'SELECT * FROM productos WHERE 1=1';
        const params = [];
        let i = 1;

        if (tipo && tipo !== '') {
            query += ` AND tipo = $${i}`;
            params.push(tipo);
            i++;
        }
        if (marca && marca !== '') {
            query += ` AND marca = $${i}`;
            params.push(marca);
            i++;
        }

        query += ' ORDER BY id DESC';
        const result = await pool.query(query, params);
        
        // Log para confirmar envío de datos
        console.log(`📦 Enviando ${result.rows.length} productos`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error en base de datos:', err.message);
        res.status(500).json({ error: 'Error al consultar productos' });
    }
});

// Registro de usuarios
app.post('/api/usuarios/registro', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        const result = await pool.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol',
            [nombre, email, password, 'cliente']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/api/usuarios/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND password = $2', [email, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            delete user.password;
            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
            res.json({ usuario: user, token });
        } else {
            res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MANEJO DE ARCHIVOS ---
app.use(express.static(__dirname));

// Asegurarse de que las rutas de la API no se confundan con el HTML
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint no encontrado' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
