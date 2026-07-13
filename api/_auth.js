// api/_auth.js
// Helpers de autenticação compartilhados entre endpoints.
//
// Uso típico:
//   const { authenticate, getUserNivel } = require("./_auth");
//
//   const auth = await authenticate(req);
//   if (!auth.ok) {
//     res.writeHead(auth.status, { ...cors, "Content-Type": "application/json" });
//     res.end(JSON.stringify({ error: auth.error }));
//     return;
//   }
//   const { uid } = auth;
//
//   // Para gates de nível:
//   let nivel;
//   try { nivel = await getUserNivel(uid); }
//   catch (err) { /* 500 — erro de Firestore, não de auth */ }
//
// Importar este módulo é suficiente para inicializar o Firebase Admin.

const admin = require("firebase-admin");

// ── Inicialização do Firebase Admin (uma vez por instância de função) ────────
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      ),
    });
  } catch (err) {
    console.error("Falha ao inicializar Firebase Admin:", err);
  }
}

function getBearerToken(req) {
  return (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
}

/**
 * Verifica o ID token do Firebase presente em Authorization: Bearer <token>.
 *
 * Retorno em sucesso:  { ok: true, uid, decoded }
 * Retorno em falha:    { ok: false, status, error }
 *   • 401 = sem token
 *   • 403 = token inválido/expirado
 *
 * Não lança — caller simplesmente inspeciona `auth.ok`.
 */
async function authenticate(req) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Não autenticado." };
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { ok: true, uid: decoded.uid, decoded };
  } catch (err) {
    return { ok: false, status: 403, error: "Token inválido." };
  }
}

/**
 * Lê usuarios/{uid}.nivel do Firestore. Retorna "NORMAL" se o doc não existir.
 *
 * IMPORTANTE: erros de Firestore (rede, permissão) são PROPAGADOS — o caller
 * precisa tratar (geralmente com 500 "Erro ao verificar permissões"). Isso
 * evita transformar uma falha de infra em um 403 que o frontend interpreta
 * como token ruim e desloga o usuário.
 */
async function getUserNivel(uid) {
  const snap = await admin.firestore().collection("usuarios").doc(uid).get();
  return snap.exists ? (snap.data().nivel || "NORMAL") : "NORMAL";
}

module.exports = { admin, getBearerToken, authenticate, getUserNivel };
