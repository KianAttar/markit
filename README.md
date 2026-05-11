# Markit

A tool for instructors and TAs to organize student assignment and exam submissions.

## What it does

Student submissions arrive as a flat folder of files, each named with the student's ID, name, submission timestamp, and filename. Markit parses this structure, creates a folder per student, resolves duplicate submissions by keeping the latest, and expands zip files into their contents.

## Usage

```bash
# Organize into a separate output folder (non-destructive)
pnpm organize <input-dir> <output-dir>

# Organize in-place (mutates the input folder)
pnpm organize <input-dir>
```

## Submission format

Markit expects files named in the following format:

```
{id} - {Full Name} - {Month D, YYYY HHmm AM/PM} - {filename}
```

Example:
```
552598-293497 - Festus Ayomike - May 8, 2026 1123 PM - lab1.cpp
```

## Development

```bash
pnpm install

# Run tests (debug logging — what CI uses)
pnpm test

# Run tests (warn logging — quieter for local development)
pnpm test:local
```

## Logging

Set `LOG_LEVEL` to control verbosity: `debug`, `info`, `warn`, or `error`. Defaults to `info`.

```bash
LOG_LEVEL=debug pnpm organize submissions output
```
