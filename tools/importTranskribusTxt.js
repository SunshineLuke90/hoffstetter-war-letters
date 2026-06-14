import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const DEFAULT_EXPORT_DIR = path.join(ROOT_DIR, 'export_job_28098536')
const DEFAULT_LETTERS_DIR = path.join(ROOT_DIR, 'letters')

function printHelpAndExit(code) {
	console.log(`
Usage:
	node tools/importTranskribusTxt.js [options]

Options:
	-e, --export <path>     Transkribus export folder (default: export_job_28098536)
	-l, --letters <path>    Letters root folder (default: letters)
	-p, --person <name>     Person folder under letters (required, e.g. Ollie)
	    --overwrite         Overwrite existing .txt files in destination folders
	    --dry-run           Show what would be copied without changing files
	    --list-people       Show valid values for --person and exit
	-h, --help              Show this help

How it works:
	- Scans the export folder for document folders containing a txt/ subfolder.
	- Uses DOCUMENTNAME from each document folder name.
	- Copies each .txt file to letters/PERSON/pngs/DOCUMENTNAME/<file>.txt.

Examples:
	npm run import:transkribus-txt -- --person Ollie
	npm run import:transkribus-txt -- --person Martha --export export_job_28098536 --dry-run
`)
	process.exit(code)
}

function parseArgs(argv) {
	const opts = {
		exportDir: DEFAULT_EXPORT_DIR,
		lettersDir: DEFAULT_LETTERS_DIR,
		person: null,
		overwrite: false,
		dryRun: false,
		listPeople: false,
	}

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]

		if (arg === '--export' || arg === '-e') {
			const next = argv[i + 1]
			if (!next || next.startsWith('-')) {
				console.error('Missing value for --export')
				printHelpAndExit(1)
			}
			opts.exportDir = path.resolve(next)
			i += 1
			continue
		}

		if (arg === '--letters' || arg === '-l') {
			const next = argv[i + 1]
			if (!next || next.startsWith('-')) {
				console.error('Missing value for --letters')
				printHelpAndExit(1)
			}
			opts.lettersDir = path.resolve(next)
			i += 1
			continue
		}

		if (arg === '--person' || arg === '-p') {
			const next = argv[i + 1]
			if (!next || next.startsWith('-')) {
				console.error('Missing value for --person')
				printHelpAndExit(1)
			}
			opts.person = next
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

		if (arg === '--list-people') {
			opts.listPeople = true
			continue
		}

		if (arg === '--help' || arg === '-h') {
			printHelpAndExit(0)
		}

		console.error(`Unknown option: ${arg}`)
		printHelpAndExit(1)
	}

	return opts
}

async function ensureDirectoryExists(targetDir, label) {
	let stats
	try {
		stats = await fs.stat(targetDir)
	} catch {
		throw new Error(`${label} does not exist: ${targetDir}`)
	}

	if (!stats.isDirectory()) {
		throw new Error(`${label} is not a directory: ${targetDir}`)
	}
}

async function getAvailablePeople(lettersDir) {
	const entries = await fs.readdir(lettersDir, { withFileTypes: true })
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b))
}

function resolvePerson(availablePeople, personInput) {
	if (!personInput) return null

	for (const person of availablePeople) {
		if (person === personInput) return person
	}

	const normalized = personInput.toLowerCase()
	for (const person of availablePeople) {
		if (person.toLowerCase() === normalized) return person
	}

	return null
}

async function collectDocumentDirsWithTxt(exportDir) {
	const queue = [exportDir]
	const documentDirs = []

	while (queue.length > 0) {
		const current = queue.shift()
		const entries = await fs.readdir(current, { withFileTypes: true })

		for (const entry of entries) {
			if (!entry.isDirectory()) continue

			const fullPath = path.join(current, entry.name)
			if (entry.name === 'txt') {
				documentDirs.push(path.dirname(fullPath))
				continue
			}

			queue.push(fullPath)
		}
	}

	documentDirs.sort((a, b) => a.localeCompare(b))
	return documentDirs
}

