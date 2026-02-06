# Documentação dos Cálculos do Simulador de Consórcios

Este documento descreve **todos os cálculos e lógicas matemáticas** usados pelo simulador atual, para que você possa **migrar fielmente** essa lógica para outro sistema/interface.

Conteúdo baseado na análise dos arquivos do projeto `simulador-servopa`:
- `services/simulationService.ts`
- `constants.ts`
- `views/SimulatorView.tsx`
- `services/webhookService.ts`
- `server/src/controllers/webhookController.ts`

---

## 1. Onde estão os cálculos principais

### 1.1. Função central da simulação

- Arquivo: `services/simulationService.ts`
- Função principal:
  - `calculateSimulation(inputs: SimulationInputs): SimulationOutputs | null`
- Esta função calcula:
  - Valor da parcela inicial
  - Percentual da parcela sobre o crédito
  - Lances (ofertado, embutido, pago)
  - Saldo devedor após o lance
  - Quantidade de parcelas a pagar
  - Valor da nova parcela após contemplação
  - Crédito disponível após lance embutido
  - Quantidade de parcelas já pagas (considerando lance)

### 1.2. Constantes de taxas

- Arquivo: `constants.ts`

```ts
// Fator para cálculo do seguro de vida
export const L16_CONST = 0.000599;

// Fator para cálculo do seguro de quebra de garantia
export const L17_CONST = 0.000392;
```

Esses fatores são usados para calcular valores de seguro adicionados às parcelas.

### 1.3. Tela que dispara o cálculo e monta os dados para o PDF

- Arquivo: `views/SimulatorView.tsx`
- Elementos principais:
  - `handleSimulate` → chama `calculateSimulation(inputs)` quando o usuário clica no botão **"Simular"**.
  - `handleSendProposal` → pega `inputs` + `outputs` e monta o *payload* para geração de PDF (via webhook backend).
  - Campos derivados, como:
    - `% da Parcela` (mostra o `percentualParcela` calculado).
    - `Lance Pago (%)` (diferença entre `Lance Ofertado` e `Lance Embutido`).

## 2. Estrutura dos dados de entrada e saída

### 2.1. Entradas da simulação (`SimulationInputs`)

Arquivo: `types.ts`

```ts
export interface SimulationInputs {
  clienteNome: string;
  consultorNome: string;
  tipoBem: 'Imóvel' | 'Automóvel';
  credito: number | '';
  qtdMeses: number | '';
  taxa: number | '';
  planoLight: number;
  seguroPrestamista: number;
  percentualOfertado: number | '';
  percentualEmbutido: number | '';
  qtdParcelasOfertado: number;
  diluirLance: number;
  lanceNaAssembleia: number | '';
}
```

Principais campos para cálculo:
- `credito`: valor do crédito contratado.
- `qtdMeses`: prazo total em meses.
- `taxa`: taxa de administração total em %.
- `planoLight`: define redução inicial de parcela (1 a 6).
- `seguroPrestamista`: 1 = Automóvel, 2 = Imóvel, 3 = Sem Seguro.
- `percentualOfertado`: % de lance ofertado.
- `percentualEmbutido`: % do lance embutido no crédito.
- `qtdParcelasOfertado`: alternativa ao percentual (lance em nº de parcelas).
- `diluirLance`: forma de uso do lance (reduzir prazo, LUDC, etc.).
- `lanceNaAssembleia`: mês da assembleia em que o lance é dado.

### 2.2. Saídas da simulação (`SimulationOutputs`)

```ts
export interface SimulationOutputs {
  valorParcela: number;
  creditoDisponivel: number;
  saldoDevedor: number;
  parcelasAPagarQtd: number;
  parcelasAPagarValor: number;
  lanceOfertadoValor: number;
  lanceEmbutidoValor: number;
  percentualParcela: number;
  parcContem: number;
}
```

Significado:
- `valorParcela`: valor da **parcela inicial**.
- `creditoDisponivel`: crédito disponível após lance embutido.
- `saldoDevedor`: saldo devedor após contemplação/lance.
- `parcelasAPagarQtd`: quantidade de parcelas restantes a pagar.
- `parcelasAPagarValor`: valor da nova parcela após contemplação.
- `lanceOfertadoValor`: valor total do lance (cash + embutido).
- `lanceEmbutidoValor`: parte do lance que é embutida.
- `percentualParcela`: percentual da parcela sobre o crédito (base mensal).
- `parcContem`: número de parcelas já pagas/consideradas como pagas.

---

## 3. Lógica completa da função `calculateSimulation`

Arquivo: `services/simulationService.ts`

### 3.1. Normalização dos inputs

Dentro de `calculateSimulation`:

```ts
const credito = Number(inputs.credito) || 0;
const qtdMeses = Number(inputs.qtdMeses) || 0;
const taxa = Number(inputs.taxa) || 0;
const percentualOfertado = Number(inputs.percentualOfertado) || 0;
const percentualEmbutido = Number(inputs.percentualEmbutido) || 0;
const qtdParcelasOfertado = Number(inputs.qtdParcelasOfertado) || 0;
const lanceNaAssembleia = Number(inputs.lanceNaAssembleia) || 0;
const { planoLight, seguroPrestamista } = inputs;
const diluirLance = Number(inputs.diluirLance);

if (qtdMeses === 0) {
  return null;
}
```

