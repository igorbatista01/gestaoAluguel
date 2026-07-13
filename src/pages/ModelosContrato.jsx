import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, query, where, orderBy,
  deleteDoc, doc, writeBatch, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

export default function ModelosContrato() {
  const { user, nivel } = useAuth();
  const navigate = useNavigate();
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletando, setDeletando] = useState(null);
  const [imoveisAfetados, setImoveisAfetados] = useState([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [contagens, setContagens] = useState({});
  const [associando, setAssociando] = useState(null);
  const [imoveisModal, setImoveisModal] = useState([]);
  const [loadingImoveisModal, setLoadingImoveisModal] = useState(false);
  const [salvandoAssoc, setSalvandoAssoc] = useState(null);

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

  // Carrega a contagem real de imóveis associados a cada modelo (substitui o campo m.imoveisCount, que nunca é gravado)
  useEffect(() => {
    async function carregarContagens() {
      if (!user || modelos.length === 0) { setContagens({}); return; }
      const snap = nivel === "ADMIN"
        ? await getDocs(collection(db, "imoveis"))
        : await getDocs(query(collection(db, "imoveis"), where("uid", "==", user.uid)));
      const mapa = {};
      snap.docs.forEach((d) => {
        const mid = d.data().modeloContratoId;
        if (mid) mapa[mid] = (mapa[mid] || 0) + 1;
      });
      setContagens(mapa);
    }
    carregarContagens();
  }, [modelos, user, nivel]);

  // Abre o modal para associar/desassociar este modelo aos imóveis do proprietário
  async function abrirAssociacao(modelo) {
    setAssociando(modelo);
    setLoadingImoveisModal(true);
    const q = query(collection(db, "imoveis"), where("uid", "==", modelo.uid));
    const snap = await getDocs(q);
    setImoveisModal(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoadingImoveisModal(false);
  }

  function fecharAssociacao() {
    setAssociando(null);
    setImoveisModal([]);
  }

  async function alternarAssociacao(imovel) {
    if (!associando) return;
    setSalvandoAssoc(imovel.id);
    const jaAssociado = imovel.modeloContratoId === associando.id;
    const novoId = jaAssociado ? null : associando.id;
    try {
      await updateDoc(doc(db, "imoveis", imovel.id), { modeloContratoId: novoId, atualizadoEm: serverTimestamp() });
      setImoveisModal((prev) => prev.map((im) => (im.id === imovel.id ? { ...im, modeloContratoId: novoId } : im)));
      setContagens((prev) => {
        const atual = { ...prev };
        const modeloId = associando.id;
        atual[modeloId] = Math.max(0, (atual[modeloId] || 0) + (jaAssociado ? -1 : 1));
        return atual;
      });
    } finally {
      setSalvandoAssoc(null);
    }
  }

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

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>Modelos de contrato</h2>
        <button style={s.btnAdd} onClick={() => navigate("/modelos/novo")}>
          + Novo modelo
        </button>
      </div>

      {loading ? (
        <p style={s.empty}>Carregando...</p>
      ) : modelos.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Nenhum modelo criado ainda. Crie um para associar aos seus imóveis.
          </p>
          <button style={s.btnAdd} onClick={() => navigate("/modelos/novo")}>
            + Criar primeiro modelo
          </button>
        </div>
      ) : (
        <div style={s.list}>
          {modelos.map((m) => (
            <div key={m.id} style={s.card}>
              <div style={s.cardMain}>
                <span style={s.cardName}>{m.nome || "Sem nome"}</span>
                <span style={s.cardMeta}>
                  {(contagens[m.id] || 0) > 0
                    ? `${contagens[m.id]} imóvel${contagens[m.id] > 1 ? "is" : ""} associado${contagens[m.id] > 1 ? "s" : ""}`
                    : "Nenhum imóvel associado"}
                </span>
              </div>
              <div style={s.cardActions}>
                <button
                  style={s.btnAssoc}
                  onClick={() => abrirAssociacao(m)}
                >
                  Associar
                </button>
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

      {/* Modal de confirmação de exclusão */}
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

      {/* Modal de associação a imóveis */}
      {associando && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Associar "{associando.nome}"</h3>
            <p style={s.modalText}>
              Selecione os imóveis que devem usar este modelo de contrato.
            </p>

            {loadingImoveisModal ? (
              <p style={{ textAlign: "center", color: "#9ca3af", padding: "1rem 0" }}>Carregando...</p>
            ) : imoveisModal.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "1rem" }}>
                Nenhum imóvel cadastrado ainda.
              </p>
            ) : (
              <div style={s.imovelList}>
                {imoveisModal.map((im) => {
                  const associado = im.modeloContratoId === associando.id;
                  const emOutro = im.modeloContratoId && !associado;
                  return (
                    <div key={im.id} style={s.imovelRow}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "14px", color: "#374151", fontWeight: 600 }}>
                          {im.logradouro}{im.numero ? `, ${im.numero}` : ""}
                          {im.complemento ? ` - ${im.complemento}` : ""}
                        </span>
                        {emOutro && (
                          <span style={{ fontSize: "11px", color: "#b45309" }}>
                            Já usa outro modelo — associar troca automaticamente
                          </span>
                        )}
                      </div>
                      <button
                        style={{ ...s.btnAssocToggle, ...(associado ? s.btnAssocOk : {}) }}
                        onClick={() => alternarAssociacao(im)}
                        disabled={salvandoAssoc === im.id}
                      >
                        {salvandoAssoc === im.id ? "..." : associado ? "✓ Associado" : "Associar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button style={s.btnAdd} onClick={fecharAssociacao}>Concluir</button>
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
  btnAssoc: { background: "#ecfdf5", color: "#047857", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  imovelList: { display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto", marginBottom: "4px" },
  imovelRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f9fafb", borderRadius: "8px", gap: "12px" },
  btnAssocToggle: { background: "#eff6ff", color: "#2563eb", border: "none", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  btnAssocOk: { background: "#dcfce7", color: "#16a34a" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal: { background: "#fff", borderRadius: "16px", padding: "1.75rem", maxWidth: "440px", width: "100%" },
  modalTitle: { fontSize: "18px", fontWeight: 700, margin: "0 0 1rem" },
  modalText: { fontSize: "14px", color: "#374151", margin: "0 0 1rem", lineHeight: 1.6 },
  warnBox: { background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px", padding: "12px 14px", marginBottom: "1.25rem" },
  modalRow: { display: "flex", gap: "8px", justifyContent: "flex-end" },
  btnSec: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "9px 18px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", cursor: "pointer" },
  btnDanger: { background: "#dc2626", color: "#fff", border: "none", padding: "9px 18px", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
};