async function listTxtFiles(txtDir) {
	const entries = await fs.readdir(txtDir, { withFileTypes: true })
	return entries
		.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b))
}

async function pathExists(targetPath) {
	try {
		await fs.access(targetPath)
		return true
	} catch {
		return false
	}
}

async function importDocumentTxts(documentDir, destinationRoot, overwrite, dryRun) {
	const documentName = path.basename(documentDir)
	const txtDir = path.join(documentDir, 'txt')
	const txtFiles = await listTxtFiles(txtDir)

	if (txtFiles.length === 0) {
		return { documentName, txtCount: 0, copiedCount: 0, skippedCount: 0 }
	}

	const destinationDir = path.join(destinationRoot, documentName)
	if (!dryRun) {
		await fs.mkdir(destinationDir, { recursive: true })
	}

	let copiedCount = 0
	let skippedCount = 0

	for (const fileName of txtFiles) {
		const sourcePath = path.join(txtDir, fileName)
		const destinationPath = path.join(destinationDir, fileName)
		const exists = await pathExists(destinationPath)

		if (exists && !overwrite) {
			skippedCount += 1
			continue
		}

		if (!dryRun) {
			await fs.copyFile(sourcePath, destinationPath)
		}
		copiedCount += 1
	}

	return { documentName, txtCount: txtFiles.length, copiedCount, skippedCount }
}

function printPeople(people) {
	if (people.length === 0) {
		console.log('No people folders found under letters directory.')
		return
	}

	console.log('Available people for --person:')
	for (const person of people) {
		console.log(` - ${person}`)
	}
}

async function main() {
	const opts = parseArgs(process.argv.slice(2))

	await ensureDirectoryExists(opts.lettersDir, 'Letters directory')
	const availablePeople = await getAvailablePeople(opts.lettersDir)

	if (opts.listPeople) {
		printPeople(availablePeople)
		return
	}

	if (!opts.person) {
		console.error('Missing required option: --person <name>')
		printPeople(availablePeople)
		process.exit(1)
	}

	const personFolderName = resolvePerson(availablePeople, opts.person)
	if (!personFolderName) {
		console.error(`Invalid --person value: ${opts.person}`)
		printPeople(availablePeople)
		process.exit(1)
	}

	await ensureDirectoryExists(opts.exportDir, 'Export directory')

	const destinationRoot = path.join(opts.lettersDir, personFolderName, 'pngs')
	if (!opts.dryRun) {
		await fs.mkdir(destinationRoot, { recursive: true })
	}

	const documentDirs = await collectDocumentDirsWithTxt(opts.exportDir)
	if (documentDirs.length === 0) {
		console.log('No document txt folders found in export directory.')
		return
	}

	let documentsSeen = 0
	let totalTxtFiles = 0
	let totalCopied = 0
	let totalSkipped = 0

	for (const documentDir of documentDirs) {
		const result = await importDocumentTxts(documentDir, destinationRoot, opts.overwrite, opts.dryRun)
		if (result.txtCount === 0) continue

		documentsSeen += 1
		totalTxtFiles += result.txtCount
		totalCopied += result.copiedCount
		totalSkipped += result.skippedCount

		console.log(
			`Processed ${result.documentName}: ${result.copiedCount} copied, ${result.skippedCount} skipped (total ${result.txtCount})`,
		)
	}

	console.log('\nImport complete:')
	console.log(` - Person:            ${personFolderName}`)
	console.log(` - Export folder:     ${opts.exportDir}`)
	console.log(` - Destination root:  ${destinationRoot}`)
	console.log(` - Documents found:   ${documentsSeen}`)
	console.log(` - TXT files seen:    ${totalTxtFiles}`)
	console.log(` - TXT files copied:  ${totalCopied}`)
	console.log(` - TXT files skipped: ${totalSkipped}`)
	if (opts.dryRun) {
		console.log(' - Mode:              dry-run (no files changed)')
	}
}

main().catch((error) => {
	console.error('\nImport failed:', error?.message ?? error)
	process.exit(1)
})
