const config = require('../config/env.config');
const axios = require('axios');

describe('Route KPI', () => {
  // for testing in gitlabyaml
  test('GET /api/kpi/list-xml', async () => {
    const response = await axios.get('http://192.168.10.230:6000/api/kpi/list-xml', {
      headers: {
        'x-access-token': config.TOKEN_TEST,
        'Content-Type': 'text/plain'
      }
    });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
  });
});
