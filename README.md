# Gato Printado — Vendas & Estoque

Aplicativo web (PWA) para gerenciar as vendas de impressões 3D e quadros:

- **Vendas**: cliente, produto, pagamentos, valor total, CEP (com busca de endereço), entrega e frete, materiais usados e lucro, com prazo automático (15 dias para impressão 3D e 5 para quadros, editável). Inclui mensagens prontas no WhatsApp e recibo em PDF.
- **Painel**: faturamento, lucro, valores recebidos e a receber, por tipo de produto, com gráfico mensal e comparação com o período anterior.
- **Clientes**: histórico e total comprado por cliente, com atalho para o WhatsApp.
- **Ajustes**: dados da loja, chave Pix, tipos de produto e prazos, exportação para Excel.
- **Estoque**: insumos, preço de compra, custo por unidade e avisos de recompra (por estoque mínimo ou por data).

Funciona no navegador, pode ser instalado na tela inicial do celular ou do computador, abre mesmo sem internet e, com o Firebase configurado, **sincroniza os dados entre todos os seus aparelhos** com login.

---

## ⬆️ Atualizando da versão 2.0 para a 3.0

1. Substitua os arquivos no GitHub pelos desta pasta. **Não é preciso mexer no Firebase.**
2. Abra o app com internet e confira o rodapé: **“versão 3.0”**. Se aparecer a versão antiga, feche e abra de novo.
3. Em **Ajustes → Custos de produção**, coloque os seus números: preço da resina (ou vincule a resina do Estoque), tarifa de luz, valor e vida útil da impressora, valor da sua hora, embalagem e encomendas por mês. Clique em **Salvar**.
4. Em **Ajustes → Tabela de preços**, ajuste as gramas e as horas de cada item com os seus números reais. Clique em **Salvar tabela**.

Veja tudo o que mudou em [`CHANGELOG.md`](CHANGELOG.md).

## ⬆️ Atualizando da versão 1 para a 2.0

Faça os passos **nesta ordem**:

1. **Atualize as regras do banco.** A 2.0 grava as suas configurações numa coleção nova, `config`.
   No Firebase: **Bancos de dados e armazenamento → Firestore Database → aba Regras**. Apague tudo, cole o conteúdo do novo `firestore.rules` e clique em **Publicar**.
   Sem esse passo, salvar os **Ajustes** mostra o aviso “Sem permissão no banco de dados”.
2. **Substitua os arquivos no GitHub** por todos os arquivos desta pasta. Há dois arquivos novos: `app.js` e `styles.css`.
3. Abra o app com internet. Se ele ainda mostrar a versão antiga, feche e abra de novo. A versão aparece no rodapé: **“versão 2.0”**.
4. Vá em **Ajustes** e preencha a **chave Pix** e o **WhatsApp da loja**. Eles aparecem nas mensagens e no recibo.

Suas vendas antigas continuam intactas. Veja todas as novidades em [`CHANGELOG.md`](CHANGELOG.md).

### (Opcional) Bloquear novos cadastros
Hoje qualquer pessoa que abrir o seu link consegue criar uma conta. Ela não vê os seus dados, mas usa espaço do seu projeto. Depois de criar a sua conta:
**Segurança → Authentication → Configurações → Ações do usuário → desmarque “Ativar criação (inscrição)”** e salve.

---

## Estrutura dos arquivos

```
gato-printado/
├── index.html               ← estrutura das telas
├── app.js                   ← funcionamento do app (vendas, painel, clientes, estoque, ajustes)
├── styles.css               ← cores, fontes e layout
├── CHANGELOG.md             ← novidades das versões 3.0 e 2.0
├── manifest.json            ← nome, cores e ícones para instalar como app
├── sw.js                    ← service worker: funcionamento offline
├── firebase-config.js       ← ⚠️ PREENCHER com os dados do seu projeto Firebase
├── cloud.js                 ← login e sincronização (Firebase)
├── firestore.rules          ← regras de segurança para colar no Firebase
├── .nojekyll                ← faz o GitHub Pages servir os arquivos como estão
├── icons/
│   ├── logo.png             ← logo usado no topo do app
│   ├── favicon-32.png       ← ícone da aba do navegador
│   ├── icon-192.png         ← ícone do app (Android/Chrome)
│   ├── icon-512.png
│   ├── maskable-512.png     ← ícone adaptável (Android recorta em formatos diferentes)
│   └── apple-touch-icon.png ← ícone para iPhone/iPad
└── .github/workflows/
    └── deploy.yml           ← publica automaticamente a cada envio para a branch main
```

---

## Como publicar no GitHub Pages

