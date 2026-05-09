import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const DEFAULT_INPUT_DIR = path.join(ROOT_DIR, 'letters')
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'letters', 'pngs')
const CONVERT_API_HOST = 'v2.convertapi.com'

function parseArgs(argv) {
	const opts = {
		input: DEFAULT_INPUT_DIR,
		output: DEFAULT_OUTPUT_DIR,
		from: null,
		to: null,
		overwrite: false,
		dryRun: false,
		secret: process.env.CONVERTAPI_SECRET ?? null,
	}

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]

		if (arg === '--input' || arg === '-i') {
			opts.input = path.resolve(argv[i + 1])
			i += 1
			continue
		}

		if (arg === '--output' || arg === '-o') {
			opts.output = path.resolve(argv[i + 1])
			i += 1
			continue
		}

		if (arg === '--from') {
			opts.from = argv[i + 1]
			i += 1
			continue
		}

		if (arg === '--to') {
			opts.to = argv[i + 1]
			i += 1
			continue
		}

		if (arg === '--secret') {
			opts.secret = argv[i + 1]
			i += 1
			continue
		}

		if (arg === '--overwrite') {
			opts.overwrite = true
			continue
		}

		if (arg === '--dry-run') {
			opts.dryRun = true
			continue
		}

		if (arg === '--help' || arg === '-h') {
			printHelpAndExit(0)
		}

		console.error(`Unknown option: ${arg}`)
		printHelpAndExit(1)
	}

	if (!opts.dryRun && !opts.secret) {
		console.error('Missing ConvertAPI secret. Set CONVERTAPI_SECRET or pass --secret <value>.')
		process.exit(1)
	}

	validateDateArg(opts.from, '--from')
	validateDateArg(opts.to, '--to')

	return opts
}

function printHelpAndExit(code) {
	console.log(`
Usage:
	node tools/convertPdfs.js [options]

Options:
	-i, --input <dir>      Input folder containing PDF files (default: letters)
	-o, --output <dir>     Output folder for PNG pages (default: letters/pngs)
			--from <YYYY-MM-DD>  Inclusive start date based on filename
			--to <YYYY-MM-DD>    Inclusive end date based on filename
			--secret <value>     ConvertAPI secret (or use CONVERTAPI_SECRET)
			--overwrite          Replace existing PNG files
			--dry-run            Show what would be converted without calling API
	-h, --help             Show this help

Filename convention:
	PDF files are expected to be named like YYYY-MM-DD.pdf.

Output layout:
	<output>/<pdf-basename>/page-001.png
	<output>/<pdf-basename>/page-002.png
	...
`)
	process.exit(code)
}

function validateDateArg(value, flagName) {
	if (!value) return
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		console.error(`${flagName} must be in YYYY-MM-DD format.`)
		process.exit(1)
	}
}

function toComparableDate(value) {
	return value ? value.replaceAll('-', '') : null
}

function parseLetterDateFromFileName(fileName) {
	const match = fileName.match(/^(\d{4}-\d{2}-\d{2})\.pdf$/i)
	if (!match) return null
	return match[1]
}

async function listPdfFiles(inputDir, from, to) {
	const dirEntries = await fs.readdir(inputDir, { withFileTypes: true })
	const fromCmp = toComparableDate(from)
	const toCmp = toComparableDate(to)

	const files = dirEntries
		.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
		.map((entry) => {
			const letterDate = parseLetterDateFromFileName(entry.name)
			return {
				fileName: entry.name,
				fullPath: path.join(inputDir, entry.name),
				letterDate,
			}
		})
		.filter((entry) => {
			if (!entry.letterDate) return !fromCmp && !toCmp
			const cmp = toComparableDate(entry.letterDate)
			if (fromCmp && cmp < fromCmp) return false
			if (toCmp && cmp > toCmp) return false
			return true
		})
		.sort((a, b) => a.fileName.localeCompare(b.fileName))

	return files
}

