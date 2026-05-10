// Public surface of the yamaguchi-camera module.
// Default export is the React view component; named exports expose
// the pure logic so callers can reuse types or test transitions.

export { default } from './yamaguchi-camera';
export * from './state';
export type { Msg } from './message';
export { update } from './update';
export * as presenter from './presenter';
