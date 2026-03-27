import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

const IMOVEIS = {
  "1898": {
    label: "Estrada Baviera, 1898 (antigo 113A)",
    casas: ["1", "2", "3", "4"],
    descCasa: { "1": "2 cômodos", "2": "2 cômodos", "3": "2 cômodos", "4": "2 cômodos" },
  },
  "105": {
    label: "Estrada Baviera, 105",
    casas: ["1", "2", "3"],
    descCasa: { "1": "3 cômodos (sala, cozinha, quarto)", "2": "4 cômodos (2 quartos, sala, cozinha)", "3": "2 cômodos (cozinha, quarto)" },
  },
};

const STEPS = ["Imóvel", "Locatário", "Contrato", "Revisar"];

function StepBar({ current }) {
  return (
    <div style={s.stepBar}>
      {STEPS.map((label, i) => {
        const state = i + 1 < current ? "done" : i + 1 === current ? "active" : "idle";
        return (
          <div key={i} style={{ ...s.step, ...(state === "done" ? s.stepDone : state === "active" ? s.stepActive : {}) }}>
            <span style={s.stepNum}>{state === "done" ? "✓" : i + 1}</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function NovoContrato() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [numImovel, setNumImovel] = useState("1898");
  const [numCasa, setNumCasa] = useState("1");
  const [form, setForm] = useState({
    nomeAlugante: "", rg: "", cpf: "", maritalStatus: "solteiro",
    birthdate: "", dataInicioContrato: "", diaPagamento: "", tempoContrato: "24", valorAluguel: "",
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validateStep(n) {
    const errs = [];
    if (n === 1) {
      if (!numImovel) errs.push("Selecione o imóvel.");
      if (!numCasa) errs.push("Selecione a casa.");
    }
    if (n === 2) {
      if (!form.nomeAlugante.trim()) errs.push("Nome obrigatório.");
      if (!/^\d{1,15}$/.test(form.rg)) errs.push("RG inválido (somente números).");
      if (!/^\d{11}$/.test(form.cpf)) errs.push("CPF inválido (11 dígitos, somente números).");
      if (!isValidDate(form.birthdate)) errs.push("Data de nascimento inválida (DD/MM/AAAA).");
    }
    if (n === 3) {
      if (!isValidDate(form.dataInicioContrato)) errs.push("Data de início inválida (DD/MM/AAAA).");
      if (!/^([1-9]|[12]\d|3[01])$/.test(form.diaPagamento)) errs.push("Dia de pagamento inválido (1-31).");
      if (!form.tempoContrato) errs.push("Informe o tempo de contrato.");
      if (!form.valorAluguel) errs.push("Informe o valor do aluguel.");
    }
    return errs;
  }

  function next() {
    const errs = validateStep(step);
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setStep((s) => s + 1);
  }

  async function gerarPDF() {
    setLoading(true);
    setErrors([]);
    try {
      const body = { ...form, numImovel, numCasa };
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors(data.errors || ["Erro ao gerar PDF."]);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${form.nomeAlugante.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      await addDoc(collection(db, "contratos"), {
        ...body,
        uid: user.uid,
        criadoEm: serverTimestamp(),
        dataFim: calcDataFim(form.dataInicioContrato, form.tempoContrato),
      });

      setSuccess(true);
    } catch (err) {
      setErrors(["Erro inesperado. Tente novamente."]);
    } finally {
      setLoading(false);
    }
  }

  function novoContrato() {
    setStep(1); setForm({ nomeAlugante:"", rg:"", cpf:"", maritalStatus:"solteiro", birthdate:"", dataInicioContrato:"", diaPagamento:"", tempoContrato:"24", valorAluguel:"" });
    setNumImovel("1898"); setNumCasa("1"); setSuccess(false); setErrors([]);
  }

  const imovelInfo = IMOVEIS[numImovel];

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Novo contrato</h2>
      <StepBar current={step} />

      {errors.length > 0 && (
        <div style={s.errorBox}>
          {errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}

      {success ? (
        <div style={s.successBox}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>✅</div>
          <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Contrato gerado!</div>
          <div style={{ color: "#6b7280", marginBottom: "1.5rem" }}>PDF baixado e salvo no histórico.</div>
          <button onClick={novoContrato} style={s.btn}>Gerar novo contrato</button>
        </div>
      ) : (
        <>
          {step === 1 && (
            <div style={s.section}>
              <p style={s.sectionTitle}>Selecione o imóvel</p>
              <div style={s.imovelGrid}>
                {Object.entries(IMOVEIS).map(([num, info]) => (
                  <div key={num} onClick={() => { setNumImovel(num); setNumCasa("1"); }}
                    style={{ ...s.imovelCard, ...(numImovel === num ? s.imovelCardActive : {}) }}>
                    <div style={s.imovelCardTitle}>Estrada Baviera, {num}</div>
                    <div style={s.imovelCardSub}>{info.casas.length} casas disponíveis</div>
                  </div>
                ))}
              </div>

              <p style={{ ...s.sectionTitle, marginTop: "1.5rem" }}>Selecione a casa</p>
              <div style={s.casaGrid}>
                {imovelInfo.casas.map((c) => (
                  <div key={c} onClick={() => setNumCasa(c)}
                    style={{ ...s.casaBtn, ...(numCasa === c ? s.casaBtnActive : {}) }}>
                    <div style={{ fontWeight: 600 }}>Casa {c}</div>
                    <div style={{ fontSize: "12px", color: numCasa === c ? "#bfdbfe" : "#9ca3af", marginTop: "4px" }}>
                      {imovelInfo.descCasa[c]}
                    </div>
                  </div>
                ))}
              </div>

              <div style={s.actions}>
                <button onClick={next} style={s.btn}>Próximo →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={s.section}>
              <p style={s.sectionTitle}>Dados do locatário</p>
              <div style={s.formGroup}>
                <label style={s.label}>Nome completo</label>
                <input value={form.nomeAlugante} onChange={(e) => set("nomeAlugante", e.target.value)} placeholder="Nome completo do locatário" style={s.input} />
              </div>
              <div style={s.grid2}>
                <div style={s.formGroup}>
                  <label style={s.label}>RG (só números)</label>
                  <input value={form.rg} onChange={(e) => set("rg", e.target.value)} placeholder="0000000" style={s.input} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>CPF (11 dígitos, só números)</label>
                  <input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="00000000000" maxLength={11} style={s.input} />
                </div>
              </div>
              <div style={s.grid2}>
                <div style={s.formGroup}>
                  <label style={s.label}>Data de nascimento</label>
                  <input value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} placeholder="DD/MM/AAAA" style={s.input} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Estado civil</label>
                  <select value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)} style={s.input}>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                  </select>
                </div>
              </div>
              <div style={s.actions}>
                <button onClick={() => setStep(1)} style={s.btnSecondary}>← Voltar</button>
                <button onClick={next} style={s.btn}>Próximo →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={s.section}>
              <p style={s.sectionTitle}>Condições do contrato</p>
              <div style={s.grid2}>
                <div style={s.formGroup}>
                  <label style={s.label}>Data de início</label>
                  <input value={form.dataInicioContrato} onChange={(e) => set("dataInicioContrato", e.target.value)} placeholder="DD/MM/AAAA" style={s.input} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Duração (meses)</label>
                  <input type="number" value={form.tempoContrato} onChange={(e) => set("tempoContrato", e.target.value)} placeholder="24" style={s.input} />
                </div>
              </div>
              <div style={s.grid2}>
                <div style={s.formGroup}>
                  <label style={s.label}>Valor do aluguel (R$)</label>
                  <input type="number" value={form.valorAluguel} onChange={(e) => set("valorAluguel", e.target.value)} placeholder="700" style={s.input} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Dia de vencimento</label>
                  <input type="number" min="1" max="31" value={form.diaPagamento} onChange={(e) => set("diaPagamento", e.target.value)} placeholder="5" style={s.input} />
                </div>
              </div>
              <div style={s.actions}>
                <button onClick={() => setStep(2)} style={s.btnSecondary}>← Voltar</button>
                <button onClick={next} style={s.btn}>Revisar →</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={s.section}>
              <p style={s.sectionTitle}>Revise os dados antes de gerar</p>
              <div style={s.reviewGrid}>
                <ReviewRow label="Imóvel" value={`Estrada Baviera, ${numImovel} — Casa ${numCasa}`} />
                <ReviewRow label="Descrição" value={IMOVEIS[numImovel].descCasa[numCasa]} />
                <ReviewRow label="Locatário" value={form.nomeAlugante} />
                <ReviewRow label="RG" value={form.rg} />
                <ReviewRow label="CPF" value={form.cpf} />
                <ReviewRow label="Nascimento" value={form.birthdate} />
                <ReviewRow label="Estado civil" value={form.maritalStatus} />
                <ReviewRow label="Início" value={form.dataInicioContrato} />
                <ReviewRow label="Duração" value={`${form.tempoContrato} meses`} />
                <ReviewRow label="Término" value={calcDataFim(form.dataInicioContrato, form.tempoContrato)} />
                <ReviewRow label="Aluguel" value={`R$ ${form.valorAluguel}`} />
                <ReviewRow label="Vencimento" value={`Todo dia ${form.diaPagamento}`} />
              </div>
              <div style={s.actions}>
                <button onClick={() => setStep(3)} style={s.btnSecondary}>← Voltar</button>
                <button onClick={gerarPDF} disabled={loading} style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Gerando PDF..." : "⬇ Gerar PDF"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ color: "#6b7280", fontSize: "13px" }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: "13px" }}>{value || "—"}</span>
    </div>
  );
}

function isValidDate(date) {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(date)) return false;
  const [d, m, y] = date.split("/").map(Number);
  if (y < 1000 || y > 3000 || m < 1 || m > 12) return false;
  const ml = [31, (y%400===0||(y%100!==0&&y%4===0))?29:28, 31,30,31,30,31,31,30,31,30,31];
  return d > 0 && d <= ml[m - 1];
}

function calcDataFim(inicio, meses) {
  if (!isValidDate(inicio) || !meses) return "—";
  const d = new Date(inicio.split("/").reverse().join("/"));
  d.setMonth(d.getMonth() + parseInt(meses, 10));
  return d.toLocaleDateString("pt-BR");
}

const s = {
  wrap: { maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem" },
  title: { fontSize: "22px", fontWeight: 700, marginBottom: "1.5rem" },
  stepBar: { display: "flex", gap: "0", marginBottom: "2rem", borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e7eb" },
  step: { flex: 1, padding: "10px 8px", textAlign: "center", fontSize: "13px", background: "#f9fafb", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", borderRight: "1px solid #e5e7eb" },
  stepActive: { background: "#eff6ff", color: "#2563eb", fontWeight: 600 },
  stepDone: { background: "#f0fdf4", color: "#16a34a" },
  stepNum: { width: "20px", height: "20px", borderRadius: "50%", background: "currentColor", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 },
  errorBox: { background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: "10px", padding: "12px 16px", marginBottom: "1.5rem", fontSize: "14px", lineHeight: 1.7 },
  successBox: { textAlign: "center", padding: "3rem 2rem", background: "#f0fdf4", borderRadius: "16px" },
  section: { background: "#fff", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  sectionTitle: { fontWeight: 600, fontSize: "15px", marginBottom: "1rem", color: "#111827" },
  imovelGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  imovelCard: { border: "2px solid #e5e7eb", borderRadius: "12px", padding: "1rem", cursor: "pointer", transition: "all .15s" },
  imovelCardActive: { border: "2px solid #2563eb", background: "#eff6ff" },
  imovelCardTitle: { fontWeight: 600, fontSize: "14px" },
  imovelCardSub: { fontSize: "12px", color: "#6b7280", marginTop: "4px" },
  casaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" },
  casaBtn: { border: "2px solid #e5e7eb", borderRadius: "10px", padding: "12px", cursor: "pointer", textAlign: "center", fontSize: "14px", transition: "all .15s" },
  casaBtnActive: { border: "2px solid #2563eb", background: "#1d4ed8", color: "white" },
  formGroup: { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "1rem" },
  label: { fontSize: "13px", fontWeight: 600, color: "#374151" },
  input: { padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", width: "100%" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  reviewGrid: { display: "flex", flexDirection: "column", marginBottom: "1.5rem" },
  actions: { display: "flex", justifyContent: "space-between", marginTop: "1.5rem", gap: "8px" },
  btn: { background: "#2563eb", color: "#fff", border: "none", padding: "11px 24px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },
  btnSecondary: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "11px 20px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", cursor: "pointer" },
};
