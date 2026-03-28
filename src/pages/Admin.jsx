import { useState, useEffect, useCallback } from "react";
import {
  collection, getDocs, doc, updateDoc, setDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

// ── Geração de código ────────────────────────────────────────────────────────
// Caracteres sem ambiguidade visual (sem 0/O, 1/I/L)
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function gerarCodigo() {
  return Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

const NIVEIS = ["NORMAL", "PREMIUM", "ADMIN"];

const NIVEL_BADGE = {
  NORMAL:  { background: "#f3f4f6", color: "#374151" },
  PREMIUM: { background: "#fef9c3", color: "#854d0e" },
  ADMIN:   { background: "#ede9fe", color: "#5b21b6" },
};

// ── Componente ───────────────────────────────────────────────────────────────
export default function Admin() {
  const { user } = useAuth();
  const [aba, setAba] = useState("usuarios");

  // ── Usuários ──
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // ── Códigos ──
  const [codigos, setCodigos] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(null);
  const [removendo, setRemovendo] = useState(null);

  const carregarUsuarios = useCallback(async () => {
    setLoadingUsers(true);
    const snap = await getDocs(query(collection(db, "usuarios"), orderBy("criadoEm", "desc")));
    setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoadingUsers(false);
  }, []);

  const carregarCodigos = useCallback(async () => {
    setLoadingCodes(true);
    const snap = await getDocs(query(collection(db, "codigos"), orderBy("criadoEm", "desc")));
    setCodigos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoadingCodes(false);
  }, []);

  useEffect(() => { carregarUsuarios(); }, [carregarUsuarios]);
  useEffect(() => { carregarCodigos(); }, [carregarCodigos]);

  async function atualizarNivel(uid, novoNivel) {
    setUpdatingId(uid);
    try {
      await updateDoc(doc(db, "usuarios", uid), { nivel: novoNivel });
      setUsuarios((prev) => prev.map((u) => u.id === uid ? { ...u, nivel: novoNivel } : u));
    } finally {
      setUpdatingId(null);
    }
  }

  async function gerarNovoCodigo() {
    setGerando(true);
    try {
      const code = gerarCodigo();
      await setDoc(doc(db, "codigos", code), {
        usado: false,
        criadoPor: user.uid,
        criadoEm: serverTimestamp(),
      });
      await carregarCodigos();
    } finally {
      setGerando(false);
    }
  }

  async function removerCodigo(id) {
    if (!window.confirm(`Remover o código "${id}"? Esta ação não pode ser desfeita.`)) return;
    setRemovendo(id);
    try {
      await deleteDoc(doc(db, "codigos", id));
      setCodigos((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setRemovendo(null);
    }
  }

  function copiar(code) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiado(code);
    setTimeout(() => setCopiado(null), 2000);
  }

  function fmtData(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("pt-BR");
  }

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Painel Admin</h2>

      {/* Abas */}
      <div style={s.tabBar}>
        <button style={{ ...s.tab, ...(aba === "usuarios" ? s.tabActive : {}) }} onClick={() => setAba("usuarios")}>
          Usuários ({usuarios.length})
        </button>
        <button style={{ ...s.tab, ...(aba === "codigos" ? s.tabActive : {}) }} onClick={() => setAba("codigos")}>
          Códigos de convite
        </button>
      </div>

      {/* ── Aba Usuários ── */}
      {aba === "usuarios" && (
        <div style={s.section}>
          {loadingUsers ? (
            <p style={s.empty}>Carregando...</p>
          ) : usuarios.length === 0 ? (
            <p style={s.empty}>Nenhum usuário cadastrado.</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Nome</th>
                    <th style={s.th}>E-mail</th>
                    <th style={s.th}>Cadastro</th>
                    <th style={s.th}>Nível</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} style={s.tr}>
                      <td style={s.td}>{u.nomeCompleto || "—"}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: "13px" }}>{u.email}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: "13px" }}>{fmtData(u.criadoEm)}</td>
                      <td style={s.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ ...s.badge, ...NIVEL_BADGE[u.nivel] }}>{u.nivel}</span>
                          <select
                            style={s.select}
                            value={u.nivel}
                            disabled={updatingId === u.id || u.id === user.uid}
                            onChange={(e) => atualizarNivel(u.id, e.target.value)}
                            title={u.id === user.uid ? "Não é possível alterar o próprio nível" : ""}
                          >
                            {NIVEIS.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          {updatingId === u.id && <span style={s.saving}>salvando...</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Códigos ── */}
      {aba === "codigos" && (
        <div style={s.section}>
          <div style={s.codeHeader}>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              Cada código é de uso único. Compartilhe com quem deseja convidar.
            </p>
            <button style={s.btnGerar} onClick={gerarNovoCodigo} disabled={gerando}>
              {gerando ? "Gerando..." : "+ Gerar código"}
            </button>
          </div>

          {loadingCodes ? (
            <p style={s.empty}>Carregando...</p>
          ) : codigos.length === 0 ? (
            <p style={s.empty}>Nenhum código gerado ainda.</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Código</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Gerado em</th>
                    <th style={s.th}>Usado em</th>
                    <th style={s.th}>Usado por</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {codigos.map((c) => {
                    const usouUser = c.usadoPor
                      ? usuarios.find((u) => u.id === c.usadoPor)
                      : null;
                    return (
                      <tr key={c.id} style={s.tr}>
                        <td style={s.td}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={s.code}>{c.id}</span>
                            {!c.usado && (
                              <button
                                style={s.btnCopy}
                                onClick={() => copiar(c.id)}
                                title="Copiar código"
                              >
                                {copiado === c.id ? "✓" : "Copiar"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={s.td}>
                          {c.usado
                            ? <span style={{ ...s.badge, background: "#f3f4f6", color: "#9ca3af" }}>Usado</span>
                            : <span style={{ ...s.badge, background: "#dcfce7", color: "#15803d" }}>Disponível</span>
                          }
                        </td>
                        <td style={{ ...s.td, color: "#6b7280", fontSize: "13px" }}>{fmtData(c.criadoEm)}</td>
                        <td style={{ ...s.td, color: "#6b7280", fontSize: "13px" }}>{c.usado ? fmtData(c.usadoEm) : "—"}</td>
                        <td style={{ ...s.td, fontSize: "13px" }}>
                          {usouUser
                            ? <span title={usouUser.email}>{usouUser.nomeCompleto || usouUser.email}</span>
                            : <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
                        <td style={s.td}>
                          {!c.usado && (
                            <button
                              style={s.btnRemover}
                              onClick={() => removerCodigo(c.id)}
                              disabled={removendo === c.id}
                              title="Remover código não utilizado"
                            >
                              {removendo === c.id ? "..." : "Remover"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { maxWidth: "860px", margin: "0 auto", padding: "2rem 1rem" },
  title: { fontSize: "22px", fontWeight: 700, marginBottom: "1.5rem" },
  tabBar: { display: "flex", gap: "4px", marginBottom: "1.5rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0" },
  tab: { padding: "8px 18px", borderRadius: "8px 8px 0 0", border: "none", background: "none", fontWeight: 500, fontSize: "14px", color: "#6b7280", cursor: "pointer", marginBottom: "-1px" },
  tabActive: { background: "#fff", color: "#2563eb", fontWeight: 700, borderBottom: "2px solid #2563eb" },
  section: { background: "#fff", borderRadius: "0 12px 12px 12px", padding: "1.5rem", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  codeHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "8px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e5e7eb" },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "12px", fontSize: "14px", verticalAlign: "middle" },
  badge: { padding: "3px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" },
  select: { padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", cursor: "pointer" },
  saving: { fontSize: "12px", color: "#9ca3af" },
  empty: { color: "#9ca3af", textAlign: "center", padding: "2rem 0", fontSize: "14px" },
  btnGerar: { background: "#2563eb", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },
  code: { fontFamily: "monospace", fontWeight: 700, fontSize: "15px", letterSpacing: "0.1em", background: "#f9fafb", padding: "3px 8px", borderRadius: "6px" },
  btnCopy: { padding: "3px 8px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", fontSize: "12px", cursor: "pointer", color: "#374151" },
  btnRemover: { padding: "3px 8px", borderRadius: "6px", border: "1px solid #fca5a5", background: "#fff", fontSize: "12px", cursor: "pointer", color: "#dc2626" },
};
