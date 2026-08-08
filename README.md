# @sisques-labs/react-kit

**React Kit** — a shared React/Next.js library providing framework-agnostic
**domain utilities** (find-by-criteria interfaces, enums, hooks, i18n
helpers), a **shadcn/Radix UI component catalog**, **Next.js-specific**
helpers (route-handler proxy passthrough, `next/image`-based components),
and **stateful HTTP client factories** (axios, Apollo Client, TanStack
Query) — extracted from the duplicated `src/shared/` trees of Sisques Labs
Next.js frontends (`gardenia-web`, `nextjs-template`).

## Table of Contents

- [Publishing](#publishing)
  - [CI](#ci)
  - [Release](#release)
  - [Publish from your machine](#publish-from-your-machine)
- [Installation](#installation)
- [Peer Dependencies](#peer-dependencies)
  - [Entry Points / Subpath Exports](#entry-points--subpath-exports)
  - [Tailwind CSS](#tailwind-css)
- [Local development](#local-development)
- [Core (package root)](#core-package-root)
- [UI (`/ui`)](#ui-ui)
- [Next.js helpers (`/next`)](#nextjs-helpers-next)
- [HTTP client factories (`/http`)](#http-client-factories-http)
  - [Wiring axios + Apollo with a shared 401 refresh](#wiring-axios--apollo-with-a-shared-401-refresh)

---

## Publishing

The package is published to the public npm registry as
[`@sisques-labs/react-kit`](https://www.npmjs.com/package/@sisques-labs/react-kit)
(see `publishConfig` in `package.json`). Releases are fully automated with
GitHub Actions — there is no manual release step.

| Workflow | File | Trigger |
|---|---|---|
| **CI** | `.github/workflows/ci.yml` (`ci` job) | Push and pull requests targeting `main` |
| **Release** | `.github/workflows/ci.yml` (`release` job) | Push to `main`, after `ci` passes |

### CI

Runs `pnpm install --frozen-lockfile`, **`pnpm lint:check`**, **`pnpm build`**, and **`pnpm test:cov`**.

### Release

Every push to `main` that passes the `ci` job triggers the `release` job,
which calls the shared
[`node-release.yml`](https://github.com/sisques-labs/workflows/blob/main/.github/workflows/node-release.yml)
reusable workflow from `sisques-labs/workflows`. That workflow runs
[`semantic-release`](https://semantic-release.gitbook.io/) (config in
`.releaserc.json`), which determines the version bump from
[Conventional Commits](https://www.conventionalcommits.org/) since the last
release, updates `CHANGELOG.md`, publishes to npm with `pnpm publish` using
the **`NPM_TOKEN`** repository secret, commits the version bump, tags the
release (`vX.Y.Z`), and creates a GitHub Release with generated notes.

**Repository setup:** add an
[npm automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens)
with publish rights as the **`NPM_TOKEN`** secret (GitHub → Settings →
Secrets and variables → Actions).

### Publish from your machine

Not recommended — versioning and the changelog are owned by
`semantic-release` based on commit history on `main`. Merge conventional-commit
PRs into `main` instead and let the `release` job publish.

---

## Installation

```bash
pnpm add @sisques-labs/react-kit
# or: npm install / yarn add @sisques-labs/react-kit
```

## Peer Dependencies

`react`/`react-dom` are the only **required** peers — needed by the package
root (`useDebouncedValue`) and unconditionally by `/ui`. Everything else is
**optional**: install only what the subpath you import needs.

```bash
# Core (required for any use of the package)
pnpm add react react-dom

# /ui — shadcn/Radix component catalog
pnpm add @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-context-menu \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label \
  @radix-ui/react-popover @radix-ui/react-radio-group @radix-ui/react-select \
  @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-tooltip \
  lucide-react class-variance-authority clsx tailwind-merge cmdk \
  @tanstack/react-table sonner

# /next — route-handler proxy + next/image-based components
pnpm add next

# /http — axios / Apollo Client / TanStack Query factories
pnpm add axios @apollo/client @tanstack/react-query
```

### Entry Points / Subpath Exports

The package has dedicated entry points so importing the root never requires
an optional peer you don't use — the same pattern as `@sisques-labs/nestjs-kit`'s
`/mongodb`, `/graphql`, `/kafka` subpaths:

| Import | Contains | Requires |
|---|---|---|
| `@sisques-labs/react-kit` | Find-by-criteria domain interfaces/enums, `useDebouncedValue`, i18n helpers, `logHttpError`, `refreshTokenOnce` | `react` only |
| `@sisques-labs/react-kit/ui` | The full shadcn/Radix component catalog | Radix packages, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `cmdk`, `@tanstack/react-table`, `sonner` |
| `@sisques-labs/react-kit/next` | `proxyTo`/`internalUrl` route-handler passthrough, plus the 5 components that render `next/image` (`PhotoGrid`, `Lightbox`, `PhotoPicker`, `PlantCard`, `MediaCard`) | `next` |
| `@sisques-labs/react-kit/http` | `createBareHttp`, `createAxiosClient`, `createApolloClient`, `createQueryClient`, `ApolloClientProvider`, `ReactQueryProvider` | `axios`, `@apollo/client`, `@tanstack/react-query` |

### Tailwind CSS

react-kit ships **no Tailwind config, preset, or design tokens** — `/ui`
components emit Tailwind utility classes and reference CSS custom properties
(`--forest`, `--ink`, `--paper`, etc.) that your app's own design system
defines. Two things your app needs to provide:

1. Your own `theme.css`/`palettes.css` defining those CSS variables (see
   `gardenia-web`'s or `nextjs-template`'s `src/design-system/` for a
   reference implementation).
2. Tailwind's content/source scan must include the compiled package so its
   utility classes aren't purged:

   ```css
   @source "../node_modules/@sisques-labs/react-kit/dist/**/*.js";
   ```

---

## Local development

| Script | Description |
|---|---|
| `pnpm install` | Installs dependencies; **`prepare`** runs Husky and **`pnpm build`**. |
| `pnpm build` | Compiles TypeScript to `dist/` (`tsc` + `tsc-alias`). |
| `pnpm lint` / `pnpm lint:check` | ESLint (with/without `--fix`) on `src`. |
| `pnpm test` / `pnpm test:cov` | Vitest unit tests / with coverage (80% threshold). |
| `pnpm format` | Prettier on `src`. |

**Git hooks:** [Husky](https://typicode.github.io/husky/) runs
`pnpm lint && pnpm build && pnpm test` on **pre-commit**. To skip hooks for a
one-off commit: `HUSKY=0 git commit ...`.

---

## Core (package root)

```ts
import {
  type Filter, type Sort, type ListCriteria, type PaginatedResult, type CreatedEntity,
  FilterOperator, SortDirection,
  useDebouncedValue,
  t, isLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE, type WidenStringLiterals,
  logHttpError, refreshTokenOnce,
} from '@sisques-labs/react-kit';
```

- **Domain interfaces/enums** — the find-by-criteria shape (`Filter`,
  `Sort`, `ListCriteria`, `PaginatedResult`) and `FilterOperator`/
  `SortDirection`, mirroring the `@sisques-labs/nestjs-kit` GraphQL enums.
  `CreatedEntity` (`{ id: string }`) is the lightweight return shape a
  `create`/`update` mutation should use instead of re-fetching the entity.
- **`useDebouncedValue(value, delayMs = 300)`** — debounces a value before
  it drives a network query (search inputs, filters).
- **i18n helpers** — `t(template, vars)` interpolation, `isLocale`/
  `SUPPORTED_LOCALES`/`DEFAULT_LOCALE`, and `WidenStringLiterals<T>` for
  typing a translated locale dictionary against its source shape.
- **`logHttpError`** / **`refreshTokenOnce`** — the low-level pieces the
  `/http` factories build on; exported directly since they have zero
  framework dependencies.

## UI (`/ui`)

```tsx
import { Button, Input, Dialog, DataTable, FormField, cn } from '@sisques-labs/react-kit/ui';
```

The full shadcn/Radix component catalog (buttons, inputs, dialogs, tables,
charts, etc.) — named exports only, no default exports, `ref` passed as a
regular prop (React 19 ref-as-prop). See [Tailwind CSS](#tailwind-css) above
for the required content-scan setup.

## Next.js helpers (`/next`)

```ts
// app/api/plants/route.ts
import { NextRequest } from 'next/server';
import { proxyTo, internalUrl } from '@sisques-labs/react-kit/next';

export async function GET(req: NextRequest) {
  return proxyTo(req, internalUrl('/plants'));
}
```

`proxyTo`/`internalUrl` implement a Next.js route-handler passthrough to an
upstream API (strips hop-by-hop headers, forwards every `Set-Cookie`). This
subpath also carries the 5 `/ui`-style components that render `next/image`
(`PhotoGrid`, `Lightbox`, `PhotoPicker`, `PlantCard`, `MediaCard`) — they
live here instead of `/ui` so `/ui` stays usable without a `next` peer.

## HTTP client factories (`/http`)

react-kit ships **factories**, not singletons — each app builds its own
axios/Apollo/QueryClient instance, wiring its own token store and
multi-tenant headers via dependency injection instead of react-kit reaching
into an app-specific Zustand store.

### Wiring axios + Apollo with a shared 401 refresh

```ts
import {
  createBareHttp, createAxiosClient, createApolloClient, createQueryClient,
} from '@sisques-labs/react-kit/http';

const bareHttp = createBareHttp({ baseURL: API_URL });

async function refreshAccessToken(): Promise<string> {
  const res = await bareHttp.post<{ accessToken: string }>('/auth/refresh');
  useAuthStore.getState().setAccessToken(res.data.accessToken);
  return res.data.accessToken;
}

export const http = createAxiosClient({
  baseURL: API_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  // Optional — e.g. gardenia-web's multi-tenant X-Space-ID header.
  getExtraHeaders: (path) =>
    path.startsWith('/auth/') ? undefined : { 'X-Space-ID': useSpacesStore.getState().currentSpaceId ?? '' },
  refresh: refreshAccessToken,
  onAuthFailure: () => {
    useAuthStore.getState().clearAccessToken();
    useAuthStore.getState().redirectToLogin();
  },
});

export const apolloClient = createApolloClient({
  graphqlUrl: GRAPHQL_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  getExtraHeaders: () => ({ 'X-Space-ID': useSpacesStore.getState().currentSpaceId ?? '' }),
  refresh: refreshAccessToken, // SAME closure — one in-flight refresh covers both clients
  onAuthFailure: () => {
    useAuthStore.getState().clearAccessToken();
    useAuthStore.getState().redirectToLogin();
  },
});

export const queryClient = createQueryClient();
```

`createAxiosClient` and `createApolloClient` both call `refreshTokenOnce`
internally — passing the **same** `refresh` closure to both means a 401 from
REST and GraphQL arriving concurrently still triggers exactly one refresh
call, deduplicated via the module-level mutex in `refresh-mutex.ts`.

Then wire the providers:

```tsx
import { ApolloClientProvider, ReactQueryProvider } from '@sisques-labs/react-kit/http';
import { apolloClient, queryClient } from './http-clients';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ApolloClientProvider client={apolloClient}>
      <ReactQueryProvider client={queryClient}>{children}</ReactQueryProvider>
    </ApolloClientProvider>
  );
}
```

> If you previously used the hand-rolled `axios.client.ts`/`apollo.client.ts`
> pattern (module-level singletons reaching into a Zustand store directly),
> `getAccessToken`/`getExtraHeaders`/`onAuthFailure` are where that store
> access now lives — in your app, not in react-kit.
