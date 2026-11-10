const express = require('express');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Sistema clinico SIT-Cama funcionando');
});

app.get('/patient', (req, res) => {
    res.json({
        message: 'Modulo de pacientes',
        status: 'OK'
    });
});

app.listen(3000, () => {
    console.log('Servidor iniciado en puerto 3000');
});