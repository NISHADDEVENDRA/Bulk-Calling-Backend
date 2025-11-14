"use strict";

/**
 * Create or update an admin/super-admin user.
 *
 * Usage:
 *   node scripts/createAdmin.js email=admin@example.com password=StrongPass123 name="Admin User" [role=admin] [resetPassword=true]
 *
 * Optional flags:
 *   role=admin|super_admin  (default: admin)
 *   resetPassword=true      (only needed when updating an existing account)
 */

const bcrypt = require("bcrypt");
const { connectDB, disconnectDB } = require("../server/config/db");
const { User } = require("../server/models/User");
const { logger } = require("../server/utils/logger");

const parseArgs = () => {
  return process.argv.slice(2).reduce((acc, arg) => {
    const cleanArg = arg.replace(/^--/, "");
    const [key, ...rest] = cleanArg.split("=");
    if (!key) {
      return acc;
    }
    const value = rest.join("=") || "";
    acc[key] = value;
    return acc;
  }, {});
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (!value) return false;
  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
};

const REQUIRED_FIELDS = ["email", "password", "name"];

const validateArgs = (args) => {
  const missing = REQUIRED_FIELDS.filter((field) => !args[field]);
  if (missing.length) {
    throw new Error(
      `Missing required fields: ${missing.join(
        ", "
      )}\nExample: node scripts/createAdmin.js email=admin@example.com password=StrongPass123 name="Admin User"`
    );
  }
};

const createOrUpdateAdmin = async () => {
  const args = parseArgs();
  validateArgs(args);

  const email = args.email.toLowerCase();
  const password = args.password;
  const name = args.name;
  const role = args.role || "admin";
  const resetPassword = parseBoolean(args.resetPassword || "false");

  if (!["admin", "super_admin"].includes(role)) {
    throw new Error('Role must be either "admin" or "super_admin"');
  }

  await connectDB();

  let user = await User.findOne({ email }).select("+password");
  if (user) {
    logger.info("Admin seeding: user exists, updating role/name", { email });
    user.name = name;
    user.role = role;
    if (resetPassword) {
      user.password = await bcrypt.hash(password, 10);
      logger.info("Password reset for existing admin", { email });
    } else {
      logger.info(
        "Existing admin password preserved (use resetPassword=true to override)",
        { email }
      );
    }
    await user.save();
    logger.info("Admin user updated successfully", {
      email,
      role: user.role,
    });
  } else {
    logger.info("Admin seeding: creating new user", { email });
    const hashedPassword = await bcrypt.hash(password, 10);
    user = await User.create({
      email,
      password: hashedPassword,
      name,
      role,
      credits: 0,
      isActive: true,
    });
    logger.info("Admin user created successfully", { email, role });
  }
};

(async () => {
  try {
    await createOrUpdateAdmin();
  } catch (error) {
    logger.error("Failed to seed admin user", { error: error.message });
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
    process.exit();
  }
})();


// npm run seed:admin -- email=devendranishad981@gmail.com password=Devendra@123 name="Devendra" role=admin resetPassword=true