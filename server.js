require('dotenv').config(); 
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_lubricadora_2026';

// ==========================================
// 1. CONFIGURACIÓN DE CONEXIÓN (CORREGIDO)
// ==========================================
const pool = new Pool({
    // Priorizamos la variable de entorno de Render
    connectionString: process.env.DATABASE_URL, 
    ssl: { 
        rejectUnauthorized: false // Obligatorio para Supabase en Render
    }
});

// Verificación de conexión inicial
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error('❌ Error de conexión a la DB:', err.message);
    else console.log('✅ Conexión a Supabase establecida correctamente');
});

// ==========================================
// 2. LÓGICA DE MODELOS
// ==========================================
const Modelos = {
    Usuario: {
        async crear(datos) {
            const { nombre, email, password, rol, telefono, empresa } = datos;
            const res = await pool.query(
                `INSERT INTO usuarios (nombre, email, password, rol, telefono, empresa) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, email, rol, telefono, empresa`,
                [nombre, email, password, rol || 'cliente', telefono || null, empresa || null]
            );
            return res.rows[0];
        },
        async obtenerPorEmail(email) {
            const res = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
            return res.rows[0];
        }
    },
    Producto: {
        async listar(filtros = {}) {
            let query = 'SELECT * FROM productos WHERE 1=1'; 
            const valores = [];
            let contador = 1;

            if (filtros.tipo && filtros.tipo !== 'Todas') { 
                query += ` AND tipo = $${contador}`; 
                valores.push(filtros.tipo); 
                contador++; 
            }
            if (filtros.marca && filtros.marca !== 'Todas las marcas') { 
                query += ` AND marca ILIKE $${contador}`; 
                valores.push(`%${filtros.marca}%`); 
                contador++; 
            }
            
            query += ' ORDER BY id DESC'; 
            const res = await pool.query(query, valores);
            return res.rows;
        }
    }
};

// ==========================================
// 3. RUTAS DE LA API (DEBEN IR ANTES QUE EL STATIC '*')
// ==========================================

app.get('/api/productos', async (req, res) => {
    try {
        const productos = await Modelos.Producto.listar(req.query);
        console.log(`📦 DB enviando ${productos.length} productos`);
        res.json(productos); 
    } catch (e) { 
        console.error("❌ Error API:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/usuarios/registro', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        const existente = await Modelos.Usuario.obtenerPorEmail(email);
        if (existente) return res.status(409).json({ mensaje: 'El correo ya existe' });
        const nuevo = await Modelos.Usuario.crear(req.body);
        const { password: _, ...usuarioSinPassword } = nuevo;
        const token = jwt.sign(usuarioSinPassword, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ usuario: usuarioSinPassword, token });
    } catch (e) { res.status(500).json({ mensaje: e.message }); }
});

app.post('/api/usuarios/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const usuario = await Modelos.Usuario.obtenerPorEmail(email);
        if (usuario && usuario.password === password) {
            const { password: _, ...datos } = usuario;
            const token = jwt.sign(datos, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ usuario: datos, token });
        } else {
            return res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }
    } catch (e) { res.status(500).json({ mensaje: e.message }); }
});

// ==========================================
// 4. ARCHIVOS ESTÁTICOS Y MANEJO DE RUTAS
// ==========================================

// Servir archivos de la carpeta raíz
app.use(express.static(__dirname));

// Esta ruta debe ser la ÚLTIMA siempre
app.get('*', (req, res) => {
    // Si la ruta comienza con /api y llegó aquí, es que la ruta de la API no existe
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Ruta de API no encontrada' });
    }
    // Para cualquier otra ruta (como /Catalogo.html), enviamos el archivo
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