### 1. Criar o repositório
1. Entre em [github.com](https://github.com) e clique em **New repository**.
2. Nome sugerido: `gato-printado`. Deixe **Public** (o GitHub Pages gratuito exige repositório público).
3. Clique em **Create repository**.

### 2. Enviar os arquivos

**Pelo site (sem instalar nada):**
1. No repositório vazio, clique em **uploading an existing file**.
2. Arraste **todo o conteúdo** da pasta `gato-printado` (não a pasta em si).
   > A pasta `.github` e o arquivo `.nojekyll` começam com ponto e podem ficar ocultos no seu computador. No Windows, ative *Exibir → Itens ocultos*; no Mac, pressione `Cmd + Shift + .` no Finder.
3. Clique em **Commit changes**.

**Pelo terminal (Git):**
```bash
cd gato-printado
git init
git add .
git commit -m "Primeira versão do Gato Printado"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/gato-printado.git
git push -u origin main
```

### 3. Ativar o GitHub Pages
1. No repositório, vá em **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Vá na aba **Actions** e aguarde o fluxo *Publicar no GitHub Pages* ficar verde (cerca de 1 minuto). Se ele não tiver rodado, abra o fluxo e clique em **Run workflow**.
4. O endereço do app será:
   **`https://SEU-USUARIO.github.io/gato-printado/`**

> **Alternativa sem Actions:** em *Settings → Pages → Source*, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`. Nesse caso, você pode apagar a pasta `.github`.

---

## Instalar no celular

- **Android (Chrome):** abra o endereço → menu **⋮** → **Instalar app** (ou *Adicionar à tela inicial*).
- **iPhone (Safari):** abra o endereço → botão **Compartilhar** → **Adicionar à Tela de Início**.
- **Computador (Chrome/Edge):** clique no ícone de instalar na barra de endereço.

Segurar o ícone do app no Android mostra atalhos para **Nova venda**, **Painel** e **Estoque**.

---

## 🔄 Sincronizar computador e celular (Firebase)

Com o Firebase configurado, você entra com a **mesma conta** no computador e no celular e vê as mesmas vendas e o mesmo estoque, atualizados na hora. Sem internet o app continua funcionando e envia as alterações quando a conexão voltar.

O plano gratuito do Firebase (Spark) atende com folga uma loja pequena. Não é preciso cadastrar cartão.

### 1. Criar o projeto
1. Acesse [console.firebase.google.com](https://console.firebase.google.com) com a sua conta Google.
2. Clique em **Criar um projeto** e dê o nome `gato-printado`. O Google Analytics pode ficar desativado.

### 2. Registrar o app da Web
1. Na página inicial do projeto, clique no ícone **`</>`** (Web).
2. Apelido: `Gato Printado`. **Não** marque "Firebase Hosting". Clique em **Registrar app**.
3. Aparece um bloco `const firebaseConfig = { ... }`. Copie os 6 valores para o arquivo **`firebase-config.js`** deste projeto, no lugar de cada `COLE_AQUI`.

   Exemplo de como fica:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIzaSyB...",
     authDomain: "gato-printado-1a2b3.firebaseapp.com",
     projectId: "gato-printado-1a2b3",
     storageBucket: "gato-printado-1a2b3.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc123..."
   };
   ```
   > Estes valores não são senhas. É normal que fiquem visíveis no site: quem protege os dados são o login e as regras do passo 4.

### 3. Ativar o login
1. No menu lateral: **Criação → Authentication → Vamos começar**.
2. Aba **Método de login**:
   - **Google** → ativar → escolha seu e-mail de suporte → Salvar.
   - **E-mail/senha** → ativar → Salvar.
3. Aba **Configurações → Domínios autorizados → Adicionar domínio**: `SEU-USUARIO.github.io`
   (sem `https://` e sem `/gato-printado`). Sem esse passo, o login dá o erro “endereço não autorizado”.

### 4. Criar o banco de dados
1. Menu lateral: **Criação → Firestore Database → Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**. Esse local não pode ser trocado depois.
3. Escolha **Iniciar no modo de produção** → Criar.
4. Abra a aba **Regras**, apague tudo, cole o conteúdo do arquivo **`firestore.rules`** e clique em **Publicar**.
   Com essas regras, cada conta só enxerga os próprios dados, e ninguém sem login lê nada.

### 5. Publicar e entrar
1. Envie para o GitHub o `firebase-config.js` preenchido, junto com os outros arquivos.
2. No primeiro aparelho, clique em **“Criar conta com e-mail”**. Nos outros, entre com **o mesmo e-mail e a mesma senha**.
3. Se o aparelho tinha dados da versão anterior, que salvava só no aparelho, aparece o aviso **“Enviar para minha conta”**. Clique nele **uma única vez, no aparelho que tem os dados certos**.

### Dicas
- **Escolha um único jeito de entrar e use sempre o mesmo em todos os aparelhos.** Entrar com Google e entrar com e-mail e senha criam contas separadas, cada uma com os seus próprios dados.
- **Recomendado: e-mail e senha.** Funciona em qualquer aparelho, inclusive no iPhone com o app instalado na tela inicial, onde o “Entrar com Google” às vezes não abre.
- O ponto ao lado do seu e-mail, no topo do app, mostra o estado: 🟢 **Sincronizado**, 🟡 **Salvando…** e ⚪ **Offline** (as alterações ficam guardadas e sobem quando a internet voltar).
- Os botões **Exportar backup** e **Importar backup**, no rodapé, continuam disponíveis. Exporte um backup de vez em quando por segurança.
- Se `firebase-config.js` não for preenchido, o app funciona como antes, salvando **só no aparelho**.

---

## Publicar uma atualização

1. Edite os arquivos (normalmente `app.js`, `styles.css` ou `index.html`).
2. Em `sw.js`, aumente a versão do cache (por exemplo `gato-printado-v4` → `gato-printado-v5`).
3. Envie para o GitHub. O Actions publica sozinho; o app atualiza na próxima vez que for aberto com internet.

## Testar no computador antes de publicar

O service worker não funciona abrindo o arquivo direto (`file://`). Rode um servidor simples na pasta:

```bash
python3 -m http.server 8000
```

e acesse `http://localhost:8000`.
