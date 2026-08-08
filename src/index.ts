// ─── Domain ──────────────────────────────────────────────────────────────────

export * from './core/domain/interfaces/created-entity.interface';
export * from './core/domain/interfaces/filter.interface';
export * from './core/domain/interfaces/list-criteria.interface';
export * from './core/domain/interfaces/paginated-result.interface';
export * from './core/domain/interfaces/sort.interface';
export * from './core/domain/enums/filter-operator.enum';
export * from './core/domain/enums/sort-direction.enum';

// ─── Hooks ───────────────────────────────────────────────────────────────────

export * from './core/hooks/use-debounced-value/use-debounced-value.hook';

// ─── i18n ────────────────────────────────────────────────────────────────────

export * from './core/i18n/interpolate';
export * from './core/i18n/locale';
export * from './core/i18n/widen-literals';

// ─── HTTP (framework-agnostic) ─────────────────────────────────────────────────

export * from './core/http/http-logger';
export * from './core/http/refresh-mutex';

// UI (Radix/shadcn catalog), Next.js-specific helpers, and stateful HTTP
// client factories live in dedicated subpaths so they don't pull in their
// optional peer dependencies from the root import:
// '@sisques-labs/react-kit/ui', '/next', '/http'.
