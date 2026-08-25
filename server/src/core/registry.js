/**
 * Cross-module calls. A module publishes a capability by name; consumers resolve
 * it by name. No imports across modules, no queries into another module's database.
 */

const services = new Map();

// KEEP IN SYNC with the real service contract. A mock that is missing a method
// fails at runtime only for the developers who rely on it — the ones who cannot
// see the real module. Treat this file as part of the module contract.
const mocks = {
  inventory: {
    checkStock: async (sku, quantity) => ({ sku, quantity, available: true, onHand: 999, reason: null, mock: true }),
    priceOf: async () => 100000,
    describe: async (sku) => ({ sku, name: `${sku} (mock product)`, price: 100000 }),
    commit: async () => null,
  },
  finance: {
    invoiceFor: async (orderId) => ({ orderId, amount: 0, status: 'mock', mock: true }),
  },
};

export function provide(name, implementation) {
  services.set(name, implementation);
}

export function resolve(name) {
  if (services.has(name)) return { service: services.get(name), mocked: false, available: true };
  const allowMocks = process.env.ALLOW_MOCKS !== 'false';
  if (allowMocks && mocks[name]) return { service: mocks[name], mocked: true, available: true };
  return { service: null, mocked: false, available: false };
}

export function status() {
  const names = new Set([...services.keys(), ...Object.keys(mocks)]);
  return [...names].sort().map((name) => {
    const { mocked, available } = resolve(name);
    return { service: name, state: !available ? 'unavailable' : mocked ? 'mock' : 'live' };
  });
}
