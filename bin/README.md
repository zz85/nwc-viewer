# NWC Parser CLI

A command-line tool for parsing Noteworthy Composer (NWC) files into JSON format.

## Installation

```bash
# Install dependencies
npm install
# or
bun install

# Link the CLI tool globally (optional)
npm link
# or
bun link
```

## Usage

```bash
# Basic usage - outputs compact JSON
nwc-parse file.nwc

# Pretty print JSON output
nwc-parse --pretty file.nwc
nwc-parse -p file.nwc

# Show help
nwc-parse --help
nwc-parse -h
```

## Examples

```bash
# Parse a file and save to JSON
nwc-parse song.nwc > song.json

# Parse with pretty formatting
nwc-parse --pretty song.nwc > song-formatted.json

# Use with bun directly (without installation)
bun bin/nwc-parse.js file.nwc
```

## Supported NWC Versions

- NWC v1.5
- NWC v1.7
- NWC v2.75 (nwctext format)

## Output Format

The tool outputs a JSON object containing:
- `header`: File metadata (version, product info)
- `score`: Musical notation data including:
  - `staves`: Array of staff objects with tokens
  - `fonts`: Font definitions
  - Song information (title, author, copyright, etc.)

## Development

Run directly with Node.js or Bun:

```bash
node bin/nwc-parse.js file.nwc
bun bin/nwc-parse.js file.nwc
```
