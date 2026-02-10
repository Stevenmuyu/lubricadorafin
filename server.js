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
    // Se prioriza la variable de entorno DATABASE_URL de Render
    connectionString: process.env.DATABASE_URL || `postgresql://postgres:OvISzjCIZVyqbNVn@db.wsjtbqsteemsktfmgexj.supabase.co:5432/postgres`,
    ssl: { 
        rejectUnauthorized: false // Vital para evitar el error de conexión en Render
    }
});

const verificarConexion = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log(`✅ Conexión exitosa a Supabase: ${res.rows[0].now}`);
    } catch (err) {
        console.error('❌ Error crítico: No se pudo conectar a Supabase', err.message);
    }
};
verificarConexion();

// ==========================================
// 2. MIDDLEWARES (Seguridad y Roles)
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
    if (req.usuario && req.usuario.rol === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso restringido: requiere permisos de administrador' });
    }
};

// ==========================================
// 3. LÓGICA DE MODELOS (Sin Bcrypt)
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
            let query = 'SELECT * FROM productos WHERE activo = true';
            const valores = [];
            let contador = 1;
            if (filtros.tipo && filtros.tipo !== 'Todas') { query += ` AND tipo = $${contador}`; valores.push(filtros.tipo); contador++; }
            if (filtros.marca && filtros.marca !== 'Todas las marcas') { query += ` AND marca ILIKE $${contador}`; valores.push(`%${filtros.marca}%`); contador++; }
            if (filtros.viscosidad) { query += ` AND viscosidad = $${contador}`; valores.push(filtros.viscosidad); contador++; }
            if (filtros.busqueda) { query += ` AND (nombre ILIKE $${contador} OR descripcion ILIKE $${contador})`; valores.push(`%${filtros.busqueda}%`); contador++; }
            query += ' ORDER BY creado_en DESC';
            const res = await pool.query(query, valores);
            return res.rows;
        },
        async descontarStock(client, id, cantidad) {
            const prod = await client.query('SELECT stock FROM productos WHERE id = $1', [id]);
            if (prod.rows.length === 0 || prod.rows[0].stock < cantidad) throw new Error(`Stock insuficiente para el ID ${id}`);
            await client.query('UPDATE productos SET stock = stock - $1 WHERE id = $2', [cantidad, id]);
        }
    },
    Cotizacion: {
        async crear(datos, items) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const { usuario_id, nombre_cliente, email_cliente, telefono_cliente, empresa_cliente, notas } = datos;
                const resCot = await client.query(
                    `INSERT INTO cotizaciones (usuario_id, nombre_cliente, email_cliente, telefono_cliente, empresa_cliente, notas) 
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                    [usuario_id, nombre_cliente, email_cliente, telefono_cliente, empresa_cliente, notas]
                );
                const cotizacion = resCot.rows[0];
                let total = 0;
                for (const item of items) {
                    const subtotal = item.cantidad * item.precio_unitario;
                    total += subtotal;
                    await client.query(
                        `INSERT INTO cotizacion_items (cotizacion_id, producto_id, cantidad, precio_unitario, subtotal) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [cotizacion.id, item.producto_id, item.cantidad, item.precio_unitario, subtotal]
                    );
                }
                await client.query('UPDATE cotizaciones SET total = $1 WHERE id = $2', [total, cotizacion.id]);
                await client.query('COMMIT');
                return { ...cotizacion, total };
            } catch (e) { 
                await client.query('ROLLBACK'); 
                throw e; 
            } finally { client.release(); }
        }
    }
};

// ==========================================
// 4. RUTAS DE LA API
// ==========================================

// REGISTRO
app.post('/api/usuarios/registro', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        if (!nombre || !email || !password) return res.status(400).json({ mensaje: 'Datos incompletos' });
        const existente = await Modelos.Usuario.obtenerPorEmail(email);
        if (existente) return res.status(409).json({ mensaje: 'El correo ya existe' });
        const nuevo = await Modelos.Usuario.crear(req.body);
        const { password: _, ...usuarioSinPassword } = nuevo;
        const token = jwt.sign(usuarioSinPassword, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ usuario: usuarioSinPassword, token });
    } catch (e) { res.status(500).json({ mensaje: e.message }); }
});

// LOGIN
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

// PRODUCTOS (Ajustado para devolver array directamente si es necesario)
app.get('/api/productos', async (req, res) => {
    try {
        const productos = await Modelos.Producto.listar(req.query);
        res.json({ productos }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// COTIZACIONES
app.post('/api/cotizaciones', async (req, res) => {
    try {
        const { nombre_cliente, email_cliente, items } = req.body;
        if (!nombre_cliente || !email_cliente || !items?.length) return res.status(400).json({ mensaje: 'Datos incompletos' });
        const cotizacion = await Modelos.Cotizacion.crear(req.body, items);
        res.status(201).json({ cotizacion });
    } catch (e) { res.status(500).json({ mensaje: e.message }); }
});

// GESTIÓN DE ESTADOS (ADMIN)
app.patch('/api/cotizaciones/:id/estado', verificarToken, esAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { estado, comentario } = req.body;
        const { id } = req.params;
        await client.query('BEGIN');
        const cotRes = await client.query('SELECT * FROM cotizaciones WHERE id = $1', [id]);
        if (!cotRes.rows[0]) return res.status(404).json({ mensaje: 'No encontrada' });
        if (estado === 'pagado' && cotRes.rows[0].estado !== 'pagado') {
            const items = await client.query('SELECT * FROM cotizacion_items WHERE cotizacion_id = $1', [id]);
            for (const item of items.rows) {
                await Modelos.Producto.descontarStock(client, item.producto_id, item.cantidad);
            }
        }
        await client.query('UPDATE cotizaciones SET estado = $1 WHERE id = $2', [estado, id]);
        await client.query(
            'INSERT INTO historial_cotizaciones (cotizacion_id, estado_nuevo, usuario_modificador_id, comentario) VALUES ($1, $2, $3, $4)',
            [id, estado, req.usuario.id, comentario]
        );
        await client.query('COMMIT');
        res.json({ mensaje: 'Estado actualizado' });
    } catch (e) { 
        await client.query('ROLLBACK'); 
        res.status(500).json({ mensaje: e.message }); 
    } finally { client.release(); }
});

// ESTADÍSTICAS (ADMIN)
app.get('/api/admin/estadisticas', verificarToken, esAdmin, async (req, res) => {
    try {
        const stats = await pool.query(`SELECT COUNT(*) as total, SUM(total) as ingresos FROM cotizaciones`);
        const top = await pool.query(`
            SELECT p.nombre, COUNT(ci.id) as veces 
            FROM productos p 
            JOIN cotizacion_items ci ON p.id = ci.producto_id 
            GROUP BY p.id 
            ORDER BY veces DESC 
            LIMIT 5
        `);
        res.json({ resumen: stats.rows[0], productosMasCotizados: top.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 5. ARCHIVOS ESTÁTICOS Y REDIRECCIÓN (CORREGIDO)
// ==========================================
app.use(express.static(__dirname));

// Se evita que las peticiones de API se redirijan al HTML
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API no encontrada' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
});

