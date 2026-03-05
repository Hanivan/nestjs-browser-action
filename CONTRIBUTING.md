# Contributing to @hanivanrizky/nestjs-browser-action

Thank you for your interest in contributing! This guide will help you set up your development environment and understand the contribution workflow.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Testing Locally](#testing-locally)
- [Coding Standards](#coding-standards)
- [Git Workflow](#git-workflow)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- Yarn or npm
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/hanivanrizky/nestjs-browser-action.git
cd nestjs-browser-action

# Install dependencies
yarn install

# Build the project
yarn build

# Run tests
yarn test
```

## Project Structure

```
nestjs-browser-action/
├── src/
│   ├── browser-action.module.ts          # Main module with forRoot/forRootAsync
│   ├── browser-action.module-definition.ts   # Module interfaces
│   ├── constants/                         # Constants and injection tokens
│   ├── decorators/                        # Custom decorators
│   ├── helpers/                           # Helper services
│   ├── interfaces/                        # TypeScript interfaces
│   ├── services/                          # Core services
│   └── index.ts                           # Public API exports
├── test/                                  # E2E tests
├── .husky/                                # Git hooks
├── docs/                                  # Design documents
└── package.json                           # Project configuration
```

### Key Services

- **BrowserPoolService**: Manages browser instance pool
- **BrowserManagerService**: Provides browser acquisition/release
- **PageService**: Manages page lifecycle
- **ActionHelpersService**: High-level browser automation helpers

## Testing Locally

Before submitting a pull request or publishing a release, it's important to test your changes locally in a real NestJS application.

### Method 1: Using Yarn Link (Recommended for Active Development)

**Step 1: Link the package locally**

In this repository:
```bash
yarn build
yarn link
```

**Step 2: Link in your test project**

In your NestJS test project:
```bash
yarn link @hanivanrizky/nestjs-browser-action
```

Now you can import and use the module:
```typescript
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';
```

**Step 3: Test your changes**

Make changes to the source code, rebuild, and the test project will automatically use the updated version.

**Step 4: Unlink when done**

In your test project:
```bash
yarn unlink @hanivanrizky/nestjs-browser-action
```

In this repository:
```bash
yarn unlink
```

### Method 2: Using Tarball (Recommended for Release Testing)

This method is best for testing the final package before publishing.

**Step 1: Create a tarball**

```bash
# Build the project
yarn build

# Create tarball
yarn pack
```

This creates a file like: `@hanivanrizky-nestjs-browser-action-0.0.1.tgz`

**Step 2: Install in test project**

In your NestJS test project:

```bash
yarn add ../nestjs-browser-action/@hanivanrizky-nestjs-browser-action-0.0.1.tgz
```

**Step 3: Test thoroughly**

```bash
# Run your test application
yarn start

# Or run tests
yarn test
```

**Step 4: Verify functionality**

Create a simple test to verify the module works:

```typescript
import { Module } from '@nestjs/common';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      launchOptions: { headless: true },
      pool: { min: 1, max: 2 },
    }),
  ],
})
export class AppModule {}
```

**Step 5: Clean up**

After testing, you can remove the package:

```bash
yarn remove @hanivanrizky-nestjs-browser-action
```

### Method 3: Installing from GitHub Branch

**Step 1: Push your changes to a branch**

```bash
git push origin feature-branch
```

**Step 2: Install in test project from GitHub**

```bash
yarn add git+https://github.com/hanivanrizky/nestjs-browser-action.git#feature-branch
```

This is useful for testing with collaborators before merging.

### Common Testing Scenarios

#### Test 1: Basic Module Registration

```typescript
// In your test project
import { Test, TestingModule } from '@nestjs/testing';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

