---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0-pinned"
  argument-hint: <file-or-pattern>
  adapted: true
  adaptation: "Pinned to local guidelines.md (fetched 2026-06-21 from vercel-labs/web-interface-guidelines). Original version fetched remote guidelines on each run."
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the local guidelines from `guidelines.md` in this skill directory
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

**Pinned local copy** at `./guidelines.md`. Originally fetched from:
```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```
on 2026-06-21. To update guidelines, re-fetch the URL and replace `guidelines.md`.

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md` from this skill directory
2. Read the specified files
3. Apply all rules from the guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
