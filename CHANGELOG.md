# Gato Printado — Versão 3.0

## Calculadora de custo por encomenda
Cada encomenda tem o seu próprio custo, montado a partir de:

| Custo | Como é calculado |
|---|---|
| **Resina** | gramas × (1 + % de perda com suportes e lavagem) × preço por grama. O preço vem da última compra no Estoque, se você vincular, ou do valor por kg em Ajustes. Com a resina vinculada, as gramas saem do estoque sozinhas. |
| **Energia elétrica** | horas de impressão × potência (kW) × tarifa (R$/kWh) |
| **Impressora (equipamento parado)** | horas de impressão × (valor da impressora ÷ vida útil em horas + manutenção por hora) |
| **Pintura** | horas × valor da sua hora. O app mostra o **lucro da empresa** e o **seu ganho total** (lucro + mão de obra). |
| **Embalagem** | valor padrão, editável em cada encomenda |
| **Imposto MEI** | DAS mensal ÷ encomendas por mês (padrão: R$ 82,05 ÷ 15), ou um percentual sobre a venda |
| **Custos fixos** | valor mensal ÷ encomendas por mês |
| **Taxa do cartão** | % sobre o valor da encomenda |
| **Materiais do estoque e outros custos** | lista livre, como tintas, bases e acessórios |

- **Itens da tabela de preços com quantidade.** Ex.: “1× Casal + 2× Cada adicional” preenche R$ 380 e soma a resina e as horas de todos os itens. Também dá para criar um item personalizado.
- **Preço mínimo** (o que não dá lucro) e **preço sugerido** para a margem que você definir, aplicável com um toque.
- Um **alerta** aparece quando o valor cobrado não cobre os custos.

## Tabela de preços (Ajustes)
- Já vem com a sua tabela: 1 pessoa R$ 190 · Casal R$ 260 · Pet R$ 210 · Pessoa + Personagem R$ 310 · Pessoa + Mini Pet R$ 260 · Cada adicional R$ 60.
- Cada item tem uma **estimativa de resina (g), de horas de impressão e de horas de pintura**. ⚠️ Esses valores são estimativas iniciais: ajuste com os seus números reais.
- Ao lado de cada item aparecem o **custo de produção** e **quanto sobra**, atualizados enquanto você edita os custos.

## Custos de produção (Ajustes)
Resina (preço e perda), potência e tarifa de energia, valor e vida útil da impressora, manutenção, valor da hora de pintura, embalagem, imposto MEI, custos fixos, encomendas por mês e margem desejada. Um resumo mostra quanto custa cada grama de resina, cada hora de impressão e o imposto de cada encomenda.

## Orçamentos
- Botão **“Salvar como orçamento”**: o orçamento não entra no faturamento e não mexe no estoque.
- Mensagem de orçamento pronta no WhatsApp, com os itens, o frete, o total, o prazo e o Pix.
- Botão **Aprovar**: vira venda, o prazo passa a contar do dia da aprovação e os materiais saem do estoque.
- Filtro **Orçamentos** na lista, e o total de orçamentos abertos aparece no Painel.

## Painel
- Card **“Para onde vai o dinheiro”**: quanto cada custo representa do faturamento no período, e o lucro.
- O card de lucro mostra também o quanto foi para a sua mão de obra.
- A exportação para Excel ganhou uma coluna para cada custo.

## Compatibilidade
- As vendas antigas continuam iguais, e nada precisa ser feito no Firebase (as regras da 2.0 já cobrem a 3.0).
- Ao **editar** uma venda antiga, ela passa a usar a calculadora nova.

---

# Gato Printado — Versão 2.0

## Análise da versão 1