describe('Module Test', () => {
  it('should register module', async () => {
    const module = await Test.createTestingModule({
      imports: [
        BrowserActionModule.forRoot({
          launchOptions: { headless: true },
          pool: { min: 1, max: 2 },
        }),
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
```

#### Test 2: Screenshot Functionality

```typescript
import { ActionHelpersService } from '@hanivanrizky/nestjs-browser-action';

describe('Screenshot Test', () => {
  it('should take screenshot', async () => {
    // Test screenshot functionality
    // Verify output file exists
  });
});
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide type annotations for function parameters
- Return types should be explicit for public APIs
- Use interfaces for object shapes

### Naming Conventions

- **Files**: kebab-case (`browser-action.module.ts`)
- **Classes**: PascalCase (`BrowserManagerService`)
- **Methods/Functions**: camelCase (`getBrowser`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_POOL_OPTIONS`)
- **Private members**: prefix with `_` (`_currentIndex`)

### Code Style

This project uses ESLint and Prettier for code formatting:

```bash
# Check code style
yarn lint

# Auto-fix issues
yarn lint --fix

# Format code
yarn format
```

### Testing

- Write tests for all new features
- Maintain test coverage above 80%
- Use descriptive test names
- Follow Arrange-Act-Assert pattern

```typescript
describe('ServiceName', () => {
  it('should do something when condition is met', async () => {
    // Arrange
    const input = { /* test data */ };

    // Act
    const result = await service.method(input);

    // Assert
    expect(result).toEqual(expected);
  });
});
```

## Git Workflow

### Branch Naming

- `feature/` - New features (`feature/add-pdf-support`)
- `fix/` - Bug fixes (`fix/fix-memory-leak`)
- `docs/` - Documentation (`docs/update-readme`)
- `refactor/` - Code refactoring (`refactor/optimize-pool`)
- `chore/` - Maintenance tasks (`chore/update-deps`)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```bash
git commit -m "feat(page): add support for custom headers"
git commit -m "fix(pool): properly close browsers on module destroy"
git commit -m "docs(readme): add installation instructions"
```

### Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass: `yarn test`
3. Ensure build succeeds: `yarn build`
4. Update CHANGELOG if needed
5. Create PR with descriptive title and description
6. Link related issues
7. Request review from maintainers

## Git Hooks

This project uses Husky for Git hooks:

### Pre-commit

Runs ESLint to check code quality:

```bash
yarn lint
```

### Pre-push

- Builds the project (must pass)
- Runs tests (can be skipped with `SKIP_TESTS=true`)

```bash
# Normal push
git push

# Skip tests
SKIP_TESTS=true git push
```

### Why Hooks Matter

- Catch errors before pushing
- Maintain code quality
- Prevent broken builds
- Enforce testing standards

## Release Process

### Automated Releases with release-it

This project uses `release-it` for automated releases:

```bash
yarn release
```

**What release-it does:**
1. Runs tests and build
2. Suggests version bump based on commits
3. Updates version in package.json
4. Generates CHANGELOG.md
5. Creates git tag
6. Pushes to GitHub
7. Publishes to npm

### Version Bumping

release-it analyzes your commits and suggests the appropriate version bump:

- `feat:` → **minor** (0.0.1 → 0.1.0)
- `fix:` → **patch** (0.0.1 → 0.0.2)
- `BREAKING CHANGE:` → **major** (0.0.1 → 1.0.0)

### Manual Version Bump

```bash
# Patch release
yarn release patch

# Minor release
yarn release minor

# Major release
yarn release major

# Pre-release (beta, alpha, etc.)
yarn release --preRelease=beta
```

### Dry Run

Test the release process without actually releasing:

```bash
yarn release --dry-run
```

### Pre-release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] Build succeeds without errors
- [ ] Documentation is updated
- [ ] CHANGELOG is accurate
- [ ] Version number is correct
- [ ] Tested locally with tarball
- [ ] No breaking changes (or documented if present)

### Local Testing Before Release

**Step 1: Create tarball**

```bash
yarn build
yarn pack
```

**Step 2: Test in demo project**

```bash
cd ../demo-project
yarn add ../nestjs-browser-action/@hanivanrizky-nestjs-browser-action-0.0.1.tgz
```

**Step 3: Verify functionality**

Run your tests and verify the module works as expected.

**Step 4: Release**

If everything works:

```bash
yarn release
```

## Getting Help

### Questions?

- Open an issue on GitHub
- Check existing issues and discussions
- Read the documentation

### Reporting Bugs

When reporting bugs, please include:

- Node.js version
- Package version
- Reproduction steps
- Expected behavior
- Actual behavior
- Error messages/logs

### Feature Requests

We welcome feature requests! Please:

- Describe the use case
- Explain why it's needed
- Provide examples if possible
- Consider if it fits the project scope

## Code Review Guidelines

### For Reviewers

- Be constructive and respectful
- Explain reasoning for suggestions
- Approve if the code is good enough (not perfect)
- Test locally if needed

### For Contributors

- Be open to feedback
- Ask questions if something is unclear
- Learn from the review process
- Iterate based on suggestions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Contributions make this project better for everyone. Thank you for your time and effort!
