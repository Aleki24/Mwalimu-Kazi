/// <reference types="nativewind/types" />

// The global stylesheet is consumed by Metro via nativewind/metro, not by
// TypeScript; this declares the side-effect import so tsc accepts it.
declare module '*.css';
