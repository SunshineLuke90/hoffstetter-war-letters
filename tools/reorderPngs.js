import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const DEFAULT_TARGET_DIR = path.join(ROOT_DIR, 'letters', 'pngs')
const TMP_PREFIX = '__tmp_reorder_page__'

function printHelpAndExit(code) {
	console.log(`
Usage:
	node tools/reorderPngs.js [options]

Options:
	-d, --dir <path>        Target directory (default: letters/pngs)
			--recursive         Process all child folders recursively
			--dry-run           Show planned renames without changing files
			--prefix <value>    Page filename prefix (default: page)
	-h, --help              Show this help

How it works:
	- Only files matching <prefix>-NNN.png are renumbered.
	- Manually named files (e.g. envelope.png, photo.png) are left untouched.
	- Page numbers are compacted to start from 1 in each processed folder.

Examples:
	npm run reorder:pngs -- --dir letters/pngs/1945-05-14
	npm run reorder:pngs -- --dir letters/pngs --recursive
	npm run reorder:pngs -- --dir letters/pngs --recursive --dry-run
`)
	process.exit(code)
}

function parseArgs(argv) {
	const opts = {
		dir: DEFAULT_TARGET_DIR,
		recursive: false,
		dryRun: false,
		prefix: 'page',
	}

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]

		if (arg === '--dir' || arg === '-d') {
			opts.dir = path.resolve(argv[i + 1])
			i += 1
			continue
		}

		if (arg === '--recursive') {
			opts.recursive = true
			continue
		}

		if (arg === '--dry-run') {
			opts.dryRun = true
			continue
		}

		if (arg === '--prefix') {
			opts.prefix = argv[i + 1]
			i += 1
			continue
		}

		if (arg === '--help' || arg === '-h') {
			printHelpAndExit(0)
		}

		console.error(`Unknown option: ${arg}`)
		printHelpAndExit(1)
	}

	if (!opts.prefix || !/^[A-Za-z0-9_-]+$/.test(opts.prefix)) {
		console.error('Invalid --prefix. Use only letters, numbers, dash, underscore.')
		process.exit(1)
	}

	return opts
}

function buildPageRegex(prefix) {
	return new RegExp(`^${prefix}-(\\d+)\\.png$`, 'i')
}

async function ensureDirectoryExists(targetDir) {
	let stats
	try {
		stats = await fs.stat(targetDir)
	} catch {
		console.error(`Directory does not exist: ${targetDir}`)
		process.exit(1)
	}

	if (!stats.isDirectory()) {
		console.error(`Path is not a directory: ${targetDir}`)
		process.exit(1)
	}
}

async function collectTargetFolders(baseDir, recursive) {
	if (!recursive) return [baseDir]

	const folders = []
	const queue = [baseDir]

	while (queue.length > 0) {
		const current = queue.shift()
		folders.push(current)

		const entries = await fs.readdir(current, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.isDirectory()) {
				queue.push(path.join(current, entry.name))
			}
		}
	}

	return folders
}

async function getPageFiles(dirPath, pageRegex) {
	const entries = await fs.readdir(dirPath, { withFileTypes: true })
	const pages = []

	for (const entry of entries) {
		if (!entry.isFile()) continue
		const match = entry.name.match(pageRegex)
		if (!match) continue

		pages.push({
			name: entry.name,
			fullPath: path.join(dirPath, entry.name),
			number: Number.parseInt(match[1], 10),
		})
	}

	pages.sort((a, b) => a.number - b.number || a.name.localeCompare(b.name))
	return pages
}

function makeTargetName(prefix, index) {
	return `${prefix}-${String(index).padStart(3, '0')}.png`
}

function buildRenamePlan(pageFiles, prefix) {
	return pageFiles
		.map((file, idx) => {
			const targetName = makeTargetName(prefix, idx + 1)
			const needsRename = file.name !== targetName
			return {
				oldName: file.name,
				oldPath: file.fullPath,
				newName: targetName,
				newPath: path.join(path.dirname(file.fullPath), targetName),
				needsRename,
			}
		})
		.filter((item) => item.needsRename)
}

async function applyRenamePlan(renamePlan, dryRun) {
	if (renamePlan.length === 0) return 0

	if (dryRun) return renamePlan.length

	for (let i = 0; i < renamePlan.length; i += 1) {
		const step = renamePlan[i]
		const tmpPath = path.join(path.dirname(step.oldPath), `${TMP_PREFIX}${String(i + 1).padStart(4, '0')}.png`)
		await fs.rename(step.oldPath, tmpPath)
		step.tmpPath = tmpPath
	}

	for (const step of renamePlan) {
		await fs.rename(step.tmpPath, step.newPath)
	}

	return renamePlan.length
}

function printFolderPlan(folderPath, renamePlan) {
	if (renamePlan.length === 0) return

	console.log(`Reordering ${renamePlan.length} page file(s) in ${folderPath}`)
	for (const step of renamePlan) {
		console.log(` - ${step.oldName} -> ${step.newName}`)
	}
}

async function reorderFolder(folderPath, pageRegex, prefix, dryRun) {
	const pageFiles = await getPageFiles(folderPath, pageRegex)
	if (pageFiles.length === 0) return { renamedCount: 0, pageCount: 0 }

	const renamePlan = buildRenamePlan(pageFiles, prefix)
	printFolderPlan(folderPath, renamePlan)
	const renamedCount = await applyRenamePlan(renamePlan, dryRun)

	return { renamedCount, pageCount: pageFiles.length }
}

async function main() {
	const opts = parseArgs(process.argv.slice(2))
	const pageRegex = buildPageRegex(opts.prefix)

	await ensureDirectoryExists(opts.dir)
	const folders = await collectTargetFolders(opts.dir, opts.recursive)

	let foldersWithPages = 0
	let foldersWithRenames = 0
	let totalPages = 0
	let totalRenamed = 0

	for (const folder of folders) {
		const result = await reorderFolder(folder, pageRegex, opts.prefix, opts.dryRun)
		if (result.pageCount > 0) {
			foldersWithPages += 1
			totalPages += result.pageCount
			totalRenamed += result.renamedCount
			if (result.renamedCount > 0) {
				foldersWithRenames += 1
			}
		}
	}

	console.log('\nReorder complete:')
	console.log(` - Folders with pages:   ${foldersWithPages}`)
	console.log(` - Folders with renames: ${foldersWithRenames}`)
	console.log(` - Page files seen:    ${totalPages}`)
	console.log(` - Files renamed:      ${totalRenamed}`)
	if (opts.dryRun) {
		console.log(' - Mode:               dry-run (no files changed)')
	}
}

main().catch((error) => {
	console.error('\nReorder failed:', error?.message ?? error)
	process.exit(1)
})
