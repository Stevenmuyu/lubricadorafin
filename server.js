require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Sirve archivos desde la raíz

// Conexión a Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- RUTAS DE API ---

// 1. Obtener productos (Formato compatible con tu Catálogo)
app.get('/api/productos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('*');

        if (error) throw error;
        res.json(data); // Envía el array directo
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Login de usuarios
app.post('/api/usuarios/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (error || !usuario) {
            return res.status(401).json({ mensaje: "Credenciales incorrectas" });
        }

        res.json({
            mensaje: "Acceso correcto",
            usuario: usuario,
            token: "session_token_mock" // Token simple para no complicar el deploy
        });
    } catch (err) {
        res.status(500).json({ mensaje: "Error en el servidor" });
    }
});

// --- RUTAS PARA LAS PÁGINAS (Evita el Not Found) ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/Catalogo.html', (req, res) => res.sendFile(path.join(__dirname, 'Catalogo.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando en puerto ${PORT}`);
});
