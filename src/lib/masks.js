// ── src/lib/masks.js ─────────────────────────────────────────────────────────
// Funções de máscara de entrada e extração de valores brutos.
// Fonte única de verdade — importe daqui em vez de redefinir em cada página.

// ── Base ──────────────────────────────────────────────────────────────────────
export const soDigitos = (v, max) => String(v).replace(/\D/g, "").substring(0, max);

// ── Máscaras de entrada ───────────────────────────────────────────────────────

export function maskDate(v) {
  const d = soDigitos(v, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function maskCPF(v) {
  const d = soDigitos(v, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export const maskRG = (v) =>
  v.replace(/[^\dXx]/g, "").toUpperCase().substring(0, 15);

export function maskPhone(v) {
  const d = soDigitos(v, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCEP(v) {
  const d = soDigitos(v, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function maskMoney(v) {
  const digits = soDigitos(String(v), 12);
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Exibição (formata um valor já armazenado como raw) ────────────────────────

/** Formata CPF bruto (11 dígitos) para exibição: "000.000.000-00" */
export function displayCPF(raw) {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Formata telefone bruto para exibição: "(00) 00000-0000" */
export function displayPhone(raw) {
  if (!raw) return "";
  return maskPhone(raw);
}

// ── Extração de valores brutos (inverso das máscaras) ─────────────────────────
export const rawCPF   = (v) => String(v).replace(/\D/g, "");
export const rawRG    = (v) => String(v).replace(/[^\dXx]/g, "").toUpperCase();
export const rawPhone = (v) => String(v).replace(/\D/g, "");
export const rawCEP   = (v) => String(v).replace(/\D/g, "");

/** "1.500,00" → "1500.00" (ponto flutuante) */
export function rawMoney(v) {
  return String(v).replace(/\./g, "").replace(",", ".");
}
