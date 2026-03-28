import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, collection,
  getDocs, query, where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

// ── Variáveis disponíveis ─────────────────────────────────────────────────────
const VARIAVEIS = [
  {
    grupo: "Inquilino",
    itens: [
      { key: "{{nome_inquilino}}", label: "Nome completo" },
      { key: "{{rg_inquilino}}", label: "RG" },
      { key: "{{cpf_inquilino}}", label: "CPF" },
      { key: "{{data_nascimento_inquilino}}", label: "Data de nascimento" },
      { key: "{{email_inquilino}}", label: "E-mail" },
      { key: "{{telefone_inquilino}}", label: "Telefone" },
    ],
  },
  {
    grupo: "Imóvel",
    itens: [
      { key: "{{logradouro_imovel}}", label: "Logradouro" },
      { key: "{{numero_imovel}}", label: "Número" },
      { key: "{{complemento_imovel}}", label: "Complemento" },
      { key: "{{bairro_imovel}}", label: "Bairro" },
      { key: "{{cidade_imovel}}", label: "Cidade" },
      { key: "{{estado_imovel}}", label: "Estado" },
      { key: "{{cep_imovel}}", label: "CEP" },
      { key: "{{num_comodos}}", label: "Número de cômodos" },
      { key: "{{endereco_completo}}", label: "Endereço completo" },
    ],
  },
  {
    grupo: "Contrato",
    itens: [
      { key: "{{data_contrato}}", label: "Data do contrato" },
      { key: "{{data_inicio}}", label: "Data de início" },
      { key: "{{data_fim}}", label: "Data de término" },
      { key: "{{valor_aluguel}}", label: "Valor do aluguel" },
      { key: "{{dia_vencimento}}", label: "Dia de vencimento" },
      { key: "{{duracao_meses}}", label: "Duração (meses)" },
    ],
  },
  {
    grupo: "Proprietário",
    itens: [
      { key: "{{nome_proprietario}}", label: "Nome do proprietário" },
      { key: "{{cpf_proprietario}}", label: "CPF do proprietário" },
    ],
  },
];

