// api/generate-model-ia.js
// Gera um modelo de contrato de aluguel usando Gemini AI (apenas PREMIUM/ADMIN)
// Usa o módulo https nativo do Node para evitar problemas de compatibilidade com fetch.

const https = require("https");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Chamada HTTPS ao Gemini sem depender de fetch ──────────────────────────────
function geminiPost(apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const path = `/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`;
    const options = {
      hostname: "generativelanguage.googleapis.com",
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── Prompt para o Gemini ────────────────────────────────────────────────────────
// O contrato gerado usa as {{variáveis}} do sistema, não valores reais.
// O tipo de imóvel é o único parâmetro opcional (residencial por padrão).
function buildPrompt(tipoImovel) {
  const tipo = tipoImovel || "residencial";

  return `Você é um especialista jurídico em contratos de locação no Brasil.

Gere um contrato de locação ${tipo} completo, formal e juridicamente válido, em HTML simples (apenas o conteúdo interno — use <h2>, <h3>, <p>, <br>, <strong>, <u> — sem <html>, <head>, <body>).

**REGRAS OBRIGATÓRIAS:**
1. Substitua TODOS os campos variáveis pelas variáveis do sistema abaixo. Use-as EXATAMENTE (sem alterar a grafia) onde elas se aplicam:
   - Inquilino (LOCATÁRIO): {{nome_inquilino}}, {{rg_inquilino}}, {{cpf_inquilino}}, {{data_nascimento_inquilino}}, {{email_inquilino}}, {{telefone_inquilino}}
   - Imóvel: {{logradouro_imovel}}, {{numero_imovel}}, {{complemento_imovel}}, {{bairro_imovel}}, {{cidade_imovel}}, {{estado_imovel}}, {{cep_imovel}}, {{num_comodos}}, {{endereco_completo}}
   - Contrato: {{data_contrato}}, {{data_inicio}}, {{data_fim}}, {{valor_aluguel}}, {{dia_vencimento}}, {{duracao_meses}}
   - Proprietário (LOCADOR): {{nome_proprietario}}, {{cpf_proprietario}}
2. NÃO invente dados como nomes, CPFs, endereços ou datas — use APENAS as variáveis acima.
3. O contrato deve ter no mínimo 15 cláusulas, cobrindo: identificação das partes, objeto, prazo, valor e reajuste (IGP-M/IPCA), forma de pagamento, obrigações do locatário, obrigações do locador, benfeitorias, rescisão antecipada, multa rescisória, garantia, vistoria inicial, sublocação, foro e disposições gerais.
4. Use a Lei 8.245/91 (Lei do Inquilinato) como base jurídica.
5. Use "concessionárias de serviços públicos" no lugar de nomes de empresas (Sabesp, Enel etc.).
6. Use {{cidade_imovel}} no foro de eleição (nunca nomeie uma cidade real).
7. Inclua ao final um bloco de assinaturas: LOCADOR ({{nome_proprietario}}), LOCATÁRIO ({{nome_inquilino}}) e duas linhas para testemunhas.
8. Responda SOMENTE com o HTML puro, sem explicações, sem blocos de código markdown, sem nenhum texto antes ou depois do HTML.`;
}

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Método não permitido." }));
    return;
  }

  if (!GEMINI_API_KEY) {
    res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Chave da API Gemini não configurada no servidor." }));
    return;
  }

  const { tipoImovel, nivelUsuario } = req.body || {};

  // Só PREMIUM ou ADMIN podem usar
  if (!["PREMIUM", "ADMIN"].includes(nivelUsuario)) {
    res.writeHead(403, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Recurso disponível apenas para usuários PREMIUM." }));
    return;
  }

  try {
    const geminiBody = {
      contents: [{ parts: [{ text: buildPrompt(tipoImovel) }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    };

    const result = await geminiPost(GEMINI_API_KEY, geminiBody);

    if (result.status < 200 || result.status >= 300) {
      console.error("Gemini error status:", result.status, result.body);

      let mensagem = "Erro ao chamar a API Gemini.";

      if (result.status === 429) {
        // Tenta extrair o retryDelay da resposta do Gemini para informar o usuário
        let segundos = 60;
        try {
          const errData = JSON.parse(result.body);
          const retryInfo = errData?.error?.details?.find(d => d["@type"]?.includes("RetryInfo"));
          if (retryInfo?.retryDelay) {
            const match = retryInfo.retryDelay.match(/^(\d+)/);
            if (match) segundos = Math.ceil(parseInt(match[1], 10)) + 5;
          }
        } catch (_) { /* usa default 60s */ }
        mensagem = `Muitas requisições em sequência. Aguarde ${segundos} segundos e tente novamente.`;
      } else if (result.status === 404) {
        mensagem = "Modelo de IA indisponível. Tente novamente mais tarde.";
      } else if (result.status === 401 || result.status === 403) {
        mensagem = "Chave de API inválida ou sem permissão.";
      }

      const statusParaCliente = [429, 401, 403].includes(result.status) ? result.status : 502;
      res.writeHead(statusParaCliente, { ...CORS_HEADERS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: mensagem }));
      return;
    }

    const data = JSON.parse(result.body);
    const html = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!html) {
      res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "A IA não retornou conteúdo." }));
      return;
    }

    // Remove eventuais blocos markdown que o Gemini às vezes retorna
    const htmlLimpo = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    res.writeHead(200, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ html: htmlLimpo }));
  } catch (err) {
    console.error("Erro generate-model-ia:", err);
    res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Erro interno do servidor.", detalhes: err.message }));
  }
};
