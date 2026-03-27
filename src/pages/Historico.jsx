import { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Historico() {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, "contratos"), orderBy("criadoEm", "desc"));
        const snap = await getDocs(q);
        setContratos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtrado = contratos.filter((c) =>
    c.nomeAlugante?.toLowerCase().includes(busca.toLowerCase())
  );

  function statusContrato(dataFim) {
    if (!dataFim || dataFim === "—") return { label: "—", color: "#6b7280", bg: "#f3f4f6" };
    const [d, m, y] = dataFim.split("/").map(Number);
    const fim = new Date(y, m - 1, d);
    const hoje = new Date();
    const diff = Math.floor((fim - hoje) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "Encerrado", color: "#991b1b", bg: "#fee2e2" };
    if (diff <= 30) return { label: `Vence em ${diff}d`, color: "#92400e", bg: "#fef3c7" };
    if (diff <= 60) return { label: `Vence em ${diff}d`, color: "#854f0b", bg: "#fef9c3" };
    return { label: "Vigente", color: "#166534", bg: "#dcfce7" };
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>Histórico de contratos</h2>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          style={s.search}
        />
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : filtrado.length === 0 ? (
        <div style={s.empty}>Nenhum contrato encontrado.</div>
      ) : (
        <div style={s.list}>
          {filtrado.map((c) => {
            const status = statusContrato(c.dataFim);
            return (
              <div key={c.id} style={s.card}>
                <div style={s.cardTop}>
                  <div>
                    <div style={s.nome}>{c.nomeAlugante}</div>
                    <div style={s.sub}>Estrada Baviera, {c.numImovel} — Casa {c.numCasa}</div>
                  </div>
                  <span style={{ ...s.badge, color: status.color, background: status.bg }}>
                    {status.label}
                  </span>
                </div>
                <div style={s.cardBottom}>
                  <span>Início: <b>{c.dataInicioContrato}</b></span>
                  <span>Término: <b>{c.dataFim}</b></span>
                  <span>Aluguel: <b>R$ {c.valorAluguel}</b></span>
                  <span>Vence dia: <b>{c.diaPagamento}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { maxWidth: "720px", margin: "0 auto", padding: "2rem 1rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" },
  title: { fontSize: "22px", fontWeight: 700, margin: 0 },
  search: { padding: "9px 14px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", width: "220px" },
  empty: { textAlign: "center", color: "#9ca3af", padding: "3rem" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  card: { background: "#fff", borderRadius: "14px", padding: "1.25rem", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" },
  nome: { fontWeight: 600, fontSize: "15px" },
  sub: { fontSize: "13px", color: "#6b7280", marginTop: "3px" },
  badge: { padding: "4px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" },
  cardBottom: { display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "13px", color: "#6b7280", borderTop: "1px solid #f3f4f6", paddingTop: "12px" },
};
