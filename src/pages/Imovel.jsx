import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

// ── Máscaras ─────────────────────────────────────────────────────────────────
const soDigitos = (v, max) => v.replace(/\D/g, "").substring(0, max);

function maskCEP(v) {
  const d = soDigitos(v, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
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
function maskCPFDisplay(cpf) {
  if (!cpf || cpf.length !== 11) return cpf || "—";
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}
function maskPhoneDisplay(tel) {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
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
export default function Imovel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, nivel } = useAuth();

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edição do imóvel
  const [editandoImovel, setEditandoImovel] = useState(false);
  const [formImovel, setFormImovel] = useState({});
  const [savingImovel, setSavingImovel] = useState(false);
  const [errorImovel, setErrorImovel] = useState("");

  // Edição do inquilino
  const [editandoInq, setEditandoInq] = useState(false);
  const [formInq, setFormInq] = useState({});
  const [savingInq, setSavingInq] = useState(false);
  const [errorInq, setErrorInq] = useState("");

  const [buscandoCEP, setBuscandoCEP] = useState(false);

  useEffect(() => {
    async function carregar() {
      const snap = await getDoc(doc(db, "imoveis", id));
      if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
      const d = { id: snap.id, ...snap.data() };
      setDados(d);
      setLoading(false);
    }
    carregar();
  }, [id]);

  const podeEditar = nivel === "ADMIN" || (dados && dados.uid === user?.uid);

  // ── Funções de edição do imóvel ──
  function iniciarEdicaoImovel() {
    setFormImovel({
      cep: dados.cep ? maskCEP(dados.cep) : "",
      logradouro: dados.logradouro || "",
      numero: dados.numero || "",
      complemento: dados.complemento || "",
      bairro: dados.bairro || "",
      cidade: dados.cidade || "",
      estado: dados.estado || "",
      numComodos: String(dados.numComodos || 1),
      temLavanderia: dados.temLavanderia || false,
      ocupado: dados.ocupado || false,
    });
    setErrorImovel("");
    setEditandoImovel(true);
  }

  async function buscarCEP(cepMasked) {
    const cep = rawCEP(cepMasked);
    if (cep.length !== 8) return;
    setBuscandoCEP(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { setErrorImovel("CEP não encontrado."); return; }
      setErrorImovel("");
      setFormImovel((p) => ({
        ...p,
        logradouro: data.logradouro || p.logradouro,
        bairro: data.bairro || p.bairro,
        cidade: data.localidade || p.cidade,
        estado: data.uf || p.estado,
      }));
    } catch {
      setErrorImovel("Erro ao buscar CEP.");
    } finally {
      setBuscandoCEP(false);
    }
  }

  async function salvarImovel() {
    const n = parseInt(formImovel.numComodos, 10);
    if (isNaN(n) || n < 1 || n > 99) { setErrorImovel("Número de cômodos inválido (1–99)."); return; }
    if (!formImovel.logradouro.trim()) { setErrorImovel("Logradouro obrigatório."); return; }
    if (!formImovel.cidade.trim()) { setErrorImovel("Cidade obrigatória."); return; }

    setSavingImovel(true);
    try {
      const atualizado = {
        cep: rawCEP(formImovel.cep),
        logradouro: formImovel.logradouro.trim(),
        numero: formImovel.numero.trim(),
        complemento: formImovel.complemento.trim(),
        bairro: formImovel.bairro.trim(),
        cidade: formImovel.cidade.trim(),
        estado: formImovel.estado.trim().toUpperCase(),
        numComodos: n,
        temLavanderia: formImovel.temLavanderia,
        ocupado: formImovel.ocupado,
        atualizadoEm: serverTimestamp(),
      };
      await updateDoc(doc(db, "imoveis", id), atualizado);
      setDados((d) => ({ ...d, ...atualizado }));
      setEditandoImovel(false);
    } catch (e) {
      setErrorImovel("Erro ao salvar. Tente novamente.");
    } finally {
      setSavingImovel(false);
    }
  }

  // ── Funções de edição do inquilino ──
  function iniciarEdicaoInq() {
    const inq = dados.inquilino || {};
    setFormInq({
      nome: inq.nome || "",
      rg: inq.rg || "",
      cpf: inq.cpf ? maskCPF(inq.cpf) : "",
      dataNascimento: inq.dataNascimento || "",
      email: inq.email || "",
      telefone: inq.telefone ? maskPhone(inq.telefone) : "",
    });
    setErrorInq("");
    setEditandoInq(true);
  }

  async function salvarInquilino() {
    if (!formInq.nome.trim()) { setErrorInq("Nome do inquilino obrigatório."); return; }
    if (rawRG(formInq.rg).length < 4) { setErrorInq("RG inválido (mínimo 4 dígitos)."); return; }
    if (rawCPF(formInq.cpf).length !== 11) { setErrorInq("CPF inválido (11 dígitos)."); return; }
    if (!isValidDate(formInq.dataNascimento)) { setErrorInq("Data de nascimento inválida (DD/MM/AAAA)."); return; }

    setSavingInq(true);
    try {
      const inqData = {
        nome: formInq.nome.trim(),
        rg: rawRG(formInq.rg),
        cpf: rawCPF(formInq.cpf),
        dataNascimento: formInq.dataNascimento,
        email: formInq.email.trim(),
        telefone: rawPhone(formInq.telefone),
      };
      await updateDoc(doc(db, "imoveis", id), {
        inquilino: inqData,
        atualizadoEm: serverTimestamp(),
      });
      setDados((d) => ({ ...d, inquilino: inqData }));
      setEditandoInq(false);
    } catch (e) {
      setErrorInq("Erro ao salvar. Tente novamente.");
    } finally {
      setSavingInq(false);
    }
  }

  async function removerInquilino() {
    if (!window.confirm("Deseja remover o inquilino deste imóvel?")) return;
    await updateDoc(doc(db, "imoveis", id), { inquilino: null, atualizadoEm: serverTimestamp() });
    setDados((d) => ({ ...d, inquilino: null }));
  }

  // ── Render ──
  if (loading) return <div style={s.center}>Carregando...</div>;
  if (notFound) return <div style={s.center}>Imóvel não encontrado. <button style={s.linkBtn} onClick={() => navigate("/imoveis")}>Voltar</button></div>;

  const { logradouro, numero, complemento, bairro, cidade, estado, cep, numComodos, temLavanderia, ocupado, inquilino } = dados;

  return (
    <div style={s.wrap}>
      <div style={s.backRow}>
        <button style={s.backBtn} onClick={() => navigate("/imoveis")}>← Voltar</button>
      </div>

      {/* ── Card do Imóvel ── */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <h3 style={s.sectionTitle}>Endereço e características</h3>
          {podeEditar && !editandoImovel && (
            <button style={s.editBtn} onClick={iniciarEdicaoImovel}>Editar</button>
          )}
        </div>

        {!editandoImovel ? (
          <div>
            <div style={s.infoGrid}>
              <InfoRow label="Logradouro" value={[logradouro, numero].filter(Boolean).join(", ")} />
              {complemento && <InfoRow label="Complemento" value={complemento} />}
              <InfoRow label="Bairro" value={bairro || "—"} />
              <InfoRow label="Cidade / UF" value={cidade && estado ? `${cidade} / ${estado}` : cidade || estado || "—"} />
              <InfoRow label="CEP" value={cep ? `${cep.slice(0, 5)}-${cep.slice(5)}` : "—"} />
              <InfoRow label="Cômodos" value={numComodos} />
              <InfoRow label="Lavanderia" value={temLavanderia ? "Sim" : "Não"} />
              <InfoRow label="Status" value={
                <span style={{ ...s.badge, ...(ocupado ? s.badgeOcup : s.badgeLivre) }}>
                  {ocupado ? "Ocupado" : "Disponível"}
                </span>
              } />
            </div>
          </div>
        ) : (
          <div>
            {errorImovel && <div style={s.errBox}>{errorImovel}</div>}

            <label style={s.label}>CEP</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
              <input
                style={{ ...s.input, marginBottom: 0, flex: 1 }}
                value={formImovel.cep}
                onChange={(e) => {
                  const v = maskCEP(e.target.value);
                  setFormImovel((p) => ({ ...p, cep: v }));
                  if (rawCEP(v).length === 8) buscarCEP(v);
                }}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
              />
              <button style={s.btnBuscar} onClick={() => buscarCEP(formImovel.cep)} disabled={buscandoCEP}>
                {buscandoCEP ? "..." : "Buscar"}
              </button>
            </div>

            <div style={s.editGrid}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>Logradouro</label>
                <input style={s.input} value={formImovel.logradouro} onChange={(e) => setFormImovel((p) => ({ ...p, logradouro: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Número</label>
                <input style={s.input} value={formImovel.numero} onChange={(e) => setFormImovel((p) => ({ ...p, numero: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Complemento</label>
                <input style={s.input} value={formImovel.complemento} onChange={(e) => setFormImovel((p) => ({ ...p, complemento: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Bairro</label>
                <input style={s.input} value={formImovel.bairro} onChange={(e) => setFormImovel((p) => ({ ...p, bairro: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Cidade</label>
                <input style={s.input} value={formImovel.cidade} onChange={(e) => setFormImovel((p) => ({ ...p, cidade: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Estado (UF)</label>
                <input style={s.input} value={formImovel.estado} onChange={(e) => setFormImovel((p) => ({ ...p, estado: e.target.value.toUpperCase().substring(0, 2) }))} maxLength={2} />
              </div>
              <div>
                <label style={s.label}>Cômodos</label>
                <input style={s.input} type="number" min="1" max="99" value={formImovel.numComodos} onChange={(e) => setFormImovel((p) => ({ ...p, numComodos: e.target.value }))} />
              </div>
            </div>

            <label style={s.checkLabel}>
              <input type="checkbox" checked={formImovel.temLavanderia} onChange={(e) => setFormImovel((p) => ({ ...p, temLavanderia: e.target.checked }))} style={s.check} />
              Possui lavanderia
            </label>
            <label style={{ ...s.checkLabel, marginTop: "8px" }}>
              <input type="checkbox" checked={formImovel.ocupado} onChange={(e) => setFormImovel((p) => ({ ...p, ocupado: e.target.checked }))} style={s.check} />
              Imóvel atualmente ocupado
            </label>

            <div style={{ display: "flex", gap: "8px", marginTop: "1.25rem" }}>
              <button style={s.btnSec} onClick={() => setEditandoImovel(false)}>Cancelar</button>
              <button style={{ ...s.btn, opacity: savingImovel ? 0.7 : 1 }} onClick={salvarImovel} disabled={savingImovel}>
                {savingImovel ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Card do Inquilino ── */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <h3 style={s.sectionTitle}>Inquilino</h3>
          {podeEditar && !editandoInq && (
            <div style={{ display: "flex", gap: "8px" }}>
              {inquilino && (
                <button style={s.dangerBtn} onClick={removerInquilino}>Remover</button>
              )}
              <button style={s.editBtn} onClick={iniciarEdicaoInq}>
                {inquilino ? "Editar" : "Vincular inquilino"}
              </button>
            </div>
          )}
        </div>

        {!editandoInq ? (
          inquilino ? (
            <div style={s.infoGrid}>
              <InfoRow label="Nome" value={inquilino.nome} />
              <InfoRow label="RG" value={inquilino.rg || "—"} />
              <InfoRow label="CPF" value={maskCPFDisplay(inquilino.cpf)} />
              <InfoRow label="Nascimento" value={inquilino.dataNascimento || "—"} />
              <InfoRow label="Telefone" value={maskPhoneDisplay(inquilino.telefone)} />
              <InfoRow label="E-mail" value={inquilino.email || "—"} />
            </div>
          ) : (
            <p style={s.emptyText}>Nenhum inquilino vinculado.</p>
          )
        ) : (
          <div>
            {errorInq && <div style={s.errBox}>{errorInq}</div>}

            <label style={s.label}>Nome completo</label>
            <input style={s.input} value={formInq.nome} onChange={(e) => setFormInq((p) => ({ ...p, nome: e.target.value }))} autoFocus />

            <div style={s.editGrid}>
              <div>
                <label style={s.label}>RG</label>
                <input style={s.input} value={formInq.rg} onChange={(e) => setFormInq((p) => ({ ...p, rg: maskRG(e.target.value) }))} placeholder="000000000" />
              </div>
              <div>
                <label style={s.label}>CPF</label>
                <input style={s.input} value={formInq.cpf} onChange={(e) => setFormInq((p) => ({ ...p, cpf: maskCPF(e.target.value) }))} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} />
              </div>
              <div>
                <label style={s.label}>Data de nascimento</label>
                <input style={s.input} value={formInq.dataNascimento} onChange={(e) => setFormInq((p) => ({ ...p, dataNascimento: maskDate(e.target.value) }))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} />
              </div>
              <div>
                <label style={s.label}>Telefone</label>
                <input style={s.input} value={formInq.telefone} onChange={(e) => setFormInq((p) => ({ ...p, telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" inputMode="numeric" maxLength={15} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>E-mail</label>
                <input style={s.input} type="email" value={formInq.email} onChange={(e) => setFormInq((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "1rem" }}>
              <button style={s.btnSec} onClick={() => setEditandoInq(false)}>Cancelar</button>
              <button style={{ ...s.btn, opacity: savingInq ? 0.7 : 1 }} onClick={salvarInquilino} disabled={savingInq}>
                {savingInq ? "Salvando..." : "Salvar inquilino"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componente de linha de informação ──
function InfoRow({ label, value }) {
  return (
    <div style={{ display: "contents" }}>
      <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "14px", color: "#111827" }}>{value ?? "—"}</span>
    </div>
  );
}

const s = {
  wrap: { maxWidth: "720px", margin: "0 auto", padding: "2rem 1rem" },
  center: { textAlign: "center", padding: "4rem 0", color: "#9ca3af" },
  backRow: { marginBottom: "1.25rem" },
  backBtn: { background: "none", border: "none", color: "#2563eb", fontSize: "14px", cursor: "pointer", padding: 0, fontWeight: 500 },
  linkBtn: { background: "none", border: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline" },
  section: { background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: "1.25rem" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" },
  sectionTitle: { fontSize: "16px", fontWeight: 700, margin: 0, color: "#111827" },
  editBtn: { background: "#eff6ff", color: "#2563eb", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  dangerBtn: { background: "#fff1f2", color: "#be123c", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  infoGrid: { display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px 16px", alignItems: "center" },
  editGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  emptyText: { color: "#9ca3af", fontSize: "14px", margin: 0 },
  errBox: { background: "#fee2e2", color: "#991b1b", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", fontSize: "13px" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "4px" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", marginBottom: "1rem", boxSizing: "border-box" },
  checkLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#374151", cursor: "pointer", userSelect: "none", marginBottom: "4px" },
  check: { width: "16px", height: "16px", cursor: "pointer" },
  btn: { flex: 1, background: "#2563eb", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  btnSec: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "10px 20px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", cursor: "pointer" },
  btnBuscar: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" },
  badge: { padding: "3px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600 },
  badgeOcup: { background: "#fee2e2", color: "#991b1b" },
  badgeLivre: { background: "#dcfce7", color: "#15803d" },
};
