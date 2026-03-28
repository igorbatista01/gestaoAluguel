const PDFDocument = require("pdfkit");
const { buildContratoHtml } = require("./contract");

const isValidRG = (rg) => /^[\dXx]{1,15}$/.test(rg);
const isValidCPF = (cpf) => /^\d{11}$/.test(cpf);
const isValidDate = (date) => {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(date)) return false;
  const [d, m, y] = date.split("/").map(Number);
  if (y < 1000 || y > 3000 || m < 1 || m > 12) return false;
  const monthLen = [31, (y % 400 === 0 || (y % 100 !== 0 && y % 4 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d > 0 && d <= monthLen[m - 1];
};
const isValidDay = (day) => /^([1-9]|[12]\d|3[01])$/.test(day);

function validateBody(data) {
  const errors = [];
  // Se customHtml for fornecido, pulamos validações de imóvel específico
  if (!data.customHtml) {
    if (!data.numImovel) errors.push("Endereço do imóvel obrigatório.");
  }
  if (!data.nomeAlugante) errors.push("Nome obrigatório.");
  if (!isValidRG(data.rg || "")) errors.push("RG inválido.");
  if (!isValidCPF(data.cpf || "")) errors.push("CPF inválido.");
  if (!["solteiro","casado"].includes(data.maritalStatus)) errors.push("Estado civil inválido.");
  if (!isValidDate(data.birthdate || "")) errors.push("Data de nascimento inválida.");
  if (!isValidDate(data.dataInicioContrato || "")) errors.push("Data de início inválida.");
  if (!isValidDay(data.diaPagamento || "")) errors.push("Dia de pagamento inválido.");
  if (!data.tempoContrato) errors.push("Tempo de contrato obrigatório.");
  if (!data.valorAluguel) errors.push("Valor do aluguel obrigatório.");
  return errors;
}

// ── Renderizador HTML Rico → PDFKit ──────────────────────────────────────────
//
// Suporta: negrito, itálico, sublinhado, tamanhos de fonte, alinhamento,
// listas (bullets e numeradas) e indentação — gerados pelo editor contenteditable.

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Tamanhos do execCommand fontSize (1-7) → pontos
const EXEC_FONT_SIZE = { 1: 8, 2: 9, 3: 10, 4: 12, 5: 16, 6: 20, 7: 28 };
const DEFAULT_SIZE = 9;

function cssVal(styleStr, prop) {
  if (!styleStr) return null;
  const re = new RegExp(prop + "\\s*:\\s*([^;]+)");
  const m = styleStr.match(re);
  return m ? m[1].trim() : null;
}

// Tokeniza HTML em { type, tag, attrs, text }
function tokenize(html) {
  const tokens = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^>]*)?)(\s*\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith("<!--")) continue;
    if (m[5] !== undefined) {
      const t = decodeEntities(m[5]);
      if (t) tokens.push({ type: "text", text: t });
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrStr = m[3] || "";
    const selfClose = /\/$/.test(m[4] || "");
    if (closing) { tokens.push({ type: "close", tag }); continue; }
    const attrs = {};
    const ar = /([\w-]+)(?:=(?:"([^"]*?)"|'([^']*?)'|(\S+)))?/g;
    let am;
    while ((am = ar.exec(attrStr)) !== null) {
      attrs[am[1].toLowerCase()] =
        am[2] !== undefined ? am[2] :
        am[3] !== undefined ? am[3] :
        am[4] !== undefined ? am[4] : true;
    }
    const SELF = ["br","hr","img","input","meta","link","wbr"];
    tokens.push({ type: (selfClose || SELF.includes(tag)) ? "self" : "open", tag, attrs });
  }
  return tokens;
}

// Mescla stack de formatação → estado atual
function mergeStack(stack) {
  const s = { bold: false, italic: false, underline: false, fontSize: DEFAULT_SIZE };
  for (const f of stack) {
    if (f.bold      !== undefined) s.bold      = f.bold;
    if (f.italic    !== undefined) s.italic    = f.italic;
    if (f.underline !== undefined) s.underline = f.underline;
    if (f.fontSize  !== undefined) s.fontSize  = f.fontSize;
  }
  return s;
}

/**
 * Converte HTML do contenteditable em blocos renderizáveis.
 * Bloco: { runs[], align, indent, bullet }
 * Run:   { text, bold, italic, underline, fontSize }
 */
