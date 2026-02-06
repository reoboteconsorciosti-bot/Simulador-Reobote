# CONTEXTO

Você é um desenvolvedor senior em React + TypeScript (TSX).  
Estou implementando uma nova funcionalidade no meu simulador oficial de consórcio imobiliário.

Esta é a **ETAPA 1 – Parâmetros da Simulação**.

A simulação só deve calcular e mostrar resultados **após o usuário clicar no botão "Calcular Construção"**.

Os resultados devem aparecer no HTML, vindos do retorno das funções em TSX.

---

# INPUTS (campos editáveis)

1) Crédito do Consórcio (number)  
2) Prazo (em meses) (number)  
3) Taxa (number)  
4) Índice de reajuste (INCC) (number, ex: 2.5)  
5) Contemplação (em meses) (number)  
6) Toggle de tipo de reajuste:
   - "Anual"
   - "Semestral"

---

# OUTPUTS (só aparecem após clicar em "Calcular Construção")

1) Parcela Integral  
2) Crédito atualizado na contemplação  
3) Nova parcela recalculada  

---

# REGRAS DE CÁLCULO

## 1) Parcela Integral

Deve ser calculada por uma **FUNÇÃO SEPARADA**:

ParcelaIntegral = CreditoDoConsorcio / Prazo

---

## 2) Crédito atualizado na contemplação

Este cálculo:

- Deve ser feito por uma **FUNÇÃO SEPARADA**
- NÃO pode usar:
  - Fórmula fechada
  - Nem divisão para descobrir quantidade de aplicações
- DEVE ser feito por **SIMULAÇÃO TEMPORAL ITERATIVA (mês a mês)**
- É **capitalização composta** (cada reajuste incide sobre o valor já reajustado)

### Funcionamento correto:

- Comece com:
  valorAtual = CreditoDoConsorcio

- Crie um loop:
  - De 1 até ContemplacaoMeses

- A cada iteração (cada mês):
  - Se o modo for **Semestral** e (mesAtual % 6 === 0):
      valorAtual = valorAtual * (1 + INCC / 100)
      salvar esse valor em um histórico
  - Se o modo for **Anual** e (mesAtual % 12 === 0):
      valorAtual = valorAtual * (1 + INCC / 100)
      salvar esse valor em um histórico

- Ao final do loop:
  - O output **"Crédito atualizado na contemplação"** é o **último valor de valorAtual**

- Também deve existir:
  - Um array / log / histórico contendo:
    - Valor inicial
    - Valor após cada reajuste aplicado

### Exemplo conceitual:

Credito = 1000  
INCC = 2.5  
Modo = Semestral  
Contemplacao = 36  

Reajustes aplicados nos meses:
6, 12, 18, 24, 30, 36

---

## 3) Nova parcela recalculada

Deve ser feita por **FUNÇÃO SEPARADA**:

NovaParcela = (CreditoAtualizadoNaContemplacao / Prazo) + Taxa

---

# REGRAS DE IMPLEMENTAÇÃO

- Nenhum output pode aparecer antes de clicar no botão **"Calcular Construção"**
- O botão deve chamar uma função principal que:
  - Chama as 3 funções de cálculo separadas
  - Salva os resultados no state
- Os valores devem aparecer no HTML via TSX
- Tudo deve ser fortemente tipado (TypeScript)
- Código organizado, limpo e preparado para futuras etapas da simulação

---

# O QUE EU QUERO QUE VOCÊ FAÇA

- Crie:
  - As funções de cálculo separadas
  - A função principal **CalcularConstrução**
  - Um exemplo de componente TSX funcional com:
    - Inputs
    - Toggle anual/semestral
    - Botão de calcular
    - Renderização dos outputs

- O código deve ser:
  - Limpo
  - Profissional
  - Fácil de expandir
