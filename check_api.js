const axios = require('axios');

async function check() {
    console.log('Testando Endpoint /me...');
    try {
        // Teste direto no endpoint /me sem auth
        // O esperado é 401 Unauthorized. Se der 404, algo muito estranho acontece.
        const res = await axios.get('https://steamverde.net/wp-json/steamverde/v1/me');
        console.log('Status /me:', res.status);
        console.log('Data:', res.data);
    } catch (e) {
        console.log('Erro no /me:');
        console.log('Status:', e.response ? e.response.status : 'Sem resposta');
        console.log('Dados:', e.response ? JSON.stringify(e.response.data) : e.message);
    }
}

check();