Conversão para decimais:

```ts
const taxaDecimal = taxa / 100;
const percentualOfertadoDecimal = percentualOfertado / 100;
const percentualEmbutidoDecimal = percentualEmbutido / 100;
```

### 3.2. Fator do Plano Light

Função auxiliar:

```ts
const getPlanoLightFactor = (planoLightValue: number): number => {
  // 1: Integral; 2: 10% Red; 3: 20% Red; 4: 30% Red; 5: 40% Red; 6: 50% Red
  switch (planoLightValue) {
    case 2: return 0.9;
    case 3: return 0.8;
    case 4: return 0.7;
    case 5: return 0.6;
    case 6: return 0.5;
    case 1:
    default:
      return 1.0;
  }
};
```

Uso:

```ts
const planoLightFactor = getPlanoLightFactor(planoLight);
```

### 3.3. Cálculos intermediários de taxa

```ts
const N13 = 1 + taxaDecimal;        // Fator total da taxa
const N14 = round(N13 / qtdMeses, 6); // "percentual" mensal base (antes do plano light)
const N12 = credito * N13;          // Crédito corrigido pela taxa total
```

### 3.4. Seguro prestamista (vida / garantia)

Flags:

```ts
const isAutomovel = seguroPrestamista === 1;
const isImovel = seguroPrestamista === 2;

const N27_flag = isAutomovel ? 1 : 0; // usa L16 (vida) se automóvel
const N28_flag = 0;                   // L17 não é usado na parcela inicial no código atual
```

Cálculo dos seguros na parcela inicial:

```ts
const L14_seguro_vida = (L16_CONST * N12) * N27_flag;
const L15_seguro_garantia = (L17_CONST * N12) * N28_flag; // hoje tende a 0
```

### 3.5. Percentual da parcela e valor da parcela inicial

```ts
const B10_parcela_porcentagem = round(N14 * planoLightFactor, 8);
const C10_valorParcela = (credito * B10_parcela_porcentagem) + L14_seguro_vida + L15_seguro_garantia;
```

Interpretação:
> **Valor da Parcela Inicial = Crédito × Percentual da Parcela (ajustado pelo plano light) + Seguros iniciais**

Este valor vai para `outputs.valorParcela`.

### 3.6. Cálculos de lance (estrutura O12–O16)

1. **Percentual de amortização no mês do lance:**

```ts
const O12 = ifError(() => round((lanceNaAssembleia * B10_parcela_porcentagem * credito) / credito, 6), 0);
```

2. **Prazo pós-lance:**

```ts
const O14 = qtdMeses - lanceNaAssembleia;
```

3. **Fator de taxa ajustado pelo lance:**

```ts
const O13 = N13 - O12;
```

4. **Novo "percentual" de amortização pós-lance (mensal):**

```ts
const O15 = ifError(() => round(O13 / O14, 6), 0);
```

5. **Parcela-base usada para converter lances em parcelas inteiras:**

```ts
const O16 = round(credito * O15, 6);
```

### 3.7. Lance ofertado (total) e lance embutido

#### 3.7.1. Lance ofertado (C19)

Se o lance foi informado em **percentual**:

```ts
if (percentualOfertadoDecimal > 0) {
  const rawParcels = ((credito * N13) * percentualOfertadoDecimal) / O16;
  totalBidParcels = round(rawParcels, 0);           // nº de parcelas ofertadas
  C19_lance_ofertado_val = totalBidParcels * O16;   // valor total do lance
} else {
  C19_lance_ofertado_val = qtdParcelasOfertado * O16;
  totalBidParcels = qtdParcelasOfertado;
}
```

#### 3.7.2. Lance embutido (C20)

```ts
const L21 = ifError(() => ((credito * N13) * percentualEmbutidoDecimal) / O16, 0);
const D20_qtd_parcelas_embutido = round(L21, 0); // nº de parcelas embutidas
const C20_lance_embutido_val = D20_qtd_parcelas_embutido * O16; // valor embutido
```

#### 3.7.3. Parcelas em dinheiro (cashParcels)

```ts
const cashParcels = totalBidParcels - D20_qtd_parcelas_embutido;
```

Ou em palavras:
> **Lance Pago em Dinheiro (parcelas) = Lance Total (parcelas) − Lance Embutido (parcelas)**

### 3.8. Crédito disponível após lance embutido

```ts
const B30_creditoDisponivel = credito - C20_lance_embutido_val;
```

Vai para `outputs.creditoDisponivel`.

### 3.9. Efeito do `diluirLance` (forma de abatimento)

Significados no front:
- `diluirLance === 1` → **Sim (Abater Prazo)** → reduz prazo.
- `diluirLance === 3` → **Não (abater parcelas)** → mantém prazo, reduz valor.
- `diluirLance === 2` → **LUDC**.

