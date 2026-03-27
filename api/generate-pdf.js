const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const data = req.body;
  const errors = validateBody(data);
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    const html = buildContratoHtml(data);
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({ format: "A4" });
    await browser.close();

    const filename = `contrato_${data.nomeAlugante.replace(/\s+/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(Buffer.from(pdfBuffer));
  } catch (err) {
    if (browser) await browser.close();
    console.error("Erro ao gerar PDF:", err);
    res.status(500).json({ error: "Erro ao gerar PDF." });
  }
};
