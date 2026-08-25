/**
 * Async side-effects between modules. Finance never imports Sales; it subscribes
 * to `order.created`. Swap the internals for RabbitMQ / Kafka / Mongo change
 * streams without touching a single module.
 */

const handlers = new Map();

export function on(eventName, moduleName, handler) {
  if (!handlers.has(eventName)) handlers.set(eventName, []);
  handlers.get(eventName).push({ moduleName, handler });
}

export async function emit(eventName, payload) {
  const subs = handlers.get(eventName) || [];
  for (const { moduleName, handler } of subs) {
    try {
      await handler(payload);
    } catch (err) {
      console.error(`[events] ${moduleName} failed on ${eventName}:`, err.message);
    }
  }
  return subs.map((s) => s.moduleName);
}

export function subscriptions() {
  return Object.fromEntries([...handlers.entries()].map(([e, s]) => [e, s.map((x) => x.moduleName)]));
}
