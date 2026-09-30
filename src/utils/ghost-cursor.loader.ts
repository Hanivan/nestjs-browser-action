// Loaded lazily: only workflows with `cursor` pay the import. Isolated here so
// specs can jest.mock it.
export const loadGhostCursor = () => import('ghost-cursor');