function htmlToBlocks(html) {
  const tokens = tokenize(html);
  const blocks = [];
  let fmtStack  = [];   // formatação inline acumulada
  let listStack = [];   // { type:'ul'|'ol', count:0 }
  let cur       = null; // bloco corrente

  function newBlock(opts) {
    flush();
    cur = { runs: [], align: "left", indent: 0, bullet: null, ...opts };
  }
  function flush() {
    if (cur && cur.runs.some(r => r.text.replace(/\n/g, "").trim())) blocks.push(cur);
    cur = null;
  }
  function addText(text) {
    if (!cur) newBlock();
    const fmt = mergeStack(fmtStack);
    const last = cur.runs[cur.runs.length - 1];
    if (last && last.bold === fmt.bold && last.italic === fmt.italic &&
        last.underline === fmt.underline && last.fontSize === fmt.fontSize) {
      last.text += text;
    } else {
      cur.runs.push({ text, ...fmt });
    }
  }

  for (const tok of tokens) {
    // ── texto ──
    if (tok.type === "text") { addText(tok.text); continue; }

    // ── self-closing ──
    if (tok.type === "self") {
      if (tok.tag === "br") addText("\n");
      continue;
    }

    // ── abertura ──
    if (tok.type === "open") {
      const { tag, attrs } = tok;
      const style = attrs.style || "";
      switch (tag) {
        case "div": case "p": {
          const align = cssVal(style, "text-align") || "left";
          const ml    = parseFloat(cssVal(style, "margin-left") || "0") || 0;
          newBlock({ align, indent: Math.min(ml, 200) });
          fmtStack.push({});
          break;
        }
        case "ul": listStack.push({ type: "ul", count: 0 }); fmtStack.push({}); break;
        case "ol": listStack.push({ type: "ol", count: 0 }); fmtStack.push({}); break;
        case "li": {
          const list   = listStack[listStack.length - 1] || { type: "ul", count: 0 };
          list.count++;
          const bullet = list.type === "ul" ? "•" : `${list.count}.`;
          newBlock({ indent: (listStack.length - 1) * 20, bullet });
          fmtStack.push({});
          break;
        }
        case "b": case "strong": fmtStack.push({ bold: true });      break;
        case "i": case "em":    fmtStack.push({ italic: true });    break;
        case "u":               fmtStack.push({ underline: true }); break;
        case "font": {
          const sz = attrs.size ? EXEC_FONT_SIZE[parseInt(attrs.size)] : undefined;
          fmtStack.push(sz ? { fontSize: sz } : {});
          break;
        }
        case "span": {
          const f = {};
          if (/font-weight\s*:\s*bold/i.test(style))               f.bold      = true;
          if (/font-style\s*:\s*italic/i.test(style))              f.italic    = true;
          if (/text-decoration[^;]*underline/i.test(style))        f.underline = true;
          const fsm = style.match(/font-size\s*:\s*([\d.]+)pt/i);
          if (fsm) f.fontSize = parseFloat(fsm[1]);
          fmtStack.push(f);
          break;
        }
        case "h1": newBlock({ align: "center" }); fmtStack.push({ bold: true, fontSize: 16 }); break;
        case "h2": newBlock();                    fmtStack.push({ bold: true, fontSize: 13 }); break;
        case "h3": newBlock();                    fmtStack.push({ bold: true, fontSize: 11 }); break;
        default:   fmtStack.push({}); break; // tags desconhecidas são transparentes
      }
      continue;
    }

    // ── fechamento ──
    if (tok.type === "close") {
      switch (tok.tag) {
        case "div": case "p": case "li": case "h1": case "h2": case "h3":
          flush();
          if (fmtStack.length) fmtStack.pop();
          break;
        case "ul": case "ol":
          listStack.pop();
          if (fmtStack.length) fmtStack.pop();
          break;
        default:
          if (fmtStack.length) fmtStack.pop();
          break;
      }
    }
  }
  flush();
  return blocks;
}

function fontName(bold, italic) {
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold)           return "Helvetica-Bold";
  if (italic)         return "Helvetica-Oblique";
  return "Helvetica";
}

/**
 * Renderiza HTML rico no doc PDFKit.
 * Preserva negrito, itálico, sublinhado, tamanho, alinhamento e listas.
 */
