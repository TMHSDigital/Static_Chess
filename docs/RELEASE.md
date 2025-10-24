# Release Process

This project is a static site; no build. Releases are tags with notes.

1. Create a release branch (e.g., `release/vX.Y.Z`)
2. Update `CHANGELOG.md` and docs as needed
3. Run tests and lint (`npm test && npm run lint`)
4. Merge to `main`
5. Create GitHub Release with tag `vX.Y.Z` and changelog

## Versioning

Semantic Versioning (MAJOR.MINOR.PATCH).

## Labels and Triage

Use labels: `bug`, `enhancement`, `good first issue`, `help wanted`, `a11y`, `perf`.
