require('dotenv').config(); 
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_lubricadora_2026';

// ==========================================
// 1. CONFIGURACIÓN DE CONEXIÓN
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Verificación de conexión mejorada
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Error de conexión a Supabase:', err.message);
    }
    console.log('✅ Conexión establecida y lista para operar');
    release();
});

// ==========================================
// 2. MIDDLEWARES
// ==========================================
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'Acceso denegado' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ error: 'Token inválido' });
        req.usuario = user;
        next();
    });
};

const esAdmin = (req, res, next) => {
    if (req.usuario && req.usuario.rol === 'admin') next();
    else res.status(403).json({ error: 'Permisos insuficientes' });
};

// ==========================================
// 3. RUTAS DE LA API (CORREGIDAS)
// ==========================================

// PRODUCTOS - Ajustado para enviar el array directo
app.get('/api/productos', async (req, res) => {
    try {
        const { tipo, marca } = req.query;
        let query = 'SELECT * FROM productos WHERE activo = true';
        const valores = [];
        let contador = 1;

        if (tipo && tipo !== 'Todas') {
            query += ` AND tipo = $${contador}`;
            valores.push(tipo);
            contador++;
        }
        if (marca && marca !== 'Todas las marcas') {
            query += ` AND marca ILIKE $${contador}`;
            valores.push(`%${marca}%`);
            contador++;
        }

        query += ' ORDER BY creado_en DESC';
        const resultado = await pool.query(query, valores);
        
        // Enviamos el array directamente para que el frontend lo lea sin errores
        res.json(resultado.rows); 
    } catch (e) {
        console.error('❌ Error en DB:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// LOGIN (Texto plano como pediste)
app.post('/api/usuarios/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const resUser = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const usuario = resUser.rows[0];

        if (usuario && usuario.password === password) {
            const { password: _, ...datos } = usuario;
            const token = jwt.sign(datos, JWT_SECRET, { expiresIn: '24h' });
            res.json({ usuario: datos, token });
        } else {
            res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }
    } catch (e) { res.status(500).json({ mensaje: e.message }); }
});

// COTIZACIONES
app.post('/api/cotizaciones', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { usuario_id, nombre_cliente, email_cliente, items } = req.body;
        
        const resCot = await client.query(
            `INSERT INTO cotizaciones (usuario_id, nombre_cliente, email_cliente) 
             VALUES ($1, $2, $3) RETURNING id`,
            [usuario_id, nombre_cliente, email_cliente]
        );
        
        const cotId = resCot.rows[0].id;
        for (const item of items) {
            await client.query(
                `INSERT INTO cotizacion_items (cotizacion_id, producto_id, cantidad, precio_unitario) 
                 VALUES ($1, $2, $3, $4)`,
                [cotId, item.producto_id, item.cantidad, item.precio_unitario]
            );
        }
        
        await client.query('COMMIT');
        res.status(201).json({ mensaje: 'Cotización creada', id: cotId });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ mensaje: e.message });
    } finally { client.release(); }
});

// ==========================================
// 4. SERVIR ARCHIVOS
// ==========================================
app.use(express.static(__dirname));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No encontrado' });
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Puerto: ${PORT}`));
