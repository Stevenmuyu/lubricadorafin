// RUTA DE LOGIN (Para que tu login.html funcione)
app.post('/api/usuarios/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Buscamos al usuario en la tabla 'usuarios' de Supabase
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .eq('password', password) // Nota: En producción usar bcrypt
            .single();

        if (error || !usuario) {
            return res.status(401).json({ mensaje: "Usuario o contraseña incorrectos" });
        }

        // 2. Si todo está bien, devolvemos los datos del usuario
        // El frontend recibirá esto y lo guardará en localStorage
        res.json({
            mensaje: "Login exitoso",
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol // Asegúrate de que en Supabase la columna se llame 'rol'
            }
        });

    } catch (err) {
        console.error("Error en login:", err.message);
        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});

// Asegúrate de que el servidor sepa dónde está el archivo físico
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
