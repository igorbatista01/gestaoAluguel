// ── src/lib/validation.js ─────────────────────────────────────────────────────
// Regras de negócio de validação — fonte única de verdade para o frontend.

/**
 * Valida data no formato DD/MM/AAAA.
 * Aceita anos entre 1900 e 2099 e verifica dias válidos por mês (inclui anos bissextos).
 */
export function isValidDate(date) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
  const [d, m, y] = date.split("/").map(Number);
  if (y < 1900 || y > 2099 || m < 1 || m > 12) return false;
  const leap = y % 400 === 0 || (y % 100 !== 0 && y % 4 === 0);
  const diasPorMes = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d > 0 && d <= diasPorMes[m - 1];
}

/**
 * Calcula a data de fim do contrato a partir de uma data de início (DD/MM/AAAA)
 * e uma duração em meses.
 * Retorna a data no formato DD/MM/AAAA.
 */
export function calcDataFim(dataInicio, meses) {
  const [d, m, y] = dataInicio.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + parseInt(meses, 10));
  return [
    String(dt.getDate()).padStart(2, "0"),
    String(dt.getMonth() + 1).padStart(2, "0"),
    dt.getFullYear(),
  ].join("/");
}

// ── Constantes de negócio ─────────────────────────────────────────────────────

/** Limite de imóveis para usuários do plano NORMAL */
export const LIMITE_IMOVEIS_NORMAL = 2;

/** Valores aceitos para estado civil (devem coincidir com o backend) */
export const ESTADO_CIVIL_OPCOES = [
  { value: "solteiro",      label: "Solteiro(a)" },
  { value: "casado",        label: "Casado(a)" },
  { value: "divorciado",    label: "Divorciado(a)" },
  { value: "viuvo",         label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União estável" },
];
