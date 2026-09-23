# Gato Printado — Vendas & Estoque

Aplicativo web (PWA) para gerenciar as vendas de impressões 3D e quadros:

- **Vendas**: cliente, produto, entrada, valor total, CEP, tipo de entrega e frete, com prazo automático (15 dias para impressão 3D, 5 dias para quadros).
- **Painel**: faturamento, valores recebidos e a receber, separados por tipo de produto, com gráfico mensal.
- **Estoque**: insumos, preço de compra, custo por unidade e avisos de recompra (por estoque mínimo ou por data).

Funciona no navegador, pode ser instalado na tela inicial do celular ou do computador e abre mesmo sem internet.

---

## Estrutura dos arquivos

```
gato-printado/
├── index.html               ← o aplicativo inteiro (HTML, CSS e JavaScript)
├── manifest.json            ← nome, cores e ícones para instalar como app
├── sw.js                    ← service worker: funcionamento offline
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

## ⚠️ Onde ficam os dados

Nesta versão, as vendas e o estoque ficam salvos **no próprio aparelho** (armazenamento do navegador). Isso significa:

- Os dados do celular **não aparecem** automaticamente no computador, e vice-versa.
- Limpar os dados do navegador, ou desinstalar o app, **apaga as informações**.
- No modo anônimo, nada é salvo.

**Faça backup com frequência.** No rodapé do app há os botões:
- **Exportar backup** → baixa um arquivo `.json` com todas as vendas, insumos e compras.
- **Importar backup** → carrega esse arquivo em outro aparelho (substitui os dados que estiverem lá).

Para sincronizar entre vários aparelhos automaticamente, o próximo passo seria ligar o app a um banco de dados online gratuito (por exemplo Firebase ou Supabase).

---

## Publicar uma atualização

1. Edite os arquivos (normalmente só o `index.html`).
2. Em `sw.js`, aumente a versão do cache: `gato-printado-v1` → `gato-printado-v2`.
3. Envie para o GitHub. O Actions publica sozinho; o app atualiza na próxima vez que for aberto com internet.

## Testar no computador antes de publicar

O service worker não funciona abrindo o arquivo direto (`file://`). Rode um servidor simples na pasta:

```bash
python3 -m http.server 8000
```

e acesse `http://localhost:8000`.