// ── Insere texto/HTML no contenteditable na posição do cursor ─────────────────
function insertAtCursor(html) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createElement("span");
  node.innerHTML = html;
  const frag = document.createDocumentFragment();
  let lastNode;
  while (node.firstChild) {
    lastNode = frag.appendChild(node.firstChild);
  }
  range.insertNode(frag);
  if (lastNode) {
    const r = range.cloneRange();
    r.setStartAfter(lastNode);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ModeloContrato() {
  const { id } = useParams(); // undefined = novo modelo, string = editar
  const isNew = !id;
  const { user, perfil } = useAuth();
  const navigate = useNavigate();

  const editorRef = useRef(null);
  const [nome, setNome] = useState("");
  const [conteudoInicial, setConteudoInicial] = useState(null); // HTML carregado do Firestore
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [savedId, setSavedId] = useState(null); // ID depois de salvar (para associação)
  const [showAssocModal, setShowAssocModal] = useState(false);
  const [imoveis, setImoveis] = useState([]);
  const [associando, setAssociando] = useState(null);
  const [associandoOk, setAssociandoOk] = useState(false);

  // Carrega modelo existente do Firestore
  useEffect(() => {
    if (!isNew && id) {
      getDoc(doc(db, "modelos_contrato", id)).then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setNome(d.nome || "");
          setConteudoInicial(d.conteudo || "");
        }
        setLoading(false);
      });
    }
  }, [id, isNew]);

  // Aplica o conteúdo no editor depois que ele estiver montado no DOM
  useEffect(() => {
    if (conteudoInicial !== null && editorRef.current) {
      editorRef.current.innerHTML = conteudoInicial;
    }
  }, [conteudoInicial]);

  // Executa comando de formatação
  const execCmd = useCallback((cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }, []);

  // Insere variável
  function inserirVariavel(key) {
    editorRef.current?.focus();
    insertAtCursor(
      `<span class="var-chip" contenteditable="false" style="display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 6px;font-size:0.85em;font-family:monospace;user-select:none;cursor:default;">${key}</span>`
    );
  }

  // Salvar
  async function salvar() {
    if (!nome.trim()) { setError("Dê um nome ao modelo."); return; }
    const conteudo = editorRef.current?.innerHTML || "";
    if (!conteudo.trim() || conteudo === "<br>") { setError("O modelo não pode estar vazio."); return; }

    setSaving(true);
    setError("");
    try {
      const dados = {
        uid: user.uid,
        nome: nome.trim(),
        conteudo,
        atualizadoEm: serverTimestamp(),
      };

      let docId = id;
      if (isNew) {
        dados.criadoEm = serverTimestamp();
        const ref = doc(collection(db, "modelos_contrato"));
        await setDoc(ref, dados);
        docId = ref.id;
        setSavedId(docId);
        // Busca imóveis para sugerir associação
        const q = query(collection(db, "imoveis"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setImoveis(lista);
        setShowAssocModal(true);
      } else {
        await updateDoc(doc(db, "modelos_contrato", id), dados);
        navigate("/modelos");
      }
    } catch (e) {
      setError("Erro ao salvar. Tente novamente.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function associarImovel(imovelId) {
    setAssociando(imovelId);
    await updateDoc(doc(db, "imoveis", imovelId), { modeloContratoId: savedId || id });
    setAssociando(null);
    setAssociandoOk(true);
    setTimeout(() => setAssociandoOk(false), 2000);
  }

  if (loading) return <div style={s.center}>Carregando...</div>;

  return (
    <div style={s.outer}>
      {/* ── Painel de variáveis ── */}
      <aside style={s.aside}>
        <p style={s.asideTitle}>Variáveis</p>
        <p style={s.asideHint}>Clique para inserir no texto</p>
        {VARIAVEIS.map((g) => (
          <div key={g.grupo} style={{ marginBottom: "1rem" }}>
            <p style={s.grupoLabel}>{g.grupo}</p>
            {g.itens.map((item) => (
              <button
                key={item.key}
                style={s.varBtn}
                onClick={() => inserirVariavel(item.key)}
                title={item.key}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* ── Editor ── */}
      <div style={s.editorCol}>
        <div style={s.topBar}>
          <input
            style={s.nomeInput}
            placeholder="Nome do modelo (ex: Contrato de Locação Residencial)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={s.btnSec} onClick={() => navigate("/modelos")}>Cancelar</button>
            <button
              style={{ ...s.btnSave, opacity: saving ? 0.7 : 1 }}
              onClick={salvar}
              disabled={saving}
            >
              {saving ? "Salvando..." : isNew ? "✓ Salvar modelo" : "✓ Salvar alterações"}
            </button>
          </div>
        </div>

        {error && <div style={s.errBox}>{error}</div>}

        {/* Toolbar de formatação */}
        <div style={s.toolbar}>
          <select
            style={s.toolSelect}
            onChange={(e) => execCmd("fontSize", e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Tamanho</option>
            <option value="2">Pequeno</option>
            <option value="3">Normal</option>
            <option value="4">Médio</option>
            <option value="5">Grande</option>
            <option value="6">Maior</option>
          </select>
          <div style={s.sep} />
          <ToolBtn onClick={() => execCmd("bold")} title="Negrito (Ctrl+B)"><b>N</b></ToolBtn>
          <ToolBtn onClick={() => execCmd("italic")} title="Itálico (Ctrl+I)"><i>I</i></ToolBtn>
          <ToolBtn onClick={() => execCmd("underline")} title="Sublinhado (Ctrl+U)"><u>S</u></ToolBtn>
          <div style={s.sep} />
          <ToolBtn onClick={() => execCmd("justifyLeft")} title="Alinhar à esquerda">≡←</ToolBtn>
          <ToolBtn onClick={() => execCmd("justifyCenter")} title="Centralizar">≡</ToolBtn>
          <ToolBtn onClick={() => execCmd("justifyRight")} title="Alinhar à direita">≡→</ToolBtn>
          <ToolBtn onClick={() => execCmd("justifyFull")} title="Justificar">⁞≡</ToolBtn>
          <div style={s.sep} />
          <ToolBtn onClick={() => execCmd("insertUnorderedList")} title="Lista">• Lista</ToolBtn>
          <ToolBtn onClick={() => execCmd("insertOrderedList")} title="Lista numerada">1. Lista</ToolBtn>
          <div style={s.sep} />
          <ToolBtn onClick={() => execCmd("removeFormat")} title="Remover formatação">✕ Fmt</ToolBtn>
        </div>

        {/* Área de edição */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          style={s.editor}
          onPaste={(e) => {
            // Paste como texto puro (sem trazer formatação externa)
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
        />

        <p style={s.hint}>
          💡 Dica: use as variáveis do painel lateral para preencher dados automaticamente ao gerar o PDF.
        </p>
      </div>

      {/* ── Modal de associação pós-criação ── */}
      {showAssocModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>✓ Modelo criado!</h3>
            <p style={s.modalText}>
              Deseja associar este modelo a algum imóvel? Assim, toda vez que gerar um contrato para esse imóvel, este modelo será usado.
            </p>

            {imoveis.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "1rem" }}>
                Você ainda não tem imóveis cadastrados.
              </p>
            ) : (
              <div style={s.imovelList}>
                {imoveis.map((im) => (
                  <div key={im.id} style={s.imovelRow}>
                    <span style={{ fontSize: "14px", color: "#374151" }}>
                      {im.logradouro}{im.numero ? `, ${im.numero}` : ""}
                    </span>
                    <button
                      style={{
                        ...s.btnAssoc,
                        ...(im.modeloContratoId === (savedId || id) ? s.btnAssocOk : {}),
                      }}
                      onClick={() => associarImovel(im.id)}
                      disabled={associando === im.id || im.modeloContratoId === (savedId || id)}
                    >
                      {im.modeloContratoId === (savedId || id)
                        ? "✓ Associado"
                        : associando === im.id
                        ? "..."
                        : "Associar"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button style={s.btnSave} onClick={() => navigate("/modelos")}>
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ onClick, children, title }) {
  return (
    <button style={s.toolBtn} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

const s = {
  outer: { display: "flex", height: "calc(100vh - 52px)", overflow: "hidden" },
  aside: {
    width: "220px", flexShrink: 0, background: "#f9fafb", borderRight: "1px solid #e5e7eb",
    padding: "1rem", overflowY: "auto",
  },
  asideTitle: { fontSize: "13px", fontWeight: 700, color: "#374151", margin: "0 0 2px" },
  asideHint: { fontSize: "11px", color: "#9ca3af", margin: "0 0 1rem" },
  grupoLabel: { fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" },
  varBtn: {
    display: "block", width: "100%", textAlign: "left", background: "#fff",
    border: "1px solid #e5e7eb", borderRadius: "6px", padding: "5px 8px",
    fontSize: "12px", color: "#1d4ed8", cursor: "pointer", marginBottom: "4px",
    fontWeight: 500,
  },
  editorCol: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar: {
    display: "flex", alignItems: "center", gap: "12px", padding: "10px 1.25rem",
    borderBottom: "1px solid #e5e7eb", background: "#fff", flexWrap: "wrap",
  },
  nomeInput: {
    flex: 1, border: "1px solid #d1d5db", borderRadius: "8px",
    padding: "8px 12px", fontSize: "14px", fontWeight: 500, minWidth: "200px",
  },
  btnSec: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" },
  btnSave: { background: "#2563eb", color: "#fff", border: "none", padding: "8px 18px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
  errBox: { background: "#fee2e2", color: "#991b1b", padding: "8px 14px", fontSize: "13px", margin: "0 1.25rem 0" },
  toolbar: {
    display: "flex", alignItems: "center", gap: "2px", padding: "6px 1.25rem",
    borderBottom: "1px solid #e5e7eb", background: "#fff", flexWrap: "wrap",
  },
  toolBtn: {
    background: "none", border: "1px solid transparent", borderRadius: "4px",
    padding: "3px 7px", fontSize: "13px", cursor: "pointer", color: "#374151",
    lineHeight: 1.4,
  },
  toolSelect: {
    border: "1px solid #d1d5db", borderRadius: "4px", padding: "2px 4px",
    fontSize: "12px", background: "#fff", cursor: "pointer",
  },
  sep: { width: "1px", height: "20px", background: "#e5e7eb", margin: "0 4px" },
  editor: {
    flex: 1, padding: "2rem 3rem", overflowY: "auto", outline: "none",
    fontSize: "14px", lineHeight: 1.8, color: "#111827",
    fontFamily: "'Times New Roman', Times, serif",
    background: "#fff",
  },
  hint: { fontSize: "12px", color: "#9ca3af", padding: "6px 1.25rem", margin: 0, borderTop: "1px solid #f3f4f6" },
  center: { textAlign: "center", padding: "4rem", color: "#9ca3af" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" },
  modal: { background: "#fff", borderRadius: "16px", padding: "1.75rem", maxWidth: "480px", width: "100%" },
  modalTitle: { fontSize: "18px", fontWeight: 700, margin: "0 0 0.75rem", color: "#16a34a" },
  modalText: { fontSize: "14px", color: "#374151", margin: "0 0 1rem", lineHeight: 1.6 },
  imovelList: { display: "flex", flexDirection: "column", gap: "8px", maxHeight: "220px", overflowY: "auto", marginBottom: "4px" },
  imovelRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f9fafb", borderRadius: "8px" },
  btnAssoc: { background: "#eff6ff", color: "#2563eb", border: "none", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  btnAssocOk: { background: "#dcfce7", color: "#16a34a" },
};
