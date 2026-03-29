import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, getDoc, doc, query, where, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { LIMITE_IMOVEIS_NORMAL } from "../lib/validation";

export default function Imoveis() {
  const { user, nivel } = useAuth();
  const navigate = useNavigate();
  const [imoveis, setImoveis] = useState([]);
  const [proprietarios, setProprietarios] = useState({}); // { uid: nomeCompleto }
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q;
    if (nivel === "ADMIN") {
      q = query(collection(db, "imoveis"), orderBy("criadoEm", "desc"));
    } else {
      q = query(
        collection(db, "imoveis"),
        where("uid", "==", user.uid),
        orderBy("criadoEm", "desc")
      );
    }
    const snap = await getDocs(q);
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setImoveis(lista);

    // Para admin: busca os nomes dos proprietários de forma paralela
    if (nivel === "ADMIN") {
      const uids = [...new Set(lista.map((im) => im.uid).filter(Boolean))];
      const resultados = await Promise.all(
        uids.map((uid) => getDoc(doc(db, "usuarios", uid)))
      );
      const mapa = {};
      resultados.forEach((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          mapa[snap.id] = d.nomeCompleto || d.email || snap.id;
        }
      });
      setProprietarios(mapa);
    }

    setLoading(false);
  }, [user, nivel]);

  useEffect(() => { carregar(); }, [carregar]);

  const atingiuLimite = nivel === "NORMAL" && imoveis.length >= LIMITE_IMOVEIS_NORMAL;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>Imóveis</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {atingiuLimite && (
            <span style={s.limitWarn}>
              Limite de {LIMITE_IMOVEIS_NORMAL} imóveis atingido (plano NORMAL)
            </span>
          )}
          <button
            style={{ ...s.btnAdd, ...(atingiuLimite ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
            disabled={atingiuLimite}
            onClick={() => navigate("/imoveis/novo")}
          >
            + Adicionar imóvel
          </button>
        </div>
      </div>

      {loading ? (
        <p style={s.empty}>Carregando...</p>
      ) : imoveis.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={{ margin: 0, fontSize: "15px", color: "#6b7280" }}>Nenhum imóvel cadastrado ainda.</p>
          <button style={s.btnAdd} onClick={() => navigate("/imoveis/novo")}>
            + Adicionar primeiro imóvel
          </button>
        </div>
      ) : (
        <div style={s.grid}>
          {imoveis.map((im) => {
            const enderecoLinha1 = [im.logradouro, im.numero].filter(Boolean).join(", ");
            const enderecoLinha2 = im.complemento || null;
            return (
              <Link key={im.id} to={`/imoveis/${im.id}`} style={s.card}>
                <div style={s.cardTop}>
                  <div>
                    <span style={s.cardAddr}>{enderecoLinha1 || "Sem endereço"}</span>
                    {enderecoLinha2 && (
                      <span style={s.cardCompl}>{enderecoLinha2}</span>
                    )}
                  </div>
                  <span style={{ ...s.badge, ...(im.ocupado ? s.badgeOcup : s.badgeLivre) }}>
                    {im.ocupado ? "Ocupado" : "Disponível"}
                  </span>
                </div>
                {(im.bairro || im.cidade) && (
                  <div style={s.cardSub}>
                    {[im.bairro, im.cidade && im.estado ? `${im.cidade}/${im.estado}` : im.cidade].filter(Boolean).join(" — ")}
                  </div>
                )}
                <div style={s.cardInfo}>
                  {im.numComodos} cômodo{im.numComodos !== 1 ? "s" : ""}
                  {im.temLavanderia ? " · Lavanderia" : ""}
                </div>
                {im.inquilino?.nome && (
                  <div style={s.cardTenant}>👤 {im.inquilino.nome}</div>
                )}
                {nivel === "ADMIN" && im.uid && proprietarios[im.uid] && (
                  <div style={s.cardOwner}>🏠 {proprietarios[im.uid]}</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { maxWidth: "960px", margin: "0 auto", padding: "2rem 1rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" },
  title: { fontSize: "22px", fontWeight: 700, margin: 0 },
  limitWarn: { fontSize: "13px", color: "#b45309", background: "#fef3c7", padding: "5px 12px", borderRadius: "6px" },
  btnAdd: { background: "#2563eb", color: "#fff", border: "none", padding: "9px 18px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },
  emptyBox: { textAlign: "center", padding: "3rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" },
  empty: { color: "#9ca3af", textAlign: "center", padding: "3rem 0", fontSize: "14px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" },
  card: {
    background: "#fff", borderRadius: "12px", padding: "1.25rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textDecoration: "none",
    color: "inherit", display: "block",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "6px" },
  cardAddr: { fontWeight: 600, fontSize: "15px", color: "#111827", lineHeight: 1.3 },
  badge: { padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 },
  badgeOcup: { background: "#fee2e2", color: "#991b1b" },
  badgeLivre: { background: "#dcfce7", color: "#15803d" },
  cardSub: { fontSize: "13px", color: "#6b7280", marginBottom: "6px" },
  cardInfo: { fontSize: "13px", color: "#374151" },
  cardTenant: { marginTop: "8px", fontSize: "13px", color: "#2563eb" },
  cardCompl: { display: "block", fontSize: "12px", color: "#6b7280", marginTop: "2px", fontWeight: 500 },
  cardOwner: { marginTop: "6px", fontSize: "12px", color: "#7c3aed", background: "#f5f3ff", borderRadius: "4px", padding: "2px 6px", display: "inline-block" },
};
