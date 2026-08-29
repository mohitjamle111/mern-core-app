import { getUserModel, hasPermission } from './auth.js';

/**
 * The `users` capability.
 *
 * The users COLLECTION stays core-owned — login and token verification depend on
 * it, so it can never live in a repo that might be absent. What is published
 * here is a narrow service, registered into the core registry exactly like
 * Inventory publishes `checkStock`.
 *
 * The user-administration module consumes this. It never imports the User model,
 * never touches merndemo_core, and can be withheld from developers who should not
 * have user-admin source — while login keeps working for everyone.
 */

const PUBLIC_FIELDS = '-password';

class ServiceError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Nobody can hand out access they do not themselves hold. */
function assertGrantable(actor, permissions = []) {
  const ungrantable = permissions.filter((p) => !hasPermission(actor, p));
  if (ungrantable.length) {
    throw new ServiceError(403, 'Cannot grant permissions you do not hold', { ungrantable });
  }
}

export function createUserService() {
  return {
    async list() {
      const User = getUserModel();
      return User.find().select(PUBLIC_FIELDS).sort({ email: 1 }).lean();
    },

    async create(actor, { email, name, password, roles = [], permissions = [] }) {
      const User = getUserModel();
      if (!email || !password) throw new ServiceError(400, 'email and password are required');
      if (await User.findOne({ email })) throw new ServiceError(409, `${email} already exists`);
      assertGrantable(actor, permissions);

      const user = await User.create({ email, name, password, roles, permissions });
      const { password: _omit, ...safe } = user.toObject();
      return safe;
    },

    async update(actor, id, patch) {
      const User = getUserModel();
      const allowed = {};
      for (const field of ['name', 'roles', 'permissions', 'password']) {
        if (patch?.[field] !== undefined) allowed[field] = patch[field];
      }
      if (allowed.permissions) assertGrantable(actor, allowed.permissions);

      // Do not let an admin lock themselves out of user administration.
      if (String(id) === String(actor.sub) && allowed.permissions
          && !allowed.permissions.includes('*') && !allowed.permissions.includes('users:write')) {
        throw new ServiceError(400, 'Refusing to remove users:write from your own account');
      }

      const user = await User.findByIdAndUpdate(id, allowed, { new: true }).select(PUBLIC_FIELDS).lean();
      if (!user) throw new ServiceError(404, 'No such user');
      return user;
    },

    async remove(actor, id) {
      if (String(id) === String(actor.sub)) {
        throw new ServiceError(400, 'You cannot delete your own account');
      }
      const User = getUserModel();
      const user = await User.findByIdAndDelete(id).select(PUBLIC_FIELDS).lean();
      if (!user) throw new ServiceError(404, 'No such user');
      return user;
    },
  };
}

export { ServiceError };
