// server.js - Backend para Lubricadora
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURACIÓN DE MIDDLEWARE ---
app.use(cors());
app.use(express.json());
// Servir archivos estáticos (HTML, CSS, JS del frontend)
app.use(express.static(path.join(__dirname, 'public'))); 

// --- CONEXIÓN CON SUPABASE ---
// Asegúrate de configurar estas variables en el panel de Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ ERROR: Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- RUTAS DE LA API ---

// 1. Obtener todos los productos para el catálogo
app.get('/api/productos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('productos') // Asegúrate de que tu tabla se llame 'productos'
            .select('*');

        if (error) throw error;

        // Enviamos los datos directamente como un array
        res.json(data);
    } catch (err) {
        console.error("Error al obtener productos:", err.message);
        res.status(500).json({ error: "No se pudieron cargar los productos", detalles: err.message });
    }
});

// 2. Obtener un producto por ID (para producto.html)
app.get('/api/productos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(404).json({ error: "Producto no encontrado" });
    }
});

// --- RUTA PARA SERVIR EL FRONTEND ---
// Esto permite que al entrar a la raíz se cargue el index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