Código:

```ts
let parcelasAbatidas = 0;
if (diluirLance === 1) {
  // Abater Prazo
  parcelasAbatidas = totalBidParcels;
} else if (diluirLance === 3) {
  // Não abater (mantém prazo)
  parcelasAbatidas = 0;
} else if (diluirLance === 2) {
  // LUDC
  parcelasAbatidas = 0;
}
```

### 3.10. Parcelas pagas e parcelas a pagar

```ts
const B28_qtd_parcelas_pagas = 1 + parcelasAbatidas + (lanceNaAssembleia - 1);
const B29_parcelasAPagarQtd = qtdMeses - B28_qtd_parcelas_pagas;
```

Esses valores vão para:
- `outputs.parcContem = B28_qtd_parcelas_pagas`
- `outputs.parcelasAPagarQtd = B29_parcelasAPagarQtd`

### 3.11. Saldo devedor após lance

1. **Valor amortizado total (em "unidades de parcela"):**

```ts
const L27 = ((cashParcels + D20_qtd_parcelas_embutido) * O15) + O12;
```

2. **Fator restante de taxa:**

```ts
const L28 = N13 - L27;
```

3. **Saldo devedor em dinheiro:**

```ts
const B27_saldoDevedor = L28 * credito;
```

Vai para `outputs.saldoDevedor`.

### 3.12. Nova parcela pós-contemplação (com seguros)

1. **Novo percentual de amortização por parcela restante:**

```ts
const L29 = ifError(() => round(L28 / B29_parcelasAPagarQtd, 6), 0);
```

2. **Seguros pós-contemplação:**

```ts
const M27_seguro_vida_pos = (L16_CONST * B27_saldoDevedor) * (isAutomovel ? 1 : 0);
const M28_seguro_garantia_pos = (L17_CONST * B27_saldoDevedor) * (isImovel ? 1 : 0);
```

3. **Valor da nova parcela a pagar:**

```ts
const C29_parcelasAPagarValor = ifError(
  () => (L29 * credito) + M27_seguro_vida_pos + M28_seguro_garantia_pos,
  0
);
```

Vai para `outputs.parcelasAPagarValor`.

### 3.13. Resumo das saídas retornadas

A função retorna:

```ts
return {
  valorParcela: C10_valorParcela,
  creditoDisponivel: B30_creditoDisponivel,
  saldoDevedor: B27_saldoDevedor,
  parcelasAPagarQtd: B29_parcelasAPagarQtd,
  parcelasAPagarValor: C29_parcelasAPagarValor,
  lanceOfertadoValor: C19_lance_ofertado_val,
  lanceEmbutidoValor: C20_lance_embutido_val,
  percentualParcela: B10_parcela_porcentagem,
  parcContem: B28_qtd_parcelas_pagas,
};
```

---

## 4. Cálculos adicionais na tela `SimulatorView`

Arquivo: `views/SimulatorView.tsx`

### 4.1. Recalcular o percentual da parcela para exibição

```ts
const percentualParcelaCalculado = useMemo(() => {
  const tempOutputs = calculateSimulation(inputs);
  return tempOutputs ? tempOutputs.percentualParcela : 0;
}, [inputs]);
```

Na interface, o campo "% da Parcela" mostra:

```ts
`${(percentualParcelaCalculado * 100).toFixed(4)}%`.replace('.', ',');
```

Ou seja:
> **Exibição = percentualParcela × 100, com 4 casas decimais e formato de % BR.**

### 4.2. Campo "Lance Pago (%)"

Este campo é somente leitura e mostra:

```ts
Math.max(0,
  (Number(inputs.percentualOfertado) || 0) -
  (Number(inputs.percentualEmbutido) || 0)
).toFixed(2);
```

Em palavras:
> **Lance Pago (%) = max(0, Lance Ofertado (%) − Lance Embutido (%))**

---

## 5. Como migrar para outro simulador

Para portar essa lógica para um **novo front-end ou outro sistema**, siga este roteiro:

1. **Replicar o modelo de entrada**
   - Certifique-se de que o novo sistema tenha todos os campos equivalentes a `SimulationInputs`.

2. **Implementar a função de cálculo**
   - Reimplemente `calculateSimulation` com as fórmulas descritas na seção 3, mantendo:
     - Conversão para número.
     - Tratamento de divisão por zero (`ifError`).
     - Mesma ordem das contas para evitar diferenças de arredondamento.

3. **Definir as constantes**
   - Configure `L16_CONST` e `L17_CONST` com os mesmos valores (ou ajuste de acordo com a nova regra de negócio, se for o objetivo).

4. **Gerar saídas compatíveis**
   - Garanta que os campos retornados pelo novo cálculo correspondam à interface `SimulationOutputs`.
   - Use esses valores para alimentar tela e geração de PDF.

Com isso, o novo simulador deve reproduzir exatamente os mesmos resultados (parcela, saldo, crédito disponível, lances, etc.) do sistema atual.
