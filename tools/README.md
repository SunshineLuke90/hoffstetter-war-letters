# Tools

This folder contains helper CLI scripts for preparing and organizing scanned letters and transcription files.

## Quick Start

Run all commands from the repository root.

- Show help for any tool:

```bash
npm run <script-name> -- --help
```

- Most tools support a dry run mode before changing files.

## Available Commands

| npm command | Script | Purpose |
| --- | --- | --- |
| `npm run convert:pdfs` | `tools/convertPdfs.js` | Convert dated PDF letters into PNG page images using ConvertAPI. |
| `npm run reorder:pngs` | `tools/reorderPngs.js` | Renumber page PNGs in sequence while leaving manual names untouched. |
| `npm run import:transkribus-txt` | `tools/importTranskribusTxt.js` | Import Transkribus exported `.txt` files into matching letter date folders. |

## 1) PDF to PNG Conversion

Command:

```bash
npm run convert:pdfs -- [options]
```

Equivalent direct script call:

```bash
node tools/convertPdfs.js [options]
```

### Required setup

- Set `CONVERTAPI_SECRET` in your shell, or pass `--secret <value>`.
- Secret is not required for `--dry-run`.

### Flags

| Flag | Description | Default |
| --- | --- | --- |
| `-i, --input <dir>` | Input folder containing PDF files. | `letters/Ollie` |
| `-o, --output <dir>` | Output root for PNG pages. | `letters/Ollie/pngs` |
| `--from <YYYY-MM-DD>` | Inclusive start date filter based on filename. | none |
| `--to <YYYY-MM-DD>` | Inclusive end date filter based on filename. | none |
| `--secret <value>` | ConvertAPI secret key. | `CONVERTAPI_SECRET` env |
| `--overwrite` | Replace files in existing output folders. | off |
| `--dry-run` | Print matching files without converting. | off |
| `-h, --help` | Show usage help. | n/a |

### Input expectations

- PDFs should be named like `YYYY-MM-DD.pdf` for date filtering to work.
- Output layout per PDF:

```text
<output>/<pdf-date>/page-001.png
<output>/<pdf-date>/page-002.png
...
```

### Examples

```bash
npm run convert:pdfs -- --dry-run
npm run convert:pdfs -- --from 1943-07-01 --to 1943-08-31
npm run convert:pdfs -- --input letters/Ollie --output letters/Ollie/pngs --overwrite
npm run convert:pdfs -- --secret "$CONVERTAPI_SECRET" --from 1944-01-01
```

## 2) Reorder PNG Page Numbers

Command:

```bash
npm run reorder:pngs -- [options]
```

Equivalent direct script call:

```bash
node tools/reorderPngs.js [options]
```

### What it does

- Renumbers only files matching `<prefix>-NNN.png` (default prefix is `page`).
- Leaves manual files like `envelope.png`, `photo.png`, and other names untouched.
- Compacts numbering to start at `001` within each processed folder.

### Flags

| Flag | Description | Default |
| --- | --- | --- |
| `-d, --dir <path>` | Target folder to process. | `letters/Ollie/pngs` |
| `--recursive` | Process the target folder and all nested folders. | off |
| `--dry-run` | Print planned renames without applying them. | off |
| `--prefix <value>` | Page filename prefix. Must match `[A-Za-z0-9_-]+`. | `page` |
| `-h, --help` | Show usage help. | n/a |

### Examples

```bash
npm run reorder:pngs -- --dir letters/Ollie/pngs/1945-05-14
npm run reorder:pngs -- --dir letters/Ollie/pngs --recursive --dry-run
npm run reorder:pngs -- --dir letters/Ollie/pngs --recursive --prefix page
```

## 3) Import Transkribus TXT Export

Command:

```bash
npm run import:transkribus-txt -- [options]
```

Equivalent direct script call:

```bash
node tools/importTranskribusTxt.js [options]
```

### What it does

- Scans a Transkribus export folder for document directories that contain a `txt/` subfolder.
- Uses the document directory name as `DOCUMENTNAME` (for example `1943-07-17`).
- Copies each `.txt` file into:

```text
letters/PERSON/pngs/DOCUMENTNAME/
```

Example source layout:

```text
export_job_28098536/<doc-id>/1943-07-17/txt/page-001.txt
```

Example destination layout:

```text
letters/Ollie/pngs/1943-07-17/page-001.txt
```

### Flags

| Flag | Description | Default |
| --- | --- | --- |
| `-e, --export <path>` | Transkribus export folder root. | `export_job_28098536` |
| `-l, --letters <path>` | Letters root directory. | `letters` |
| `-p, --person <name>` | Person folder under letters. Required. | none |
| `--overwrite` | Replace destination `.txt` files when they already exist. | off |
| `--dry-run` | Print what would be copied without writing files. | off |
| `--list-people` | List valid person options from the letters directory and exit. | off |
| `-h, --help` | Show usage help. | n/a |

### Person behavior

- `--person` is required unless `--list-people` is used.
- Person names are validated from folders directly under `letters/`.
- Matching is case-insensitive, but the canonical folder name is used.

### Examples

```bash
npm run import:transkribus-txt -- --list-people
npm run import:transkribus-txt -- --person Ollie --dry-run
npm run import:transkribus-txt -- --person Martha --export export_job_28098536
npm run import:transkribus-txt -- --person Ollie --export export_job_28098536 --overwrite
```

## Suggested Workflow

1. Convert PDFs to PNG pages.
2. Reorder page numbering if needed.
3. Import Transkribus `.txt` files into matching date folders.
4. Re-run with `--overwrite` only when you intentionally want to replace existing outputs.