async function downloadToFile(url, targetPath) {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Download failed (${response.status}): ${url}`)
	}
	const arrayBuffer = await response.arrayBuffer()
	const buffer = Buffer.from(arrayBuffer)
	await fs.writeFile(targetPath, buffer)
}

async function countExistingPngs(dirPath) {
	try {
		const names = await fs.readdir(dirPath)
		return names.filter((name) => name.toLowerCase().endsWith('.png')).length
	} catch {
		return 0
	}
}

function toErrorMessage(payload, fallback) {
	if (payload && typeof payload === 'object') {
		if (payload.Message) return payload.Message
		if (payload.message) return payload.message
		if (payload.Error) return payload.Error
		if (payload.error) return payload.error
	}
	return fallback
}

async function uploadPdf(secret, pdfPath) {
	const filename = path.basename(pdfPath)
	const uploadUrl = `https://${CONVERT_API_HOST}/upload?secret=${encodeURIComponent(secret)}&filename=${encodeURIComponent(filename)}`
	const body = await fs.readFile(pdfPath)

	const response = await fetch(uploadUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/pdf' },
		body,
	})

	const payload = await response.json().catch(() => ({}))
	if (!response.ok || !payload.FileId) {
		throw new Error(toErrorMessage(payload, `Upload failed for ${filename} (status ${response.status}).`))
	}

	return payload.FileId
}

async function convertPdfToPngFiles(secret, fileId) {
	const convertUrl = `https://${CONVERT_API_HOST}/convert/pdf/to/png?secret=${encodeURIComponent(secret)}&storefile=true`
	const requestBody = {
		Parameters: [
			{
				Name: 'File',
				FileValue: { Id: fileId },
			},
		],
	}

	const response = await fetch(convertUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(requestBody),
	})

	const payload = await response.json().catch(() => ({}))
	const files = payload.Files ?? []

	if (!response.ok || files.length === 0) {
		throw new Error(toErrorMessage(payload, `Conversion failed (status ${response.status}).`))
	}

	return files
}

async function convertSinglePdf(secret, pdfPath, outputRoot, overwrite) {
	const baseName = path.basename(pdfPath, '.pdf')
	const outDir = path.join(outputRoot, baseName)

	if (!overwrite) {
		const existingCount = await countExistingPngs(outDir)
		if (existingCount > 0) {
			console.log(`Skipping ${baseName}.pdf (found ${existingCount} existing PNG files)`)
			return { skipped: true, pages: existingCount }
		}
	}

	await fs.mkdir(outDir, { recursive: true })

	const fileId = await uploadPdf(secret, pdfPath)
	const outputFiles = await convertPdfToPngFiles(secret, fileId)

	if (outputFiles.length === 0) {
		throw new Error(`No PNG files were returned for ${path.basename(pdfPath)}.`)
	}

	let pageNumber = 0
	for (const fileMeta of outputFiles) {
		pageNumber += 1
		const pageName = `page-${String(pageNumber).padStart(3, '0')}.png`
		const pagePath = path.join(outDir, pageName)
		await downloadToFile(fileMeta.Url, pagePath)
	}

	return { skipped: false, pages: pageNumber }
}

async function main() {
	const opts = parseArgs(process.argv.slice(2))

	const pdfFiles = await listPdfFiles(opts.input, opts.from, opts.to)
	if (pdfFiles.length === 0) {
		console.log('No matching PDF files found.')
		return
	}

	if (opts.dryRun) {
		console.log('Dry run - matching PDFs:')
		for (const entry of pdfFiles) {
			console.log(` - ${entry.fileName}`)
		}
		return
	}

	await fs.mkdir(opts.output, { recursive: true })

	let convertedCount = 0
	let skippedCount = 0
	let totalPages = 0

	for (const entry of pdfFiles) {
		process.stdout.write(`Converting ${entry.fileName}... `)
		try {
			const result = await convertSinglePdf(opts.secret, entry.fullPath, opts.output, opts.overwrite)
			totalPages += result.pages
			if (result.skipped) {
				skippedCount += 1
				console.log('skipped')
			} else {
				convertedCount += 1
				console.log(`done (${result.pages} pages)`)
			}
		} catch (error) {
			console.log('failed')
			throw error
		}
	}

	console.log('\nConversion complete:')
	console.log(` - PDFs converted: ${convertedCount}`)
	console.log(` - PDFs skipped:   ${skippedCount}`)
	console.log(` - PNG pages:      ${totalPages}`)
	console.log(` - Output folder:  ${opts.output}`)
}

main().catch((error) => {
	console.error('\nConversion failed:', error?.message ?? error)
	process.exit(1)
})