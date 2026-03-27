# ContratFácil

Sistema web privado para gestão de contratos de aluguel. Gera contratos em PDF automaticamente a partir de um formulário, salva o histórico no banco de dados e permite acompanhar o status de cada contrato (vigente, próximo do vencimento ou encerrado).

---

## Funcionalidades

- **Login seguro** — acesso restrito por e-mail e senha via Firebase Authentication
- **Novo contrato em 4 etapas:**
  1. Seleção do imóvel e da casa
  2. Dados do locatário (nome, RG, CPF, nascimento, estado civil)
  3. Condições do contrato (data de início, duração, valor do aluguel, dia de vencimento)
  4. Revisão dos dados antes de confirmar
- **Geração de PDF** — contrato completo gerado no servidor com Puppeteer e baixado automaticamente
- **Histórico de contratos** — lista todos os contratos salvos, com busca por nome e indicador de status:
  - Verde: Vigente
  - Amarelo: Vence em menos de 60 dias
  - Laranja: Vence em menos de 30 dias
  - Vermelho: Encerrado
- **Responsivo** — funciona bem em desktop e celular

---

## Imóveis cadastrados

| Endereço | Casa | Descrição |
|---|---|---|
| Estrada Baviera, 1898 (antigo 113A) | 1, 2, 3, 4 | 2 cômodos cada |
| Estrada Baviera, 105 | 1 | 3 cômodos (sala, cozinha, quarto) |
| Estrada Baviera, 105 | 2 | 4 cômodos (2 quartos, sala, cozinha) |
| Estrada Baviera, 105 | 3 | 2 cômodos (cozinha, quarto) |

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite |
| Roteamento | React Router DOM v6 |
| Autenticação | Firebase Authentication |
| Banco de dados | Firebase Firestore |
| Geração de PDF | Puppeteer Core + @sparticuz/chromium |
| Backend (serverless) | Vercel Functions |
| Deploy | Vercel |

---

## Estrutura do projeto

```
gestaoAluguel/
├── index.html              # Entrada do Vite
├── vite.config.js          # Configuração do bundler
├── vercel.json             # Configuração de deploy e rotas da Vercel
├── package.json
├── .env.example            # Modelo das variáveis de ambiente
├── .gitignore
├── api/
│   ├── generate-pdf.js     # Serverless function — gera o PDF com Puppeteer
│   └── contract.js         # Template HTML do contrato e lógica de montagem
└── src/
    ├── main.jsx            # Ponto de entrada do React
    ├── App.jsx             # Rotas e proteção de páginas
    ├── lib/
    │   ├── firebase.js     # Inicialização do Firebase
    │   └── auth.jsx        # Context de autenticação (AuthProvider, useAuth)
    ├── components/
    │   └── Layout.jsx      # Navbar com navegação e botão de logout
    └── pages/
        ├── Login.jsx           # Página de login
        ├── NovoContrato.jsx    # Wizard de criação de contrato
        └── Historico.jsx       # Lista de contratos com busca e status
```

---

## Configuração do Firebase

### 1. Criar uma conta no Firebase

1. Acesse [firebase.google.com](https://firebase.google.com)
2. Clique em **Começar** e faça login com sua conta Google
3. No console, clique em **Criar um projeto**
4. Dê um nome ao projeto (ex: `gestao-aluguel`) e clique em **Continuar**
5. Desative o Google Analytics (opcional) e clique em **Criar projeto**

---

### 2. Criar o app Web

1. Na tela inicial do projeto, clique no ícone **`</>`** (Web)
2. Dê um apelido ao app (ex: `contratfacil-web`) e clique em **Registrar app**
3. O Firebase vai exibir um bloco de configuração como este:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc"
};
```

4. Guarde esses valores — você vai precisar deles nas variáveis de ambiente

---

### 3. Ativar Authentication

1. No menu lateral, clique em **Build → Authentication**
2. Clique em **Começar**
3. Na aba **Sign-in method**, clique em **E-mail/senha**
4. Ative a primeira opção e clique em **Salvar**

#### Criar o usuário do proprietário

1. Ainda em Authentication, vá na aba **Usuários**
2. Clique em **Adicionar usuário**
3. Informe o e-mail e senha que serão usados para acessar o sistema
4. Clique em **Adicionar usuário**

> O sistema não tem tela de cadastro público — o acesso é somente para usuários criados manualmente aqui.

---

### 4. Ativar o Firestore

1. No menu lateral, clique em **Build → Firestore Database**
2. Clique em **Criar banco de dados**
3. Escolha **Iniciar no modo de produção** e clique em **Próximo**
4. Escolha a região mais próxima (ex: `southamerica-east1` para São Paulo) e clique em **Ativar**

#### Configurar regras de segurança

Após criar o banco, clique na aba **Regras** e substitua o conteúdo por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /contratos/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Clique em **Publicar**. Isso garante que apenas usuários autenticados podem ler e gravar contratos.

---

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (nunca suba esse arquivo para o GitHub):

```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

