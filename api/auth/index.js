const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

const client = jwksClient({
  jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.publicKey || key.rsaPublicKey);
  });
}

async function validateToken(req) {
  return new Promise((resolve, reject) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(new Error('No token provided'));
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, getKey, {
      audience: process.env.AZURE_CLIENT_ID,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) return reject(err);
      resolve({
        userId: decoded.oid,
        tenantId: decoded.tid,
        name: decoded.name,
        email: decoded.preferred_username
      });
    });
  });
}

module.exports = { validateToken };