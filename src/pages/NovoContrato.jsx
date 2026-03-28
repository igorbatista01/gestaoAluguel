import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

// ── Máscaras ────────────────────────────────────────────────────────────────

function soDigitos(v, maxLen) {
  return v.replace(/\D/g, "").substring(0, maxLen);
}

function maskDate(value) {
  const d = soDigitos(value, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function maskCPF(value) {
  const d = soDigitos(value, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskRG(value) {
  return value.replace(/[^\dXx]/g, "").toUpperCase().substring(0, 15);
}

function maskMoney(value) {
  const digits = soDigitos(String(value), 12);
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rawCPF(v) { return v.replace(/\D/g, ""); }
function rawRG(v) { return v.replace(/[^\dXx]/g, "").toUpperCase(); }
function rawMoney(v) {
  // "1.500,00" → "1500.00"
  return String(v).replace(/\./g, "").replace(",", ".");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidDate(date) {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(date)) return false;
  const [d, m, y] = date.split("/").map(Number);
  if (y < 1000 || y > 3000 || m < 1 || m > 12) return false;
  const ml = [31, (y % 400 === 0 || (y % 100 !== 0 && y % 4 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d > 0 && d <= ml[m - 1];
}

function calcDataFim(inicio, meses) {
  if (!isValidDate(inicio) || !meses) return "—";
  const d = new Date(inicio.split("/").reverse().join("/"));
  d.setMonth(d.getMonth() + parseInt(meses, 10));
  return d.toLocaleDateString("pt-BR");
}

function substituirVariaveis(html, vars) {
  let resultado = html;
  Object.entries(vars).forEach(([key, value]) => {
    // Usa String(value) para não cair no fallback quando value é "" (string vazia é falsy)
    const substituto = (value !== undefined && value !== null) ? String(value) : `{{${key}}}`;
    resultado = resultado.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), substituto);
  });
  // Remove os botões × dos chips antes de processar o chip externo
  resultado = resultado.replace(/<span[^>]*class="var-chip-x"[^>]*>[\s\S]*?<\/span>/g, "");
  // Remove as spans var-chip, mantendo só o conteúdo interno (o {{key}} já foi substituído acima)
  resultado = resultado.replace(
    /<span[^>]*class="var-chip"[^>]*contenteditable="false"[^>]*>([\s\S]*?)<\/span>/g,
    "$1"
  );
  return resultado;
}

// ── StepBar ──────────────────────────────────────────────────────────────────

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

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ color: "#6b7280", fontSize: "13px" }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: "13px" }}>{value || "—"}</span>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function NovoContrato() {
  const { user, perfil } = useAuth();
  const [step, setStep] = useState(1);

  // Imóveis do Firestore
  const [imoveis, setImoveis] = useState([]);
  const [loadingImoveis, setLoadingImoveis] = useState(true);
  const [imovelSelecionado, setImovelSelecionado] = useState(null);
  const [templateHtml, setTemplateHtml] = useState(null);   // HTML do modelo associado
  const [templateId, setTemplateId] = useState(null);       // ID do modelo associado
  const [templateNome, setTemplateNome] = useState(null);   // Nome do modelo associado

  // Modal "imóvel ocupado"
  const [confirmOcupado, setConfirmOcupado] = useState(false);
  const [imovelPendente, setImovelPendente] = useState(null);

  // Formulário do locatário
  const [form, setForm] = useState({
    nomeAlugante: "", rg: "", cpf: "", maritalStatus: "solteiro",
    birthdate: "", dataInicioContrato: "", diaPagamento: "", tempoContrato: "24", valorAluguel: "",
  });

  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleDate = (key) => (e) => set(key, maskDate(e.target.value));
  const handleCPF = (e) => set("cpf", maskCPF(e.target.value));
  const handleRG = (e) => set("rg", maskRG(e.target.value));
  const handleMoney = (e) => set("valorAluguel", maskMoney(e.target.value));

  // Carrega imóveis do usuário
  const carregarImoveis = useCallback(async () => {
    if (!user) return;
    setLoadingImoveis(true);
    try {
      const q = query(
        collection(db, "imoveis"),
        where("uid", "==", user.uid),
        orderBy("criadoEm", "desc")
      );
      const snap = await getDocs(q);
      setImoveis(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Erro ao carregar imóveis:", err);
    } finally {
      setLoadingImoveis(false);
    }
  }, [user]);

  useEffect(() => { carregarImoveis(); }, [carregarImoveis]);

  // Carrega o template do modelo associado ao imóvel
  async function carregarTemplate(modeloId) {
    try {
      const snap = await getDoc(doc(db, "modelos_contrato", modeloId));
      if (snap.exists()) {
        const d = snap.data();
        return { html: d.conteudo || null, nome: d.nome || null };
      }
    } catch { /* sem template */ }
    return { html: null, nome: null };
  }

  // Clique em um card de imóvel
  async function selecionarImovel(im) {
    // Carrega template se existir
    let tmpl = { html: null, nome: null };
    if (im.modeloContratoId) {
      tmpl = await carregarTemplate(im.modeloContratoId);
    }

    // Se imóvel ocupado, mostra modal de confirmação (passa tmpl inteiro pro modal)
    if (im.inquilino?.nome) {
      setImovelPendente({ im, tmpl });
      setConfirmOcupado(true);
      return;
    }

    setTemplateHtml(tmpl.html);
    setTemplateId(im.modeloContratoId || null);
    setTemplateNome(tmpl.nome);
    setImovelSelecionado(im);
    setStep(2);
  }

  // Usuário decide o que fazer com imóvel ocupado
  function confirmarOcupado(usarExistente) {
    const { im, tmpl } = imovelPendente;
    setConfirmOcupado(false);
    setImovelPendente(null);
    setTemplateHtml(tmpl.html);
    setTemplateId(im.modeloContratoId || null);
    setTemplateNome(tmpl.nome);
    setImovelSelecionado(im);

    if (usarExistente && im.inquilino) {
      setForm((f) => ({
        ...f,
        nomeAlugante: im.inquilino.nome || "",
        rg: im.inquilino.rg || "",
        cpf: im.inquilino.cpf || "",
        maritalStatus: im.inquilino.estadoCivil || "solteiro",
        birthdate: im.inquilino.dataNascimento || "",
      }));
    } else {
      setForm((f) => ({ ...f, nomeAlugante: "", rg: "", cpf: "", maritalStatus: "solteiro", birthdate: "" }));
    }
    setStep(2);
  }

  function validateStep(n) {
    const errs = [];
    if (n === 1) {
      if (!imovelSelecionado) errs.push("Selecione um imóvel.");
    }
    if (n === 2) {
      if (!form.nomeAlugante.trim()) errs.push("Nome obrigatório.");
      const rg = rawRG(form.rg);
      if (!rg || rg.length < 4) errs.push("RG inválido (mínimo 4 caracteres).");
      const cpf = rawCPF(form.cpf);
      if (cpf.length !== 11) errs.push("CPF inválido (11 dígitos).");
      if (!isValidDate(form.birthdate)) errs.push("Data de nascimento inválida (DD/MM/AAAA).");
    }
    if (n === 3) {
      if (!isValidDate(form.dataInicioContrato)) errs.push("Data de início inválida (DD/MM/AAAA).");
      if (!/^([1-9]|[12]\d|3[01])$/.test(form.diaPagamento)) errs.push("Dia de pagamento inválido (1–31).");
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
      const im = imovelSelecionado;
      const enderecoImovel = [im.logradouro, im.numero, im.complemento, im.bairro, im.cidade, im.estado]
        .filter(Boolean).join(", ");

      // Monta o mapa de variáveis — chaves idênticas ao VARIAVEIS em ModeloContrato.jsx
      const vars = {
        // Inquilino
        nome_inquilino: form.nomeAlugante,
        rg_inquilino: form.rg,
        cpf_inquilino: form.cpf,
        data_nascimento_inquilino: form.birthdate,
        email_inquilino: "",
        telefone_inquilino: "",
        // Imóvel
        logradouro_imovel: im.logradouro || "",
        numero_imovel: im.numero || "",
        complemento_imovel: im.complemento || "",
        bairro_imovel: im.bairro || "",
        cidade_imovel: im.cidade || "",
        estado_imovel: im.estado || "",
        cep_imovel: im.cep || "",
        num_comodos: String(im.quartos || ""),
        endereco_completo: enderecoImovel,
        // Contrato
        data_contrato: new Date().toLocaleDateString("pt-BR"),
        data_inicio: form.dataInicioContrato,
        data_fim: calcDataFim(form.dataInicioContrato, form.tempoContrato),
        valor_aluguel: `R$ ${form.valorAluguel}`,
        dia_vencimento: form.diaPagamento,
        duracao_meses: form.tempoContrato,
        // Proprietário
        nome_proprietario: perfil?.nomeCompleto || user?.displayName || user?.email || "",
        cpf_proprietario: perfil?.cpf || "",
      };

      const body = {
        nomeAlugante: form.nomeAlugante,
        rg: rawRG(form.rg),
        cpf: rawCPF(form.cpf),
        maritalStatus: form.maritalStatus,
        birthdate: form.birthdate,
        dataInicioContrato: form.dataInicioContrato,
        diaPagamento: form.diaPagamento,
        tempoContrato: form.tempoContrato,
        valorAluguel: rawMoney(form.valorAluguel),
        // Campos legados que o backend ainda pode usar se não tiver customHtml
        numImovel: im.logradouro || "imovel",
        numCasa: im.numero || "1",
      };

      // Se há template, substitui variáveis e envia como customHtml
      if (templateHtml) {
        body.customHtml = substituirVariaveis(templateHtml, vars);
      }

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
        imovelId: im.id,
        enderecoImovel: enderecoImovel,
        criadoEm: serverTimestamp(),
        dataFim: calcDataFim(form.dataInicioContrato, form.tempoContrato),
      });

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setErrors(["Erro inesperado. Tente novamente."]);
    } finally {
      setLoading(false);
    }
  }

  function novoContrato() {
    setStep(1);
    setImovelSelecionado(null);
    setTemplateHtml(null);
    setTemplateId(null);
    setTemplateNome(null);
    setForm({
      nomeAlugante: "", rg: "", cpf: "", maritalStatus: "solteiro",
      birthdate: "", dataInicioContrato: "", diaPagamento: "", tempoContrato: "24", valorAluguel: "",
    });
    setSuccess(false);
    setErrors([]);
  }

  const enderecoDisplay = imovelSelecionado
    ? [imovelSelecionado.logradouro, imovelSelecionado.numero].filter(Boolean).join(", ")
    : "";

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
          {/* ── Step 1: Imóvel ── */}
          {step === 1 && (
            <div style={s.section}>
              <p style={s.sectionTitle}>Selecione o imóvel</p>

              {loadingImoveis ? (
                <p style={{ color: "#9ca3af", fontSize: "14px" }}>Carregando imóveis...</p>
              ) : imoveis.length === 0 ? (
                <div style={s.emptyBox}>
                  <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>
                    Nenhum imóvel cadastrado. Cadastre um imóvel antes de gerar um contrato.
                  </p>
                  <a href="/imoveis" style={{ color: "#2563eb", fontSize: "14px", fontWeight: 600 }}>
                    Ir para Imóveis →
                  </a>
                </div>
              ) : (
                <div style={s.imovelGrid}>
                  {imoveis.map((im) => {
                    const endereco = [im.logradouro, im.numero].filter(Boolean).join(", ");
                    const ocupado = Boolean(im.inquilino?.nome);
                    const temModelo = Boolean(im.modeloContratoId);
                    return (
                      <div
                        key={im.id}
                        onClick={() => selecionarImovel(im)}
                        style={{
                          ...s.imovelCard,
                          ...(imovelSelecionado?.id === im.id ? s.imovelCardActive : {}),
                        }}
                      >
                        <div style={s.imovelCardTitle}>{endereco || "Imóvel sem endereço"}</div>
                        {im.bairro && <div style={s.imovelCardSub}>{im.bairro}{im.cidade ? ` — ${im.cidade}` : ""}</div>}
                        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                          {ocupado && (
                            <span style={s.tagOcupado}>🔴 Ocupado</span>
                          )}
                          {!ocupado && (
                            <span style={s.tagLivre}>🟢 Livre</span>
                          )}
                          {temModelo && (
                            <span style={s.tagModelo}>📄 Com modelo</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={s.actions}>
                <span />
                <button onClick={next} style={s.btn} disabled={imoveis.length === 0}>Próximo →</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Locatário ── */}
          {step === 2 && (
            <div style={s.section}>
              <p style={s.sectionTitle}>Dados do locatário</p>
              {imovelSelecionado && (
                <div style={s.imovelInfo}>
                  📍 <strong>{enderecoDisplay}</strong>
                  {templateHtml && templateId && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
                      <span style={s.tagModelo}>📄 {templateNome || "Modelo associado"}</span>
                      <a
                        href={`/modelos/${templateId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                      >
                        Editar modelo ↗
                      </a>
                    </span>
                  )}
                </div>
              )}
              <div style={s.formGroup}>
                <label style={s.label}>Nome completo</label>
                <input
                  value={form.nomeAlugante}
                  onChange={(e) => set("nomeAlugante", e.target.value)}
                  placeholder="Nome completo do locatário"
                  style={s.input}
                />
              </div>
              <div style={s.grid2}>
                <div style={s.formGroup}>
                  <label style={s.label}>RG</label>
                  <input
                    value={form.rg}
                    onChange={handleRG}
                    placeholder="000000000"
                    inputMode="text"
                    style={s.input}
                  />
                  <span style={s.hint}>Números e X — padrão varia por estado</span>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>CPF</label>
                  <input
                    value={form.cpf}
                    onChange={handleCPF}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    style={s.input}
                  />
                </div>
              </div>
              <div style={s.grid2}>
                <div style={s.formGroup}>
                  <label style={s.label}>Data de nascimento</label>
                  <input
                    value={form.birthdate}
                    onChange={handleDate("birthdate")}
                    placeholder="DD/MM/AAAA"
                    inputMode="numeric"
                    maxLength={10}
                    style={s.input}
                  />
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

          {/* ── Step 3: Contrato ── */}
          {step === 3 && (
            <div style={s.section}>
              <p style={s.sectionTitle}>Condições do contrato</p>
              <div style={s.grid2}>
                <div style={s.formGroup}>
                  <label style={s.label}>Data de início</label>
                  <input
                    value={form.dataInicioContrato}
                    onChange={handleDate("dataInicioContrato")}
                    placeholder="DD/MM/AAAA"
                    inputMode="numeric"
                    maxLength={10}
                    style={s.input}
                  />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Duração (meses)</label>
                  <input
                    type="number"
                    value={form.tempoContrato}
                    onChange={(e) => set("tempoContrato", e.target.value)}
                    placeholder="24"
                    min="1"
                    style={s.input}
                  />
                </div>
              </div>
              <div style={s.grid2}>
                <div style={s.formGroup}>
                  <label style={s.label}>Valor do aluguel</label>
                  <div style={s.moneyWrap}>
                    <span style={s.moneyPrefix}>R$</span>
                    <input
                      value={form.valorAluguel}
                      onChange={handleMoney}
                      placeholder="1.500,00"
                      inputMode="numeric"
                      style={{ ...s.input, paddingLeft: "36px" }}
                    />
                  </div>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Dia de vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.diaPagamento}
                    onChange={(e) => set("diaPagamento", e.target.value)}
                    placeholder="5"
                    style={s.input}
                  />
                </div>
              </div>
              <div style={s.actions}>
                <button onClick={() => setStep(2)} style={s.btnSecondary}>← Voltar</button>
                <button onClick={next} style={s.btn}>Revisar →</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Revisar ── */}
          {step === 4 && (
            <div style={s.section}>
              <p style={s.sectionTitle}>Revise os dados antes de gerar</p>
              <div style={s.reviewGrid}>
                <ReviewRow label="Imóvel" value={enderecoDisplay} />
                <ReviewRow label="Bairro/Cidade" value={[imovelSelecionado?.bairro, imovelSelecionado?.cidade].filter(Boolean).join(" — ")} />
                <ReviewRow label="Modelo de contrato" value={templateHtml ? (templateNome || "Modelo personalizado") : "Contrato padrão"} />
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

      {/* ── Modal: imóvel ocupado ── */}
      {confirmOcupado && imovelPendente && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Imóvel já ocupado</h3>
            <p style={s.modalText}>
              Este imóvel já tem um inquilino cadastrado:{" "}
              <strong>{imovelPendente.im.inquilino?.nome}</strong>.
              Como deseja prosseguir?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                style={s.btnOpcao}
                onClick={() => confirmarOcupado(true)}
              >
                Usar dados de <strong style={{ marginLeft: "4px" }}>{imovelPendente.im.inquilino?.nome}</strong>
              </button>
              <button
                style={{ ...s.btnOpcao, background: "#f9fafb", color: "#374151" }}
                onClick={() => confirmarOcupado(false)}
              >
                Preencher manualmente
              </button>
            </div>
            <button
              style={s.btnCancelar}
              onClick={() => { setConfirmOcupado(false); setImovelPendente(null); }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { maxWidth: "680px", margin: "0 auto", padding: "2rem 1rem" },
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
  imovelInfo: { background: "#eff6ff", borderRadius: "8px", padding: "8px 12px", marginBottom: "1rem", fontSize: "13px", color: "#1e40af" },
  emptyBox: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px", padding: "1rem 0" },
  imovelGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" },
  imovelCard: { border: "2px solid #e5e7eb", borderRadius: "12px", padding: "1rem", cursor: "pointer", transition: "all .15s" },
  imovelCardActive: { border: "2px solid #2563eb", background: "#eff6ff" },
  imovelCardTitle: { fontWeight: 600, fontSize: "14px", color: "#111827" },
  imovelCardSub: { fontSize: "12px", color: "#6b7280", marginTop: "4px" },
  tagOcupado: { fontSize: "11px", background: "#fee2e2", color: "#991b1b", borderRadius: "20px", padding: "2px 8px", fontWeight: 600 },
  tagLivre: { fontSize: "11px", background: "#dcfce7", color: "#166534", borderRadius: "20px", padding: "2px 8px", fontWeight: 600 },
  tagModelo: { fontSize: "11px", background: "#ede9fe", color: "#5b21b6", borderRadius: "20px", padding: "2px 8px", fontWeight: 600 },
  formGroup: { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "1rem" },
  label: { fontSize: "13px", fontWeight: 600, color: "#374151" },
  hint: { fontSize: "11px", color: "#9ca3af", marginTop: "2px" },
  input: { padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  moneyWrap: { position: "relative" },
  moneyPrefix: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "#6b7280", pointerEvents: "none" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  reviewGrid: { display: "flex", flexDirection: "column", marginBottom: "1.5rem" },
  actions: { display: "flex", justifyContent: "space-between", marginTop: "1.5rem", gap: "8px" },
  btn: { background: "#2563eb", color: "#fff", border: "none", padding: "11px 24px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },
  btnSecondary: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "11px 20px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", cursor: "pointer" },
  // Modal ocupado
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal: { background: "#fff", borderRadius: "16px", padding: "1.75rem", maxWidth: "420px", width: "100%" },
  modalTitle: { fontSize: "18px", fontWeight: 700, margin: "0 0 0.75rem" },
  modalText: { fontSize: "14px", color: "#374151", margin: "0 0 1.25rem", lineHeight: 1.6 },
  btnOpcao: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "12px 16px", borderRadius: "10px", fontWeight: 600, fontSize: "14px", cursor: "pointer", textAlign: "left", width: "100%" },
  btnCancelar: { marginTop: "12px", background: "none", border: "none", color: "#9ca3af", fontSize: "13px", cursor: "pointer", width: "100%", textAlign: "center", padding: "6px" },
};
