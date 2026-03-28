import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

// ── Máscaras ─────────────────────────────────────────────────────────────────
const soDigitos = (v, max) => v.replace(/\D/g, "").substring(0, max);

function maskCEP(v) {
  const d = soDigitos(v, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
function maskCPF(v) {
  const d = soDigitos(v, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskDate(v) {
  const d = soDigitos(v, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function maskPhone(v) {
  const d = soDigitos(v, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
const maskRG = (v) => v.replace(/[^\dXx]/g, "").toUpperCase().substring(0, 15);
const rawCPF = (v) => v.replace(/\D/g, "");
const rawRG = (v) => v.replace(/[^\dXx]/g, "").toUpperCase();
const rawPhone = (v) => v.replace(/\D/g, "");
const rawCEP = (v) => v.replace(/\D/g, "");

function isValidDate(date) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
  const [d, m, y] = date.split("/").map(Number);
  if (y < 1900 || y > 2099 || m < 1 || m > 12) return false;
  const ml = [31, (y % 400 === 0 || (y % 100 !== 0 && y % 4 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d > 0 && d <= ml[m - 1];
}

// ── Componente ────────────────────────────────────────────────────────────────
const STEPS = ["Endereço", "Características", "Inquilino"];

const INIT_END = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" };
const INIT_CAR = { numComodos: "1", temLavanderia: false, ocupado: false };
const INIT_INQ = { nome: "", rg: "", cpf: "", dataNascimento: "", email: "", telefone: "" };

export default function NovoImovel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [endereco, setEndereco] = useState(INIT_END);
  const [caract, setCaract] = useState(INIT_CAR);
  const [inquilino, setInquilino] = useState(INIT_INQ);
  const [addInquilino, setAddInquilino] = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setEnd = (k, v) => setEndereco((p) => ({ ...p, [k]: v }));
  const setCar = (k, v) => setCaract((p) => ({ ...p, [k]: v }));
  const setInq = (k, v) => setInquilino((p) => ({ ...p, [k]: v }));

  // ── Busca CEP ──
  async function buscarCEP(cepRaw) {
    const cep = rawCEP(cepRaw);
    if (cep.length !== 8) return;
    setBuscandoCEP(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { setError("CEP não encontrado."); return; }
      setError("");
      setEndereco((p) => ({
        ...p,
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        estado: data.uf || "",
        complemento: p.complemento,
        numero: p.numero,
      }));
    } catch {
      setError("Erro ao buscar CEP. Verifique sua conexão.");
    } finally {
      setBuscandoCEP(false);
    }
  }

  // ── Validações por etapa ──
  function validar(n) {
    if (n === 1) {
      if (rawCEP(endereco.cep).length !== 8) return "CEP inválido (8 dígitos).";
      if (!endereco.logradouro.trim()) return "Logradouro obrigatório.";
      if (!endereco.cidade.trim()) return "Cidade obrigatória.";
      if (!endereco.estado.trim()) return "Estado obrigatório.";
    }
    if (n === 2) {
      const n = parseInt(caract.numComodos, 10);
      if (!caract.numComodos || isNaN(n) || n < 1 || n > 99) return "Número de cômodos inválido (1–99).";
    }
    if (n === 3 && addInquilino) {
      if (!inquilino.nome.trim()) return "Nome do inquilino obrigatório.";
      if (rawRG(inquilino.rg).length < 4) return "RG inválido (mínimo 4 dígitos).";
      if (rawCPF(inquilino.cpf).length !== 11) return "CPF inválido (11 dígitos).";
      if (!isValidDate(inquilino.dataNascimento)) return "Data de nascimento inválida (DD/MM/AAAA).";
    }
    return null;
  }

  function avancar() {
    const err = validar(step);
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => s + 1);
  }

  function voltar() {
    setError("");
    setStep((s) => s - 1);
  }

  async function salvar() {
    const err = validar(3);
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      const dados = {
        uid: user.uid,
        criadoEm: serverTimestamp(),
        cep: rawCEP(endereco.cep),
        logradouro: endereco.logradouro.trim(),
        numero: endereco.numero.trim(),
        complemento: endereco.complemento.trim(),
        bairro: endereco.bairro.trim(),
        cidade: endereco.cidade.trim(),
        estado: endereco.estado.trim().toUpperCase(),
        numComodos: parseInt(caract.numComodos, 10),
        temLavanderia: caract.temLavanderia,
        ocupado: caract.ocupado,
        inquilino: addInquilino && inquilino.nome.trim() ? {
          nome: inquilino.nome.trim(),
          rg: rawRG(inquilino.rg),
          cpf: rawCPF(inquilino.cpf),
          dataNascimento: inquilino.dataNascimento,
          email: inquilino.email.trim(),
          telefone: rawPhone(inquilino.telefone),
        } : null,
      };
      await addDoc(collection(db, "imoveis"), dados);
      navigate("/imoveis");
    } catch (e) {
      setError("Erro ao salvar imóvel. Tente novamente.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.outer}>
      <div style={s.card}>
        <h2 style={s.title}>Novo imóvel</h2>

        {/* Barra de etapas */}
        <div style={s.stepBar}>
          {STEPS.map((label, i) => {
            const st = i + 1 < step ? "done" : i + 1 === step ? "active" : "idle";
            return (
              <div key={i} style={{ ...s.stepItem, ...(st === "active" ? s.stepActive : st === "done" ? s.stepDone : {}) }}>
                <span style={s.stepDot}>{st === "done" ? "✓" : i + 1}</span>
                {label}
              </div>
            );
          })}
        </div>

        {error && <div style={s.errBox}>{error}</div>}

        {/* ── Etapa 1: Endereço ── */}
        {step === 1 && (
          <div>
            <label style={s.label}>CEP</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
              <input
                style={{ ...s.input, marginBottom: 0, flex: 1 }}
                value={endereco.cep}
                onChange={(e) => {
                  const v = maskCEP(e.target.value);
                  setEnd("cep", v);
                  if (rawCEP(v).length === 8) buscarCEP(v);
                }}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                autoFocus
              />
              <button
                style={s.btnBuscar}
                onClick={() => buscarCEP(endereco.cep)}
                disabled={buscandoCEP || rawCEP(endereco.cep).length !== 8}
              >
                {buscandoCEP ? "Buscando..." : "Buscar"}
              </button>
            </div>

            <div style={s.grid2}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>Logradouro</label>
                <input style={s.input} value={endereco.logradouro} onChange={(e) => setEnd("logradouro", e.target.value)} placeholder="Rua, Av, etc." />
              </div>
              <div>
                <label style={s.label}>Número</label>
                <input style={s.input} value={endereco.numero} onChange={(e) => setEnd("numero", e.target.value)} placeholder="123" />
              </div>
              <div>
                <label style={s.label}>Complemento</label>
                <input style={s.input} value={endereco.complemento} onChange={(e) => setEnd("complemento", e.target.value)} placeholder="Apto, Bloco..." />
              </div>
              <div>
                <label style={s.label}>Bairro</label>
                <input style={s.input} value={endereco.bairro} onChange={(e) => setEnd("bairro", e.target.value)} placeholder="Bairro" />
              </div>
              <div>
                <label style={s.label}>Cidade</label>
                <input style={s.input} value={endereco.cidade} onChange={(e) => setEnd("cidade", e.target.value)} placeholder="Cidade" />
              </div>
              <div>
                <label style={s.label}>Estado (UF)</label>
                <input style={s.input} value={endereco.estado} onChange={(e) => setEnd("estado", e.target.value.toUpperCase().substring(0, 2))} placeholder="SP" maxLength={2} />
              </div>
            </div>

            <div style={s.row}>
              <button style={s.btnSec} onClick={() => navigate("/imoveis")}>Cancelar</button>
              <button style={s.btn} onClick={avancar}>Continuar →</button>
            </div>
          </div>
        )}

        {/* ── Etapa 2: Características ── */}
        {step === 2 && (
          <div>
            <label style={s.label}>Número de cômodos</label>
            <input
              style={s.input}
              type="number"
              min="1"
              max="99"
              value={caract.numComodos}
              onChange={(e) => setCar("numComodos", e.target.value)}
              autoFocus
            />

            <div style={s.checkRow}>
              <label style={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={caract.temLavanderia}
                  onChange={(e) => setCar("temLavanderia", e.target.checked)}
                  style={s.check}
                />
                Possui lavanderia
              </label>
            </div>

            <div style={s.checkRow}>
              <label style={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={caract.ocupado}
                  onChange={(e) => setCar("ocupado", e.target.checked)}
                  style={s.check}
                />
                Imóvel atualmente ocupado
              </label>
            </div>

            <div style={s.row}>
              <button style={s.btnSec} onClick={voltar}>← Voltar</button>
              <button style={s.btn} onClick={avancar}>Continuar →</button>
            </div>
          </div>
        )}

        {/* ── Etapa 3: Inquilino (opcional) ── */}
        {step === 3 && (
          <div>
            <div style={s.checkRow}>
              <label style={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={addInquilino}
                  onChange={(e) => setAddInquilino(e.target.checked)}
                  style={s.check}
                />
                Cadastrar inquilino agora
              </label>
            </div>

            {addInquilino && (
              <div style={{ marginTop: "1rem" }}>
                <label style={s.label}>Nome completo</label>
                <input style={s.input} value={inquilino.nome} onChange={(e) => setInq("nome", e.target.value)} placeholder="Nome do inquilino" autoFocus />

                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>RG</label>
                    <input style={s.input} value={inquilino.rg} onChange={(e) => setInq("rg", maskRG(e.target.value))} placeholder="000000000" />
                  </div>
                  <div>
                    <label style={s.label}>CPF</label>
                    <input style={s.input} value={inquilino.cpf} onChange={(e) => setInq("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} />
                  </div>
                  <div>
                    <label style={s.label}>Data de nascimento</label>
                    <input style={s.input} value={inquilino.dataNascimento} onChange={(e) => setInq("dataNascimento", maskDate(e.target.value))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} />
                  </div>
                  <div>
                    <label style={s.label}>Telefone</label>
                    <input style={s.input} value={inquilino.telefone} onChange={(e) => setInq("telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" maxLength={15} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={s.label}>E-mail</label>
                    <input style={s.input} type="email" value={inquilino.email} onChange={(e) => setInq("email", e.target.value)} placeholder="inquilino@email.com" />
                  </div>
                </div>
              </div>
            )}

            {!addInquilino && (
              <p style={s.hint}>Você poderá adicionar o inquilino depois, na página do imóvel.</p>
            )}

            <div style={s.row}>
              <button style={s.btnSec} onClick={voltar}>← Voltar</button>
              <button style={{ ...s.btn, opacity: saving ? 0.7 : 1 }} onClick={salvar} disabled={saving}>
                {saving ? "Salvando..." : "✓ Salvar imóvel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  outer: { minHeight: "100vh", background: "#f4f5f7", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem" },
  card: { background: "#fff", borderRadius: "18px", padding: "2rem", width: "100%", maxWidth: "540px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  title: { fontSize: "20px", fontWeight: 700, marginBottom: "1.25rem", textAlign: "center" },
  stepBar: { display: "flex", justifyContent: "center", gap: "4px", marginBottom: "1.5rem" },
  stepItem: { display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", padding: "5px 10px", borderRadius: "20px", color: "#9ca3af", fontWeight: 500 },
  stepActive: { background: "#eff6ff", color: "#2563eb", fontWeight: 700 },
  stepDone: { color: "#16a34a" },
  stepDot: { width: "18px", height: "18px", borderRadius: "50%", background: "currentColor", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 },
  errBox: { background: "#fee2e2", color: "#991b1b", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", fontSize: "13px" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "4px" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", marginBottom: "1rem", boxSizing: "border-box" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  hint: { fontSize: "13px", color: "#6b7280", marginTop: "0.5rem", lineHeight: 1.5 },
  checkRow: { marginBottom: "1rem" },
  checkLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#374151", cursor: "pointer", userSelect: "none" },
  check: { width: "16px", height: "16px", cursor: "pointer" },
  row: { display: "flex", gap: "8px", justifyContent: "space-between", marginTop: "1rem" },
  btn: { flex: 1, background: "#2563eb", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  btnSec: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "12px 20px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", cursor: "pointer" },
  btnBuscar: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", padding: "10px 16px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" },
};