function renderizarHtmlRico(doc, html) {
  const blocks   = htmlToBlocks(html);
  const margins  = doc.page.margins;
  const pageW    = doc.page.width - margins.left - margins.right;

  for (const block of blocks) {
    const { runs, align, indent, bullet } = block;
    // filtra runs sem texto
    const validos = runs.filter(r => r.text !== "");
    if (!validos.length) continue;
    const todoTexto = validos.map(r => r.text).join("");
    if (!todoTexto.trim()) { doc.moveDown(0.4); continue; }

    const blockW  = pageW - indent;
    const xStart  = margins.left + indent;
    const pdfAlign = { center:"center", right:"right", justify:"justify" }[align] || "left";
    const baseSize = validos.reduce((mx, r) => Math.max(mx, r.fontSize), DEFAULT_SIZE);

    // Expande runs que contêm \n em linhas separadas
    const linhas = [[]];
    for (const run of validos) {
      const partes = run.text.split("\n");
      linhas[linhas.length - 1].push({ ...run, text: partes[0] });
      for (let i = 1; i < partes.length; i++) {
        linhas.push([{ ...run, text: partes[i] }]);
      }
    }

    for (let li = 0; li < linhas.length; li++) {
      const lineRuns = linhas[li].filter(r => r.text !== "");
      if (!lineRuns.length) { doc.moveDown(0.35); continue; }

      // Prefixo de lista apenas na 1ª linha do bloco
      const allRuns = [];
      if (li === 0 && bullet) {
        allRuns.push({ text: bullet + " ", bold: false, italic: false, underline: false, fontSize: baseSize });
      }
      allRuns.push(...lineRuns);

      for (let ri = 0; ri < allRuns.length; ri++) {
        const run    = allRuns[ri];
        const isLast = ri === allRuns.length - 1;
        doc.font(fontName(run.bold, run.italic)).fontSize(run.fontSize);

        const opts = {
          continued:  !isLast,
          underline:  run.underline || false,
          width:      blockW,
          align:      pdfAlign,
          lineBreak:  true,
        };

        if (ri === 0) {
          doc.text(run.text, xStart, doc.y, opts);
        } else {
          doc.text(run.text, opts);
        }
      }
      if (li < linhas.length - 1) doc.moveDown(0.1);
    }
    doc.moveDown(0.4);
  }
}

function gerarPDFBuffer(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 70, bottom: 70, left: 70, right: 70 },
    });

    const buffers = [];
    doc.on("data", (buf) => buffers.push(buf));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Título centralizado
    doc.font("Helvetica-Bold")
       .fontSize(11)
       .text("CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL", { align: "center" })
       .moveDown(1.5);

    doc.fontSize(9);

    if (data.customHtml) {
      // ── Modelo personalizado: renderiza HTML rico com formatação ──
      renderizarHtmlRico(doc, data.customHtml);

    } else {
      // ── Contrato padrão: HTML gerado por buildContratoHtml ──
      const html = buildContratoHtml(data);
      const pMatch = html.match(/<p>([\s\S]*?)<\/p>/);
      if (!pMatch) { doc.end(); return; }
      const rawBody = pMatch[1];
      const sections = rawBody.split(/<br>\s*<br>/);

      for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;

        const subParts = trimmed.split(/<br>/);
        for (const part of subParts) {
          const p = part.trim();
          if (!p) continue;

          const boldMatch = p.match(/^<b>([\s\S]*?)<\/b>([\s\S]*)/);
          if (boldMatch) {
            const label = boldMatch[1];
            const rest = boldMatch[2].replace(/<[^>]+>/g, "");
            if (rest.trim()) {
              doc.font("Helvetica-Bold")
                 .text(label, { align: "justify", continued: true })
                 .font("Helvetica")
                 .text(rest, { align: "justify" });
            } else {
              doc.font("Helvetica-Bold").text(label, { align: "left" });
            }
          } else {
            const clean = p.replace(/<[^>]+>/g, "").trim();
            if (clean) doc.font("Helvetica").text(clean, { align: "left" });
          }
        }
        doc.moveDown(0.6);
      }
    }

    doc.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const data = req.body;
  const errors = validateBody(data);
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  try {
    const pdfBuffer = await gerarPDFBuffer(data);
    const filename = `contrato_${data.nomeAlugante.replace(/\s+/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).json({ error: "Erro ao gerar PDF." });
  }
};
