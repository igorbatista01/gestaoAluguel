// api/_cors.js
// Helper de CORS compartilhado pelos endpoints da API.
//
// Allowlist via env:
//   ALLOWED_ORIGINS="https://app.example.com,https://preview.example.com"
//   (aceita também o singular ALLOWED_ORIGIN por compatibilidade)
//
// Regras:
//   • Em dev (NODE_ENV !== "production") inclui http://localhost:5173 automaticamente.
//   • Em prod, SÓ as origens listadas entram no Access-Control-Allow-Origin.
//   • Se a origem não está na lista, o header ACAO simplesmente não é enviado —
//     requests same-origin continuam funcionando (SOP cobre), requests
//     cross-origin são bloqueados pelo browser.
//   • Nunca responde `*` como ACAO (credenciais/tokens Bearer exigem origem explícita).

const PROD = process.env.NODE_ENV === "production";

function getAllowlist() {
  const raw = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "";
  const lista = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Conveniência em dev — nunca em produção.
  if (!PROD && !lista.includes("http://localhost:5173")) {
    lista.push("http://localhost:5173");
  }
  return lista;
}

function corsHeaders(req) {
  const origin = req.headers && req.headers.origin;
  const allow = getAllowlist();

  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && allow.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// Copia os headers de CORS para a resposta via setHeader.
// Útil em handlers estilo Express (res.status().json()).
function applyCors(req, res) {
  const h = corsHeaders(req);
  for (const k of Object.keys(h)) {
    res.setHeader(k, h[k]);
  }
}

// Se for preflight (OPTIONS), responde 204 e retorna true.
// Caso contrário, retorna false — o handler continua normalmente.
function handlePreflight(req, res) {
  if (req.method !== "OPTIONS") return false;
  const h = corsHeaders(req);
  res.writeHead(204, h);
  res.end();
  return true;
}

module.exports = { corsHeaders, applyCors, handlePreflight };
