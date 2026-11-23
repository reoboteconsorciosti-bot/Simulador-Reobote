import { existsSync } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"

export type ProposalTemplate = "automovel" | "construcao"

const TEMPLATE_FILES: Record<ProposalTemplate, string> = {
  automovel: path.join("designerProposta", "automovel", "proposta-automovel.html"),
  construcao: path.join("designerProposta", "construcao", "proposta-construcao.html"),
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Substitui cada [[chave]] do template pelo valor do payload (escapado). Chaves ausentes viram "—". */
export function fillTemplate(html: string, data: Record<string, unknown>): string {
  // Blocos opcionais: <!--IF:chave--> ... <!--/IF:chave--> só ficam se data[chave] estiver preenchido.
  html = html.replace(
    /<!--IF:(\w+)-->([\s\S]*?)<!--\/IF:\1-->/g,
    (_, key: string, inner: string) => (data[key] ? inner : ""),
  )
  return html.replace(/\[\[(\w+)\]\]/g, (_, key: string) => {
    const v = data[key]
    return v === undefined || v === null || v === "" ? "—" : escapeHtml(String(v))
  })
}

const LOCAL_BROWSER_PATHS: Record<string, string[]> = {
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ],
  linux: ["/usr/bin/chromium-browser", "/usr/bin/chromium", "/usr/bin/google-chrome"],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
}

function findLocalBrowser(): string | null {
  const fromEnv = process.env.CHROME_EXECUTABLE_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  return (LOCAL_BROWSER_PATHS[process.platform] ?? []).find((p) => existsSync(p)) ?? null
}

async function launchBrowser() {
  // Dev (Windows/Mac): usa o Chrome/Edge instalado (ou CHROME_EXECUTABLE_PATH).
  // Linux (Vercel/Docker): usa o Chromium do @sparticuz/chromium, que só existe em Linux.
  const local = findLocalBrowser()
  if (local) {
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      // Em container (Linux, usuário não-root) o sandbox do Chromium não funciona.
      args:
        process.platform === "linux"
          ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
          : [],
    })
  }
  if (process.platform !== "linux") {
    throw new Error(
      "Chrome/Edge não encontrado. Instale o Chrome ou defina CHROME_EXECUTABLE_PATH com o caminho do executável.",
    )
  }
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}

/** Gera o PDF em memória. Nada é gravado em disco nem no banco. */
export async function renderProposalPdf(
  template: ProposalTemplate,
  data: Record<string, unknown>,
): Promise<Buffer> {
  const raw = await readFile(path.join(process.cwd(), TEMPLATE_FILES[template]), "utf8")
  const html = fillTemplate(raw, data)

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    // Fontes/ícones/logo vêm de CDN: espera a rede assentar antes de imprimir.
    await page.setContent(html, { waitUntil: "load", timeout: 20000 })
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {})
    await page.evaluate(() => document.fonts.ready)
    await page.emulateMediaType("print")
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
