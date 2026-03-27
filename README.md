# ContratFácil

Sistema web para geração de contratos de locação em PDF. Desenvolvido para uso no celular ou computador.

## Tecnologias

- **React + Vite** — interface web
- **Vercel** — hospedagem + geração de PDF (serverless)
- **Firebase** — autenticação e histórico de contratos
- **Puppeteer + Chromium** — geração de PDF idêntico ao original

---

## Como rodar localmente

```bash
npm install
npm run dev
```

---

## Deploy na Vercel

### 1. Configure o Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um projeto (ex: `contrat-facil`)
3. Vá em **Authentication > Sign-in method** e habilite **E-mail/senha**
4. Crie o usuário do seu pai em **Authentication > Users > Add user**
5. Vá em **Firestore Database** e crie o banco (modo produção)
6. Vá em **Configurações do projeto > Seus apps > Web** e copie as credenciais

### 2. Suba para o GitHub

```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/seu-usuario/contrat-facil.git
git push -u origin main
```

### 3. Configure na Vercel

1. Acesse [vercel.com](https://vercel.com) e importe o repositório
2. Em **Environment Variables**, adicione todas as variáveis do `.env.example` com os valores do Firebase
3. Clique em **Deploy**

Pronto! O sistema estará acessível pelo celular via URL da Vercel.

---

## Estrutura do projeto

```
contrat-facil/
├── api/
│   ├── contract.js          # Template HTML do contrato (igual ao original)
│   └── generate-pdf.js      # Serverless function — gera o PDF via Puppeteer
├── src/
│   ├── lib/
│   │   ├── firebase.js      # Configuração Firebase
│   │   └── auth.jsx         # Context de autenticação
│   ├── pages/
│   │   ├── Login.jsx        # Tela de login
│   │   ├── NovoContrato.jsx # Formulário em 4 etapas
│   │   └── Historico.jsx    # Lista de contratos salvos
│   ├── components/
│   │   └── Layout.jsx       # Barra de navegação
│   ├── App.jsx              # Rotas
│   └── main.jsx             # Entry point
├── index.html
├── vite.config.js
├── vercel.json              # Config de rotas e funções
└── package.json
```

---

## Como adicionar novos imóveis

Edite o arquivo `src/pages/NovoContrato.jsx`, objeto `IMOVEIS`:

```js
const IMOVEIS = {
  "1898": {
    label: "Estrada Baviera, 1898 (antigo 113A)",
    casas: ["1", "2", "3", "4"],
    descCasa: { "1": "2 cômodos", ... },
  },
  "105": { ... },
  // Adicione novos imóveis aqui
};
```

E em `api/contract.js`, atualize a função `resolveImovelInfo` com as informações do novo imóvel.
