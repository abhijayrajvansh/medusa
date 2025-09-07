# GitHub Copilot Instructions

This document contains specific instructions for GitHub Copilot when working on this project.

## Package Manager

- **Always use `pnpm`** for all package management operations
- Use `pnpm install` instead of `npm install` or `yarn install`
- Use `pnpm add` instead of `npm install` or `yarn add`
- Use `pnpm remove` instead of `npm uninstall` or `yarn remove`
- Use `pnpm run` for executing scripts

## Build and Development

- **Never build the project** - building is handled separately
- **Never perform linting** - linting is handled by the development workflow
- **Never start the dev server** - the development server is already running on port 3000

## Type Checking

- **Always check for type errors after making changes to a file**
- Use `pnpm exec tsc --noEmit` to verify TypeScript types
- Ensure all type errors are resolved before considering a change complete

## Post Agent Completion (must perform after making any code changes)

- **use git cli and commit your changes in briefly**
- use this format for commit message: `feat: <short description of the feature>`
- different types of git you should use are
  - feat: for new features
  - fix: for bug fixes
  - docs: for documentation changes
  - style: for code style changes (formatting, missing semicolons, etc.)
  - refactor: for code changes that neither fix a bug nor add a feature
  - perf: for performance improvements
  - test: for adding missing tests or correcting existing tests
- **Never use `git commit -a`** - always stage files explicitly with `git add <file>` before committing
- **After git commit use `git push`** - to push to origin and current branch.

## Pull Request Guidelines

When asked to raise a pull request:

- Always build the project first using `pnpm run build`
- Ensure all errors are resolved
- **create PR from current branch to `dev` branch**
- Use structured PR description with the following format, refer `.github/pull-request-template.md` for sample template.
- Read the current branch whole commits and ensure the PR description is short, clear and concise.
