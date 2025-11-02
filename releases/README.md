# Releases Directory

This directory contains release-related files for each version of Static Chess.

## File Organization

For each release version `vX.Y.Z`, create:

- **`RELEASE_NOTES_vX.Y.Z.md`** - Release notes used by the GitHub Actions workflow to automatically generate GitHub Releases
- **`RELEASE_GUIDE_vX.Y.Z.md`** - Step-by-step release guide (optional, for reference)

## Current Releases

- **v0.1.0** - First Public Release (November 2, 2025)

## How It Works

1. When preparing a release, create `RELEASE_NOTES_vX.Y.Z.md` in this directory
2. Update `CHANGELOG.md` in the root directory
3. Push a tag `vX.Y.Z` to GitHub
4. The `.github/workflows/release.yml` workflow automatically:
   - Reads `releases/RELEASE_NOTES_vX.Y.Z.md`
   - Creates a GitHub Release with those notes
   - Publishes it automatically

## File Naming Convention

- Release notes: `RELEASE_NOTES_vX.Y.Z.md`
- Release guides: `RELEASE_GUIDE_vX.Y.Z.md`

Where `X.Y.Z` follows Semantic Versioning (e.g., `v0.1.0`, `v1.2.3`).

## Example Structure

```
releases/
├── README.md                    # This file
├── RELEASE_NOTES_v0.1.0.md     # Release notes for v0.1.0
├── RELEASE_GUIDE_v0.1.0.md      # Release guide for v0.1.0
├── RELEASE_NOTES_v0.2.0.md     # Future release notes
└── RELEASE_GUIDE_v0.2.0.md      # Future release guide
```

