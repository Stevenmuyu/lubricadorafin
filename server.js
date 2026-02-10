// server.js completo y corregido
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración básica
app.use(cors());
app.use(express.json());

// --- SOLUCIÓN AL "NOT FOUND" ---
// Esta línea sirve los archivos desde la carpeta principal (raíz)
app.use(express.static(__dirname)); 

// Conexión a Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Ruta para obtener productos
app.get('/api/productos', async (req, res) => {
    try {
        // Consultamos la tabla 'productos'
        const { data, error } = await supabase
            .from('productos') 
            .select('*');

        if (error) throw error;
        
        console.log("Productos enviados al cliente:", data.length);
        res.json(data || []);
    } catch (err) {
        console.error("Error en Supabase:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Ruta para servir el index.html por defecto
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
