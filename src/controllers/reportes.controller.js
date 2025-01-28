const { getConnection, sql } = require('../database/init');

const litros = {
    tanques: async (req, res) => {
        try {
            const { id_sucursal, id_bod, fecha_hora} = req.params;
            console.log(id_sucursal, id_bod, fecha_hora)
            const pool = await getConnection();
            const result = await pool.request()
                .input('id_sucursal', sql.Int, id_sucursal)
                .input('id_bod', sql.Int, id_bod)
                .input('fecha_hora', sql.VarChar, fecha_hora)
                .query(`select m1.id_suc, m1.id_bod, m1.fecha_hora, m1.litros as litros_inicial, m2.litros as litros_final 
                            from med_inicio_cierre m1 
                            left JOIN med_inicio_cierre m2 on m1.id_suc= m2.id_suc and m1.id_bod= m2.id_bod 
                            and m1.fecha_hora= m2.fecha_hora 
                            where m1.tipo=1 and m2.tipo=2 and m1.id_suc = @id_sucursal
                            and m1.id_bod=@id_bod and m1.fecha_hora= @fecha_hora`);
        res.status(200).json(result.recordset);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al obtener los litros del día X' });
        }
    }
};

const taxilitros = {
    
}

module.exports = litros;
