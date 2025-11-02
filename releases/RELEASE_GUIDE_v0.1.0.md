# Release v0.1.0 - Release Guide

## Pre-Release Checklist

✅ CHANGELOG.md updated with release date (2025-11-02)  
✅ Release notes created (RELEASE_NOTES_v0.1.0.md)  
✅ All features documented  
✅ Repository organized  

## Steps to Create GitHub Release

### 1. Verify Everything is Committed

```bash
git status
# Should show "nothing to commit, working tree clean"
```

### 2. Ensure CI is Passing

Check GitHub Actions at: https://github.com/TMHSDigital/Static_Chess/actions

The CI workflow should show:
- ✅ Linting passes
- ✅ Tests pass

### 3. Create and Push Release Tag

```bash
# Create an annotated tag
git tag -a v0.1.0 -m "Release v0.1.0 - First Public Release"

# Push the tag to GitHub
git push origin v0.1.0
```

### 4. Automatic Release Creation

The GitHub Actions workflow (`.github/workflows/release.yml`) will automatically:
- Detect the pushed tag (any tag starting with `v`)
- Read `releases/RELEASE_NOTES_v0.1.0.md` if it exists (or root for backwards compatibility)
- Create a GitHub Release with the tag name and release notes
- Publish it automatically

**No manual steps required!** Just push the tag and the release will be created automatically.

You can monitor the workflow at: https://github.com/TMHSDigital/Static_Chess/actions

### 5. Post-Release Tasks

- [ ] Verify GitHub Pages still works: https://tmhsdigital.github.io/Static_Chess/
- [ ] Check that release appears on releases page
- [ ] Update any external references if needed
- [ ] Consider announcing on social media/blog (optional)

## Release Notes Template

Use this template for the GitHub release description:

```markdown
# Release v0.1.0 - First Public Release

**Release Date:** November 2, 2025

## First Public Release

This is the first official release of Static Chess, marking the completion of the public-ready upgrade plan.

## What's New

### Core Features
- **Drag and Drop**: Intuitive piece movement by dragging pieces
- **Undo Move**: Easily revert your last move
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance**: Optimized rendering and move calculation

### Developer Experience
- **CI/CD**: Automated testing and linting
- **Testing**: Comprehensive Jest test suite
- **Code Quality**: ESLint, Prettier, EditorConfig
- **Documentation**: Complete architecture docs

## Statistics

- **Files Changed**: 50+ files
- **New Features**: 6 major features
- **Tests Added**: 4 test suites

## Links

- **Play Now**: https://tmhsdigital.github.io/Static_Chess/
- **Source Code**: https://github.com/TMHSDigital/Static_Chess
- **Full Changelog**: See [CHANGELOG.md](CHANGELOG.md)
```

## Semantic Versioning

This release follows [Semantic Versioning](https://semver.org/):
- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backwards compatible
- **PATCH** (0.0.X): Bug fixes

Since this is the first release, we're starting at **0.1.0** (minor version).

## Next Steps After Release

After publishing v0.1.0:
1. Continue with feature development
2. Address any issues reported
3. Plan next release (v0.2.0) with new features