Use o arquivo `.env.example` como referência.

---

## Rodando localmente

### Pré-requisitos

- [Node.js](https://nodejs.org) 18 ou superior
- [Vercel CLI](https://vercel.com/docs/cli) — necessário para testar a função de PDF localmente

### Instalação

```bash
npm install
```

### Desenvolvimento (apenas frontend)

```bash
npm run dev
```

Acesse `http://localhost:5173`. Nesse modo a geração de PDF não funciona. Para testar tudo localmente, use a Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

Acesse `http://localhost:3000`.

### Build de produção

```bash
npm run build
```

---

## Deploy na Vercel

### 1. Subir o código no GitHub

```bash
git init
git add .
git commit -m "primeiro commit"
git remote add origin https://github.com/SEU_USUARIO/gestaoAluguel.git
git push -u origin main
```

### 2. Importar na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub
2. Clique em **Add New Project**
3. Selecione o repositório `gestaoAluguel`
4. Na seção **Environment Variables**, adicione as 6 variáveis do Firebase:

| Nome | Exemplo do valor |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `seu-projeto.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `seu-projeto` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `seu-projeto.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `VITE_FIREBASE_APP_ID` | `1:123:web:abc` |

5. Clique em **Deploy**

A Vercel detecta automaticamente que é um projeto Vite e configura o build. Após o deploy, qualquer `git push` na branch `main` atualiza o site automaticamente.

---

## Como funciona a geração de PDF

A rota `/api/generate-pdf` é uma **Vercel Serverless Function** que:

1. Recebe os dados do contrato via `POST`
2. Valida todos os campos (imóvel, CPF, RG, datas, etc.)
3. Monta o HTML do contrato com os dados preenchidos
4. Abre o Chromium headless via Puppeteer
5. Renderiza o HTML e exporta como PDF no formato A4
6. Retorna o PDF como download direto no navegador

Após o download, o contrato também é salvo automaticamente no Firestore para aparecer no Histórico.

> A função está configurada no `vercel.json` com 1024 MB de memória e timeout de 30 segundos, necessários para o Chromium rodar no ambiente serverless.

---

## Como adicionar novos imóveis

**1.** Edite o objeto `IMOVEIS` em [src/pages/NovoContrato.jsx](src/pages/NovoContrato.jsx):

```js
const IMOVEIS = {
  "1898": { ... },
  "105":  { ... },
  "999": {                          // novo número do imóvel
    label: "Rua Exemplo, 999",
    casas: ["1", "2"],
    descCasa: {
      "1": "2 cômodos",
      "2": "3 cômodos",
    },
  },
};
```

**2.** Edite a função `resolveImovelInfo` em [api/contract.js](api/contract.js) para incluir as informações do novo imóvel no contrato gerado:

```js
if (numImovel === "999") {
  if (numCasa === "1") return { numImovelFormatado: "999", numComodos: "2", aguaLuzIndividual: "." };
  if (numCasa === "2") return { numImovelFormatado: "999", numComodos: "3", aguaLuzIndividual: "." };
}
```

**3.** Adicione o novo número na validação em [api/generate-pdf.js](api/generate-pdf.js):

```js
if (!["1898", "105", "999"].includes(data.numImovel)) errors.push("Imóvel inválido.");
```

---

## Segurança

- Todas as rotas (exceto `/login`) são protegidas por `PrivateRoute` — redireciona para login se não autenticado
- As credenciais do Firebase ficam em variáveis de ambiente e nunca são expostas no repositório
- As regras do Firestore bloqueiam leitura e escrita para usuários não autenticados
- O `.gitignore` já exclui `.env`, `node_modules` e arquivos de build
