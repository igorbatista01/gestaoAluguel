// api/generate-model-ia.js
// Gera um modelo de contrato de aluguel usando Gemini AI (apenas PREMIUM/ADMIN)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function buildPrompt({ tipoImovel, cidade, numComodos, nomeProprietario }) {
  const tipo = tipoImovel || "residencial";
  const local = cidade || "cidade";
  const comodos = numComodos || "";
  const prop = nomeProprietario || "";

  return `Você é um especialista jurídico em contratos de locação residencial no Brasil.

Gere um contrato de locação residencial completo, formal e juridicamente válido, em HTML simples (sem <html>, <head>, <body> — apenas o conteúdo interno, usando <h2>, <p>, <br> e <strong>).

**Dados do imóvel:**
- Tipo: ${tipo}
- Cidade: ${local}
${comodos ? `- Número de cômodos: ${comodos}` : ""}
${prop ? `- Proprietário (LOCADOR): ${prop}` : ""}

**REGRAS OBRIGATÓRIAS:**
1. Use EXATAMENTE estas variáveis nos campos dinâmicos (sem alterar a grafia):
   - Inquilino: {{nome_inquilino}}, {{rg_inquilino}}, {{cpf_inquilino}}, {{data_nascimento_inquilino}}, {{email_inquilino}}, {{telefone_inquilino}}
   - Imóvel: {{logradouro_imovel}}, {{numero_imovel}}, {{complemento_imovel}}, {{bairro_imovel}}, {{cidade_imovel}}, {{estado_imovel}}, {{cep_imovel}}, {{num_comodos}}, {{endereco_completo}}
   - Contrato: {{data_contrato}}, {{data_inicio}}, {{data_fim}}, {{valor_aluguel}}, {{dia_vencimento}}, {{duracao_meses}}
   - Proprietário: {{nome_proprietario}}, {{cpf_proprietario}}
2. O contrato deve ter no mínimo 15 cláusulas cobrindo: identificação das partes, objeto, prazo, valor e reajuste, forma de pagamento, obrigações do locatário, obrigações do locador, benfeitorias, rescisão, multa, garantia/fiança, vistoria, sublocação, foro e disposições gerais.
3. Use a legislação brasileira vigente (Lei 8.245/91 - Lei do Inquilinato).
4. Ao final, inclua um bloco de assinatura com local para assinaturas do LOCADOR, LOCATÁRIO e duas testemunhas.
5. Torne as cláusulas genéricas, sem mencionar nomes de empresas de utilidades (água, luz) — use apenas "concessionárias de serviços públicos".
6. Use {{cidade_imovel}} em vez de nomear a cidade em cláusulas como foro.
7. Responda SOMENTE com o HTML do contrato, sem explicações, sem markdown, sem blocos de código.`;
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

  // Extrai campos do body
  const { tipoImovel, cidade, numComodos, nomeProprietario, nivelUsuario } = req.body || {};

  // Só PREMIUM ou ADMIN podem usar
  if (!["PREMIUM", "ADMIN"].includes(nivelUsuario)) {
    res.writeHead(403, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Recurso disponível apenas para usuários PREMIUM." }));
    return;
  }

  const prompt = buildPrompt({ tipoImovel, cidade, numComodos, nomeProprietario });

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini error:", errBody);
      res.writeHead(502, { ...CORS_HEADERS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Erro ao chamar a API Gemini.", detalhes: errBody }));
      return;
    }

    const data = await geminiRes.json();
    const html = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!html) {
      res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "A IA não retornou conteúdo." }));
      return;
    }

    // Remove eventuais blocos de código markdown que o Gemini pode retornar
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
