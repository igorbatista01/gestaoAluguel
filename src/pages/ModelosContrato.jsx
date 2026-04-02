import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, query, where, orderBy,
  deleteDoc, doc, writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

// Injeta @keyframes spin globalmente uma única vez
if (typeof document !== "undefined" && !document.getElementById("spin-kf")) {
  const st = document.createElement("style");
  st.id = "spin-kf";
  st.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(st);
}

export default function ModelosContrato() {
  const { user, nivel, perfil } = useAuth();
  const navigate = useNavigate();
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletando, setDeletando] = useState(null);
  const [imoveisAfetados, setImoveisAfetados] = useState([]);
  const [loadingDelete, setLoadingDelete] = useState(false);

  // ── Estado do modal de geração com IA ──────────────────────────────────────
  const [modalIA, setModalIA] = useState(false);
  const [iaForm, setIaForm] = useState({ tipoImovel: "residencial", cidade: "", numComodos: "" });
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState("");

  const isPremium = ["PREMIUM", "ADMIN"].includes(nivel);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q;
    if (nivel === "ADMIN") {
      q = query(collection(db, "modelos_contrato"), orderBy("criadoEm", "desc"));
    } else {
      q = query(
        collection(db, "modelos_contrato"),
        where("uid", "==", user.uid),
        orderBy("criadoEm", "desc")
      );
    }
    const snap = await getDocs(q);
    setModelos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }, [user, nivel]);

  useEffect(() => { carregar(); }, [carregar]);

  async function iniciarExclusao(modelo) {
    const q = query(
      collection(db, "imoveis"),
      where("modeloContratoId", "==", modelo.id)
    );
    const snap = await getDocs(q);
    const afetados = snap.docs.map((d) => ({
      id: d.id,
      logradouro: d.data().logradouro,
      numero: d.data().numero,
    }));
    setImoveisAfetados(afetados);
    setDeletando(modelo);
  }

  async function confirmarExclusao() {
    if (!deletando) return;
    setLoadingDelete(true);
    try {
      const batch = writeBatch(db);
      for (const im of imoveisAfetados) {
        batch.update(doc(db, "imoveis", im.id), { modeloContratoId: null });
      }
      await batch.commit();
      await deleteDoc(doc(db, "modelos_contrato", deletando.id));
      setModelos((prev) => prev.filter((m) => m.id !== deletando.id));
    } finally {
      setDeletando(null);
      setImoveisAfetados([]);
      setLoadingDelete(false);
    }
  }

  // ── Gerar modelo com IA ────────────────────────────────────────────────────
  async function gerarComIA() {
    setGerando(true);
    setErroIA("");
    try {
      const res = await fetch("/api/generate-model-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoImovel: iaForm.tipoImovel,
          cidade: iaForm.cidade,
          numComodos: iaForm.numComodos,
          nomeProprietario: perfil?.nomeCompleto || user?.displayName || "",
          nivelUsuario: nivel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroIA(data.error || "Erro ao gerar contrato.");
        return;
      }
      // Abre o editor de modelo com o HTML gerado como rascunho
      setModalIA(false);
      navigate("/modelos/novo", { state: { htmlInicial: data.html } });
    } catch (e) {
      setErroIA("Erro de conexão com o servidor.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>Modelos de contrato</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {isPremium && (
            <button style={s.btnIA} onClick={() => { setErroIA(""); setModalIA(true); }}>
              ✨ Gerar com IA
            </button>
          )}
          <button style={s.btnAdd} onClick={() => navigate("/modelos/novo")}>
            + Novo modelo
          </button>
        </div>
      </div>

      {loading ? (
        <p style={s.empty}>Carregando...</p>
      ) : modelos.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Nenhum modelo criado ainda. Crie um para associar aos seus imóveis.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            {isPremium && (
              <button style={s.btnIA} onClick={() => { setErroIA(""); setModalIA(true); }}>
                ✨ Gerar com IA
              </button>
            )}
            <button style={s.btnAdd} onClick={() => navigate("/modelos/novo")}>
              + Criar primeiro modelo
            </button>
          </div>
        </div>
      ) : (
        <div style={s.list}>
          {modelos.map((m) => (
            <div key={m.id} style={s.card}>
              <div style={s.cardMain}>
                <span style={s.cardName}>{m.nome || "Sem nome"}</span>
                <span style={s.cardMeta}>
                  {m.imoveisCount > 0
                    ? `${m.imoveisCount} imóvel associado`
                    : "Nenhum imóvel associado"}
                </span>
              </div>
              <div style={s.cardActions}>
                <button
                  style={s.btnEdit}
                  onClick={() => navigate(`/modelos/${m.id}`)}
                >
                  Editar
                </button>
                <button
                  style={s.btnDel}
                  onClick={() => iniciarExclusao(m)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Gerar com IA ─────────────────────────────────────────────── */}
      {modalIA && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>✨ Gerar modelo com Inteligência Artificial</h3>
            <p style={s.modalText}>
              A IA vai criar um contrato de locação completo usando as variáveis do sistema
              (&#123;&#123;nome_inquilino&#125;&#125;, &#123;&#123;valor_aluguel&#125;&#125; etc.).
              Você poderá editar antes de salvar.
            </p>

            <div style={s.formGroup}>
              <label style={s.label}>Tipo de imóvel</label>
              <select
                style={s.select}
                value={iaForm.tipoImovel}
                onChange={(e) => setIaForm((f) => ({ ...f, tipoImovel: e.target.value }))}
              >
                <option value="residencial">Residencial</option>
                <option value="comercial">Comercial</option>
                <option value="kitnet">Kitnet</option>
                <option value="temporada">Temporada</option>
              </select>
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Cidade do imóvel (opcional)</label>
              <input
                style={s.input}
                placeholder="Ex: São Paulo"
                value={iaForm.cidade}
                onChange={(e) => setIaForm((f) => ({ ...f, cidade: e.target.value }))}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Número de cômodos (opcional)</label>
              <input
                style={s.input}
                placeholder="Ex: 3"
                value={iaForm.numComodos}
                onChange={(e) => setIaForm((f) => ({ ...f, numComodos: e.target.value }))}
              />
            </div>

            {erroIA && (
              <div style={s.erroBox}>⚠️ {erroIA}</div>
            )}

            {gerando && (
              <div style={s.gerandoBox}>
                <span style={s.spinner} /> Gerando contrato com IA... pode levar alguns segundos.
              </div>
            )}

            <div style={s.modalRow}>
              <button
                style={s.btnSec}
                onClick={() => setModalIA(false)}
                disabled={gerando}
              >
                Cancelar
              </button>
              <button
                style={{ ...s.btnIA, opacity: gerando ? 0.7 : 1, padding: "9px 20px", fontSize: "14px" }}
                onClick={gerarComIA}
                disabled={gerando}
              >
                {gerando ? "Gerando..." : "✨ Gerar contrato"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar exclusão ───────────────────────────────────────── */}
      {deletando && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Excluir modelo</h3>
            <p style={s.modalText}>
              Tem certeza que deseja excluir o modelo <b>"{deletando.nome}"</b>?
            </p>
            {imoveisAfetados.length > 0 && (
              <div style={s.warnBox}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#92400e" }}>
                  ⚠️ Este modelo está associado a {imoveisAfetados.length} imóvel{imoveisAfetados.length > 1 ? "is" : ""}:
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  {imoveisAfetados.map((im) => (
                    <li key={im.id} style={{ fontSize: "13px", color: "#78350f" }}>
                      {im.logradouro}{im.numero ? `, ${im.numero}` : ""}
                    </li>
                  ))}
                </ul>
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#78350f" }}>
                  O vínculo será removido automaticamente.
                </p>
              </div>
            )}
            <div style={s.modalRow}>
              <button
                style={s.btnSec}
                onClick={() => { setDeletando(null); setImoveisAfetados([]); }}
                disabled={loadingDelete}
              >
                Cancelar
              </button>
              <button
                style={{ ...s.btnDanger, opacity: loadingDelete ? 0.7 : 1 }}
                onClick={confirmarExclusao}
                disabled={loadingDelete}
              >
                {loadingDelete ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" },
  title: { fontSize: "22px", fontWeight: 700, margin: 0 },
  btnAdd: { background: "#2563eb", color: "#fff", border: "none", padding: "9px 18px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },
  btnIA: { background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" },
  emptyBox: { textAlign: "center", padding: "3rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" },
  empty: { textAlign: "center", color: "#9ca3af", padding: "2rem 0" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  card: { background: "#fff", borderRadius: "12px", padding: "1rem 1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  cardMain: { display: "flex", flexDirection: "column", gap: "4px" },
  cardName: { fontWeight: 600, fontSize: "15px", color: "#111827" },
  cardMeta: { fontSize: "13px", color: "#6b7280" },
  cardActions: { display: "flex", gap: "8px", flexShrink: 0 },
  btnEdit: { background: "#eff6ff", color: "#2563eb", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  btnDel: { background: "#fff1f2", color: "#be123c", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal: { background: "#fff", borderRadius: "16px", padding: "1.75rem", maxWidth: "460px", width: "100%" },
  modalTitle: { fontSize: "18px", fontWeight: 700, margin: "0 0 0.75rem" },
  modalText: { fontSize: "14px", color: "#374151", margin: "0 0 1.25rem", lineHeight: 1.6 },
  warnBox: { background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px", padding: "12px 14px", marginBottom: "1.25rem" },
  modalRow: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "1.25rem" },
  btnSec: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "9px 18px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", cursor: "pointer" },
  btnDanger: { background: "#dc2626", color: "#fff", border: "none", padding: "9px 18px", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "1rem" },
  label: { fontSize: "13px", fontWeight: 600, color: "#374151" },
  input: { padding: "9px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", outline: "none" },
  select: { padding: "9px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", background: "#fff", outline: "none" },
  erroBox: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "10px 14px", color: "#dc2626", fontSize: "13px", marginBottom: "1rem" },
  gerandoBox: { display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#6b7280", marginBottom: "1rem", padding: "10px 14px", background: "#f5f3ff", borderRadius: "8px" },
  spinner: { display: "inline-block", width: "16px", height: "16px", border: "2px solid #7c3aed", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 },
};
