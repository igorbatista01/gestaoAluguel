import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, query, where, orderBy,
  deleteDoc, doc, writeBatch,
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
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal: { background: "#fff", borderRadius: "16px", padding: "1.75rem", maxWidth: "440px", width: "100%" },
  modalTitle: { fontSize: "18px", fontWeight: 700, margin: "0 0 1rem" },
  modalText: { fontSize: "14px", color: "#374151", margin: "0 0 1rem", lineHeight: 1.6 },
  warnBox: { background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px", padding: "12px 14px", marginBottom: "1.25rem" },
  modalRow: { display: "flex", gap: "8px", justifyContent: "flex-end" },
  btnSec: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "9px 18px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", cursor: "pointer" },
  btnDanger: { background: "#dc2626", color: "#fff", border: "none", padding: "9px 18px", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
};