| Área | O que foi encontrado | Impacto |
|---|---|---|
| **Pagamentos** | Só existia “entrada” e um botão “receber saldo” sem data nem forma de pagamento. | O painel mostrava o dinheiro “recebido” na data da venda, não na data em que ele entrou. Não havia como registrar pagamento parcial nem saber quanto entrou por Pix ou cartão. |
| **Frete** | O frete era cadastrado, mas o “falta receber” ignorava esse valor. | A cobrança ficava abaixo do que o cliente realmente devia. |
| **Custo e lucro** | Não existiam por pedido. O card “Faturamento − insumos” subtraía as compras de estoque do mês. | Esse número não era lucro, porque misturava compras para estoque com o que foi vendido. |
| **Estoque × vendas** | Sem ligação: a baixa dos insumos era sempre manual. | Era fácil esquecer a baixa, e o estoque ficava diferente da realidade. |
| **Tipos de produto** | Só “Impressão 3D” e “Quadro”, com prazos fixos no código. | Não era possível vender outra linha de produto nem mudar os prazos. |
| **Clientes** | Não havia cadastro: nome, contato e CEP eram digitados de novo a cada venda. | Retrabalho, e sem histórico por cliente. |
| **Comunicação** | Sem WhatsApp e sem recibo. | As mensagens de confirmação e de cobrança eram escritas à mão, uma por uma. |
| **Celular** | O formulário longo ficava antes da lista, e as abas ficavam no topo. | No dia a dia pelo celular, era preciso rolar muito. |
| **Segurança** | As regras do banco estão corretas (cada conta só vê os próprios dados). O cadastro de novas contas, porém, fica aberto a qualquer pessoa. | Baixo risco, porque ninguém vê os seus dados. Mesmo assim, dá para fechar (veja o README). |
| **Erros do usuário** | Apagar não tinha “desfazer”. | Um toque errado fazia perder um registro. |
| **Código** | Tudo num único arquivo de cerca de 900 linhas. | Difícil de manter e de evoluir. |

## O que mudou na 2.0

### Vendas
- **Pagamentos parciais**, cada um com data e forma (Pix, dinheiro, cartão de crédito ou débito, transferência). Dá para remover um pagamento lançado errado.
- **Frete no valor a receber** (opção em Ajustes, ligada por padrão). O faturamento e o lucro continuam sem o frete.
- **Materiais usados**: você escolhe os insumos e as quantidades do pedido. Eles saem do estoque sozinhos e entram no custo. Ao editar o pedido, a diferença é corrigida no estoque. Ao apagar, os materiais voltam para o estoque.
- **Outros custos** (embalagem, energia, taxa da maquininha) e **lucro estimado**, calculado enquanto você preenche.
- **Cliente com preenchimento automático**: ao digitar um nome já conhecido, o app completa o WhatsApp e o CEP.
- **Busca de endereço pelo CEP**, que mostra rua, bairro e cidade/UF.
- **Prazo de entrega editável**. O valor automático vem do tipo de produto.
- **WhatsApp com mensagens prontas**: confirmação do pedido, pedido pronto, pedido enviado, cobrança de saldo com a chave Pix e pedido de avaliação.
- **Recibo** com o logo, para imprimir ou salvar em PDF, e também para enviar o resumo pelo WhatsApp.
- **Duplicar pedido**, **observações**, situação **Cancelado** e registro da **data de entrega**.
- **Desfazer** ao apagar uma venda, um pagamento ou um insumo.
- Lista com **busca por cidade e por número do pedido** e botão “Mostrar mais”.

### Painel
- **Lucro bruto e margem**, com **comparação com o período anterior** (▲▼ %).
- **Recebido no período**, pela data real de cada pagamento, e **A receber**, somando todos os pedidos em aberto.
- Gráfico de **6 ou 12 meses** por tipo de produto, com a **linha do lucro**.
- **Melhores clientes**, **pedidos por situação**, **% de entregas no prazo** e **recebimentos por forma de pagamento**.

### Clientes (aba nova)
- Montada automaticamente a partir das vendas: número de pedidos, total comprado, ticket médio, última compra e saldo devedor.
- Botões para **ver os pedidos** do cliente, fazer uma **nova venda** já preenchida e abrir o **WhatsApp**.

### Estoque
- Resumo com **valor em estoque**, **itens para comprar** e **compras do mês**.
- **Consumo nos últimos 30 dias**, calculado a partir das vendas.
- **Lista de compras pronta para o WhatsApp**.

### Ajustes (aba nova)
- Dados da loja: nome, WhatsApp, **chave Pix**, Instagram e rodapé do recibo.
- **Tipos de produto** com nome, prazo e cor. Dá para criar novos, como Chaveiro, Luminária etc.
- **Exportar para Excel** (vendas e estoque em .csv), backup completo e importação.

### Celular e técnica
- **Barra de abas embaixo** no celular. O formulário abre só ao tocar em “+ Nova venda”.
- Código separado em `index.html`, `styles.css` e `app.js`.
- Service worker na versão `v3`, para que os aparelhos recebam a atualização.

## Compatibilidade
As vendas registradas na versão 1 continuam funcionando sem nenhuma conversão:
- A “entrada” vira o primeiro pagamento.
- As vendas marcadas como “quitadas” aparecem como pagas.

Os dados novos (pagamentos, materiais e custos) só são gravados quando você edita ou registra algo.
