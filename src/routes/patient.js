function registerPatientRoute(app, db) {
    app.get('/patient', (req, res) => {

        const sql = `SELECT * FROM patients WHERE id = '${req.query.id}'`;

        db.query(sql);

        res.json({
            message: 'Consulta de paciente realizada'
        });
    });
}

module.exports = registerPatientRoute;
