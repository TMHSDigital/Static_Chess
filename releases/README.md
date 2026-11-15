# Releases Directory

This directory contains release-related files for each version of Static Chess.

## File Organization

For each release version `vX.Y.Z`, create:

- **`RELEASE_NOTES_vX.Y.Z.md`** - Release notes used by the GitHub Actions workflow to automatically generate GitHub Releases
- **`RELEASE_GUIDE_vX.Y.Z.md`** - Step-by-step release guide (optional, for reference)

## Current Releases

- **v0.2.0** - Computer Opponent, Full Rules and Accessibility (November 13, 2026)
- **v0.1.0** - First Public Release (November 2, 2025)

## How It Works

The steps for making a release are in [docs/RELEASE.md](../docs/RELEASE.md), and only there, so they cannot drift apart. In short: the notes file in this directory is what the `.github/workflows/release.yml` workflow publishes as the GitHub Release when a tag `vX.Y.Z` is pushed, after lint and the tests have passed. The version in `package.json` has to be set as well; that document says how.

## File Naming Convention

- Release notes: `RELEASE_NOTES_vX.Y.Z.md`
- Release guides: `RELEASE_GUIDE_vX.Y.Z.md`

Where `X.Y.Z` follows Semantic Versioning (e.g., `v0.1.0`, `v1.2.3`).

## Example Structure

```
releases/
├── README.md                    # This file
├── RELEASE_NOTES_v0.1.0.md     # Release notes for v0.1.0
├── RELEASE_GUIDE_v0.1.0.md      # Release guide for v0.1.0 (guides are optional)
└── RELEASE_NOTES_v0.2.0.md     # Release notes for v0.2.0
```
