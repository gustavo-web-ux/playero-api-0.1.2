const { default: axios } = require('axios');
const xml2js = require('xml2js');

const dataOfficeTrack = async (req, res)=>{
    const {poi, name, customernumber} = req.params;
    //Enviar datos a OfficeTrack 
    const soapRequest = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trac="Trackem.Web.Services">
        <soap:Header/>
        <soap:Body>
          <trac:InsertOrUpdatePointOfInterest>
            <trac:userName>tecnoedil</trac:userName>
            <trac:password>8IIyMG!u*6hPxsTk0PgLgNd~Zsn5F~</trac:password>
            <trac:operation>AutoSelect</trac:operation>
            <trac:name>${name}</trac:name>
            <trac:type>Customer </trac:type>
            <trac:data6>Generado por Sistema Playero.</trac:data6>
            <trac:customerNumber>${customernumber}</trac:customerNumber>
            <trac:parentPoi>${poi}</trac:parentPoi>
          </trac:InsertOrUpdatePointOfInterest>
        </soap:Body>
      </soap:Envelope>
    `;

    const soapConfig = {
      method: 'post',
      url: 'https://latam.officetrack.com/services/webservices.asmx',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8'
      },
      data: soapRequest
    };

    // Enviar la solicitud SOAP
    const soapResponse = await axios(soapConfig);
    const responseXml = soapResponse.data;

    // Opcional: Procesar la respuesta del SOAP si es necesario
    const parser = new xml2js.Parser();
    parser.parseString(responseXml, (err, result) => {
      if (err) {
        console.error('Error parsing SOAP response:', err);
      } else {
        console.log('SOAP response parsed successfully:', result);
      }
    });

    res.status(200).json({ message: `${name} agregado exitosamente en POI ${poi}` });
}

module.exports = {
    dataOfficeTrack
  };