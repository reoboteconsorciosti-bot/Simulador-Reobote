export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function parseCurrencyInput(value: string): number {
  if (!value) return 0
  // Remove espaços e símbolo de moeda
  const cleaned = value.replace(/[^0-9.,]/g, "").trim()
  if (!cleaned) return 0
  // Remove separadores de milhar e troca vírgula decimal por ponto
  const normalized = cleaned.replace(/\./g, "").replace(",", ".")
  return parseFloat(normalized)
}
