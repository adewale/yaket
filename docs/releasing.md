# Releasing Yaket

This document describes the release process for Yaket and the rules that keep GitHub and npm aligned.

Yaket uses a manual npm-first release model. GitHub Actions validates release tags, but it does not hold npm credentials, publish npm packages, or create official GitHub releases.

## Release Invariants

For a release `X.Y.Z`, all of the following should match:

1. `package.json` version: `X.Y.Z`
2. `package-lock.json` root version: `X.Y.Z`
3. git tag: `vX.Y.Z`
4. npm package version: `X.Y.Z`
5. GitHub release tag: `vX.Y.Z`

The npm package and GitHub release should come from the exact tagged commit.

## Recommended Flow

First prepare and merge/commit the release changes (`package.json`, `package-lock.json`, `CHANGELOG.md`, and any code/docs changes). Then use the single manual release command from a clean `main` that matches `origin/main`:

```bash
npm run release:manual -- X.Y.Z
```

The command performs the publication as one ordered transaction:

1. assert the worktree and index are clean
2. assert the current branch is `main`
3. fetch `origin/main` and tags
4. assert `HEAD` equals `origin/main`
5. assert `package.json`, `package-lock.json`, and `CHANGELOG.md` all describe `X.Y.Z`
6. run `npm ci`
7. run `npm run verify`
8. create annotated tag `vX.Y.Z` locally
9. publish to npm from that exact commit
10. push `main` and `vX.Y.Z`
11. create the GitHub release with `gh release create --verify-tag`

If npm publish fails, the command does not push the tag and does not create a GitHub release.

## Manual Fallback Checklist

Use this only if `npm run release:manual -- X.Y.Z` cannot be used.

### 1. Update release metadata

```bash
npm version X.Y.Z --no-git-tag-version
```

Then update:

- `CHANGELOG.md`

### 2. Verify locally

```bash
npm ci
npm run verify
npm run benchmark
npm run benchmark:multilingual   # if Python YAKE is available locally
```

Use the write variants only when the reference dependencies are installed and you intentionally want to refresh tracked benchmark reports:

```bash
npm run benchmark:write
npm run benchmark:multilingual:write
```

For a major-version bump that changes the public API surface (such as the
0.5 → 0.6 alias removal), also confirm that:

- `docs/migration-bobbin-0.6.md` (or the equivalent guide for the new
  major) covers every removed / renamed entry point.
- `CHANGELOG.md` lists each breaking change explicitly.
- `docs/api-reference.md` and `README.md` no longer document the removed
  surface as supported.

### 3. Commit and tag locally

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release Yaket X.Y.Z"
git tag -a vX.Y.Z -m "Release Yaket X.Y.Z"
```

### 4. Publish npm before pushing the tag

```bash
npm publish --access public
npm view @ade_oshineye/yaket version
```

The registry must report `X.Y.Z` before the tag is pushed or the GitHub release is created.

### 5. Push and create the GitHub release

```bash
git push origin main
git push origin vX.Y.Z
gh release create vX.Y.Z --generate-notes --verify-tag
```

## Automated GitHub Release Validation

The repository includes `.github/workflows/release.yml`.

On every tag push matching `v*.*.*`, it will:

1. verify that the tag version matches `package.json`
2. run `npm ci`
3. run `npm run verify`
4. run `npm run benchmark`

It intentionally does not publish npm and does not create GitHub releases. This keeps npm credentials out of GitHub and makes npm publish the explicit point of no return.

## npm Authentication

Do not add `NPM_TOKEN` to GitHub for this release model.

Authenticate locally instead:

```bash
npm login
npm whoami
npm publish --access public
```

Alternatively, keep an npm automation token in your local password manager and configure it only in your local npm environment for the publish command.

## Verification After Release

After publishing and creating the GitHub release:

1. confirm npm reports version `X.Y.Z`
2. confirm the GitHub release exists for `vX.Y.Z`
3. confirm install works:

```bash
npm view @ade_oshineye/yaket version
npm install @ade_oshineye/yaket
```

## Failure Modes To Watch For

1. tag/version mismatch
2. stale `package-lock.json`
3. CI-only floating-point fixture differences
4. pushing a tag before npm publish succeeds
5. creating a GitHub release before npm publish succeeds
6. creating a GitHub release from a commit that differs from the npm publish commit

The safest rule is simple:

> Publish npm first from the exact local release commit, then push the tag and create the GitHub release.
