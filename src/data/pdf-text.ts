import type { PdfTextPage } from './mercado-pago-import'

export async function extractPdfText(file: File): Promise<PdfTextPage[]> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Elegí un archivo PDF.')
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = worker.default
  try {
    const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index): Promise<PdfTextPage> => {
      const pageNumber = index + 1
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      return {
        pageNumber, width: viewport.width,
        items: content.items.flatMap(item => 'str' in item ? [{ text: item.str, x: item.transform[4], y: item.transform[5] }] : []),
      }
    }))
    return pages
  } catch (error) {
    if (error instanceof Error && /password/i.test(error.message)) throw new Error('El PDF está protegido con contraseña y no se puede importar.')
    throw new Error('No pudimos leer el PDF. Verificá que sea un resumen descargado directamente desde Mercado Pago.')
  }
}

