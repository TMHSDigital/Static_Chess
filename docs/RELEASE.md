# Release Process

This project is a static site; no build. Releases are automated via GitHub Actions when tags are pushed.

## Automated Release Workflow

When you push a tag starting with `v` (e.g., `v0.1.0`, `v1.2.3`), the `.github/workflows/release.yml` workflow automatically:

1. Detects the pushed tag
2. Reads release notes from `RELEASE_NOTES_vX.Y.Z.md` if it exists
3. Creates a GitHub Release with the tag name and release notes
4. Publishes the release automatically

## Release Steps

1. **Prepare Release**:
   - Update `CHANGELOG.md` with the new version and date
   - Create `RELEASE_NOTES_vX.Y.Z.md` with release summary (optional but recommended)
   - Ensure all changes are committed and pushed to `main`

2. **Verify CI Passes**:
   - Check that GitHub Actions CI is green: https://github.com/TMHSDigital/Static_Chess/actions
   - Run locally: `npm test && npm run lint`

3. **Create and Push Tag**:
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z - Description"
   git push origin vX.Y.Z
   ```

4. **Monitor Release**:
   - Watch the workflow at: https://github.com/TMHSDigital/Static_Chess/actions
   - Verify release appears at: https://github.com/TMHSDigital/Static_Chess/releases

The release will be created automatically within minutes of pushing the tag.

## Versioning

Semantic Versioning (MAJOR.MINOR.PATCH):
- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backwards compatible
- **PATCH** (0.0.X): Bug fixes

## Release Notes

For each release, create a `RELEASE_NOTES_vX.Y.Z.md` file in the root directory. The workflow will automatically use this file for the GitHub Release description. If the file doesn't exist, a default release note will be generated referencing the CHANGELOG.

Example structure:
```markdown
# Release vX.Y.Z - Title

**Release Date:** YYYY-MM-DD

## What's New
- Feature 1
- Feature 2

## Links
- Play Now: https://tmhsdigital.github.io/Static_Chess/
- Full Changelog: See CHANGELOG.md
```

## Labels and Triage

Use labels: `bug`, `enhancement`, `good first issue`, `help wanted`, `a11y`, `perf`.
