const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// 🔗 Conexión a Supabase (db.js en la raíz)
const supabase = require('./db');

// 📦 Rutas
const authRoutes = require('./routes/authRoutes');
const productosRoutes = require('./routes/productosRoutes');
const cotizacionesRoutes = require('./routes/cotizacionesRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   MIDDLEWARES DE SEGURIDAD
========================= */
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas peticiones desde esta IP, intenta más tarde'
});

app.use('/api/', limiter);

// Parseo de body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   RUTAS
========================= */
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    mensaje: '🔧 API de Lubricadora funcionando correctamente',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      productos: '/api/productos',
      cotizaciones: '/api/cotizaciones'
    }
  });
});

/* =========================
   TEST DE CONEXIÓN SUPABASE (SIN TABLAS)
========================= */
const testDBConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Error Supabase:', error.message);
    } else {
      console.log('✅ Supabase conectado correctamente (SDK responde)');
    }
  } catch (err) {
    console.error('❌ Error crítico:', err.message);
  }
};

/* =========================
   MANEJO DE ERRORES
========================= */
// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    mensaje: `La ruta ${req.originalUrl} no existe en esta API`
  });
});

// Errores generales
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: 'Error del servidor',
    mensaje:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Ha ocurrido un error interno'
  });
});

/* =========================
   INICIAR SERVIDOR
========================= */
app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🔧 Servidor de Lubricadora          ║
║   ✅ Puerto: ${PORT}                   ║
║   🌐 http://localhost:${PORT}          ║
╚═══════════════════════════════════════╝
  `);

  // 🔍 Test de conexión
  await testDBConnection();
});

module.exports = app;
