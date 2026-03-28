const PDFDocument = require("pdfkit");
const { buildContratoHtml } = require("./contract");

const isValidRG = (rg) => /^\d{1,15}$/.test(rg);
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
  if (!["1898", "105"].includes(data.numImovel)) errors.push("Imóvel inválido.");
  if (!data.numCasa) errors.push("Selecione a casa.");
  if (data.numImovel === "105" && !["1","2","3"].includes(data.numCasa)) errors.push("Para 105, casas 1, 2 ou 3.");
  if (data.numImovel === "1898" && !["1","2","3","4"].includes(data.numCasa)) errors.push("Para 1898, casas 1 a 4.");
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

function gerarPDFBuffer(data) {
  return new Promise((resolve, reject) => {
    const html = buildContratoHtml(data);

    // Extrai o conteúdo do <p>
    const pMatch = html.match(/<p>([\s\S]*?)<\/p>/);
    if (!pMatch) return reject(new Error("Falha ao processar contrato."));
    const rawBody = pMatch[1];

    // Divide em seções por <br><br>
    const sections = rawBody.split(/<br>\s*<br>/);

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

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // Sub-partes separadas por <br> simples dentro da seção
      const subParts = trimmed.split(/<br>/);

      for (const part of subParts) {
        const p = part.trim();
        if (!p) continue;

        // Padrão: <b>LABEL:</b> texto restante
        const boldMatch = p.match(/^<b>([\s\S]*?)<\/b>([\s\S]*)/);
        if (boldMatch) {
          const label = boldMatch[1];
          const rest = boldMatch[2].replace(/<[^>]+>/g, "").trim();

          if (rest) {
            doc.font("Helvetica-Bold")
               .text(label, { align: "justify", continued: true })
               .font("Helvetica")
               .text(" " + rest, { align: "justify" });
          } else {
            doc.font("Helvetica-Bold").text(label, { align: "left" });
          }
        } else {
          const clean = p.replace(/<[^>]+>/g, "").trim();
          if (clean) {
            doc.font("Helvetica").text(clean, { align: "left" });
          }
        }
      }

      doc.moveDown(0.6);
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
