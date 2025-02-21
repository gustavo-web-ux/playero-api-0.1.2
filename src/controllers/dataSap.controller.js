const { getConnection, sql } = require('../database/init');
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
    rejectUnauthorized: false
});

const getUrl = async (sucursal) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_suc', sql.Int, sucursal)
            .query('SELECT * FROM sucursal s JOIN config_sap c ON s.id_config_sap = c.id WHERE s.id_sucursal = @id_suc');

        if (result.recordset.length === 0) {
            console.error('No se encontró una URL activa');
            return null;
        }

        const { url } = result.recordset[0];
        if (!url) {
            console.error('La URL no está disponible en el registro');
            return null;
        }

        return url;
    } catch (error) {
        console.error('Error al obtener la URL:', error);
        return null;
    } 
};

const fetchingToken = async (user, contrasena, url) => {
    try {
        const response1 = await axios.get(url, {
            httpsAgent: agent,
            auth: {
                username: user,
                password: contrasena
            },
            headers: {
                'X-CSRF-Token': 'Fetch'
            }
        });
        const xDataToken = response1.headers['x-csrf-token'];
        const setCookie = response1.headers['set-cookie'];

        if (!xDataToken) {
            throw new Error('No se pudo obtener el CSRF token');
        }

        return {
            xDataToken,
            setCookie
        };
    } catch (err) {
        console.error('fetchingToken error: ', err.message);
        throw err;
    }
};

const dataSap = async (req, res) => {
    try {
        const { fecha, bodega, sucursal } = req.body;

        const url = await getUrl(sucursal);  // Obtén la URL de forma asincrónica
        if (!url) {
            return res.status(404).json({ message: 'No se encontró la URL' });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input('id_bod', sql.Int, bodega)
            .input('fecha', sql.VarChar, fecha)
            .input('id_suc', sql.Int, sucursal)
            .query(`SELECT t.*, c.cod_sistema,
                        case 
                    when b.otro_centro = 1 then b.centro
                    else s.codigo_sucursal end as codigo_sucursal , b.codigo_bodega, con.indice_pep, con.centro_costo
                    FROM ticket_surtidor t
                        JOIN combustible c ON t.id_com = c.id_combustible
                        JOIN sucursal s ON t.id_suc = s.id_sucursal
                        JOIN bodega b ON t.id_bod = b.id_bod
                        JOIN config_vehiculo con ON t.id_suc = con.id_sucursal AND t.id_equipo = con.id_vehiculo
                    WHERE t.id_bod = @id_bod AND t.id_suc = @id_suc AND t.fecha = @fecha AND sync <> 1 and (indice_pep is not null or centro_costo is not null)
                    
                    `);
        const tickets = result.recordset;
        if (tickets.length === 0) {
            console.error('No se encontraron tickets');
            return res.status(404).json({ message: 'No se encontraron tickets' });
        }

        const userResult = await pool.request()
            .query('SELECT [user], contrasena FROM config_sap WHERE activo = 1');

        if (userResult.recordset.length === 0) {
            console.error('No se encontró un usuario activo');
            return res.status(404).json({ message: 'No se encontró un usuario activo' });
        }

        const user = userResult.recordset[0].user;
        const contrasena = userResult.recordset[0].contrasena;

        const { xDataToken, setCookie } = await fetchingToken(user, contrasena, url);

        const ticketResponses = [];
        for (const ticket of tickets) {
            try {
                const sapPayload = [
                    {
                        "ZTICKET": ticket.id_ticket,
                        "ZHDRTXT": ticket.observaciones_ticket,
                        "ZFCREACION": ticket.fecha,
                        "ZFCONT": ticket.fecha,
                        "ZHORAREG": ticket.hora,
                        "ZCLIENTE": ticket.ruc_cliente,
                        "ZCEDULA": ticket.id_operador,
                        "ZMATNR": ticket.cod_sistema,
                        "ZWERKS": ticket.codigo_sucursal,
                        "ZLGORT": ticket.codigo_bodega,
                        "ZMENGE": ticket.litros,
                        "ZHOROM": ticket.horometro || 0,
                        "ZKILOMETRAJE": ticket.kilometro || 0,
                        "ZPEP": ticket.indice_pep || '',
                        "ZEQUNR": ticket.id_equipo,
                        "ZCOSTCENTER": ticket.centro_costo || '',
                        "ZPATENTE": ticket.id_equipo,
                        "ZBORRADO": "",
                        "ZDOC_MATERIAL": "",
                        "ZANO": 0,
                        "ZMENSAJE": ""
                    }
                ];
                console.log('Enviando ticket:', sapPayload);
                const response = await axios.post(url, sapPayload, {
                    httpsAgent: agent,
                    auth: {
                        username: user,
                        password: contrasena
                    },
                    headers: {
                        'X-CSRF-Token': xDataToken,
                        'Content-Type': 'application/json',
                        'Cookie': setCookie
                    }
                });

                ticketResponses.push({
                    id_ticket: ticket.id_ticket,
                    id_operador: ticket.id_operador,
                    kilometro: ticket.kilometro,
                    horometro: ticket.horometro,
                    litros: ticket.litros,
                    fecha: ticket.fecha,
                    precio: ticket.precio,
                    sapResponse: response.data
                });

                console.log(`Ticket ${ticket.id_ticket} enviado con respuesta:`, response.data);

                if (response.data[0].CODE === '00') {
                    const updateTicket = await pool.request()  
                        .input('id_ticket', sql.Numeric(25, 0), ticket.id_ticket) 
                        .query('UPDATE ticket_surtidor SET sync = 1 WHERE id_ticket = @id_ticket');

                    console.log(`Ticket ${updateTicket} actualizado en la BD`);
                }

            } catch (error) {
                console.error(`Error enviando ticket ${ticket.id_ticket}:`, error.message);
                throw error;
            }
        }

        res.status(200).json({
            message: 'Tickets enviados a SAP',
            ticketsResponses: ticketResponses
        });

    } catch (err) {
        console.error('Error en el servidor:', err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

module.exports = { dataSap };