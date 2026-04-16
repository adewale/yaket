# Releasing Yaket

This document describes the release process for Yaket and the rules that keep GitHub and npm aligned.

## Release Invariants

For a release `X.Y.Z`, all of the following should match:

1. `package.json` version: `X.Y.Z`
2. `package-lock.json` root version: `X.Y.Z`
3. git tag: `vX.Y.Z`
4. GitHub release tag: `vX.Y.Z`
5. npm package version: `X.Y.Z`

The release should come from the exact tagged commit.

## Recommended Flow

1. Update `CHANGELOG.md`
2. Bump the package version
3. Run release verification locally
4. Commit the release changes
5. Create and push the release tag
6. Let the tag-based GitHub release workflow verify the tag and create the GitHub release
7. Publish the npm package from the same tagged commit, ideally through CI

## Manual Checklist

### 1. Update release metadata

```bash
npm version X.Y.Z --no-git-tag-version
```

Then update:

- `CHANGELOG.md`

### 2. Verify locally

```bash
npm run verify
npm run benchmark
```

### 3. Commit the release

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release Yaket X.Y.Z"
```

### 4. Create and push the tag

```bash
git tag vX.Y.Z
git push origin main --tags
```

## Automated GitHub Release Workflow

The repository includes `.github/workflows/release.yml`.

On every tag push matching `v*.*.*`, it will:

1. verify that the tag version matches `package.json`
2. run `npm ci`
3. run `npm run verify`
4. run `npm run benchmark`
5. create a GitHub release for the tag

## npm Publishing

The release workflow also includes an npm publish job, but it only runs if `NPM_TOKEN` is configured in GitHub Actions secrets.

That means there are two supported modes:

### Mode A: automated npm publish from CI

Requirements:

1. add `NPM_TOKEN` to the repository secrets
2. push a version tag after updating the version and changelog

Then the workflow will publish the same version that was tagged.

### Mode B: manual npm publish

If `NPM_TOKEN` is not configured, the workflow will still verify and create the GitHub release, but npm publishing must be done manually.

In that case, publish from the exact tagged commit:

```bash
git checkout vX.Y.Z
npm ci
npm run verify
npm publish --access public
```

## Verification After Release

After publishing:

1. confirm the GitHub release exists for `vX.Y.Z`
2. confirm npm reports version `X.Y.Z`
3. confirm install works:

```bash
npm view @ade_oshineye/yaket version
npm install @ade_oshineye/yaket
```

## Failure Modes To Watch For

1. tag/version mismatch
2. stale `package-lock.json`
3. CI-only floating-point fixture differences
4. publishing a version locally before the GitHub tag exists
5. creating a GitHub release from a commit that differs from the npm publish commit

The safest rule is simple:

> Always release from an exact version tag, and never publish npm from an untagged or dirty worktree.
