/** Baixa no navegador o PDF temporário devolvido por /api/proposal/pdf (nada é salvo no servidor). */
export async function baixarPdfDaResposta(res: Response): Promise<void> {
  const blob = await res.blob()
  const disposition = res.headers.get("Content-Disposition") ?? ""
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "proposta.pdf"

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
