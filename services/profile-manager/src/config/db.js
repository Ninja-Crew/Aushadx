/**
 * DB connection helper for the profile-manager service.
 *
 * This module attempts to dynamically import `mongoose` at runtime so the
 * project won't fail to load if `mongoose` isn't installed. If you intend
 * to use MongoDB, install `mongoose` (e.g. `npm install mongoose`) and set
 * the `MONGO_URI` environment variable.
 */

/**
 * Connects to MongoDB using Mongoose.
 * @param {object} options
 * @param {object} options.logger - Logger with `info`/`warn`/`error` methods
 * @param {object} options.env - Environment object with `MONGO_URI` and optional options
 * @returns {Promise<object>} The connected mongoose instance
 */
export async function connectDB({ logger = console, env = {} } = {}) {
  const mongoUri = env.MONGO_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    const msg =
      "MONGO_URI is not set. Set the MONGO_URI environment variable to connect to MongoDB.";
    logger && logger.error ? logger.error(msg) : console.error(msg);
    throw new Error(msg);
  }

  let mongooseModule;
  try {
    // Dynamically import mongoose so the module works even if mongoose isn't installed.
    const imported = await import("mongoose");
    mongooseModule = imported.default || imported;
  } catch (err) {
    const msg =
      "Dependency `mongoose` is missing. Run `npm install mongoose` to enable MongoDB support.";
    logger && logger.error ? logger.error(msg) : console.error(msg);
    throw new Error(msg);
  }

  const mongoose = mongooseModule;

  // Recommended connection options
  const connectOpts = {
    // keep other options configurable via env if necessary
    ...(env.MONGO_OPTIONS || {}),
  };

  try {
    await mongoose.connect(mongoUri, connectOpts);
    logger && logger.info
      ? logger.info("MongoDB connected")
      : console.log("MongoDB connected");
    return mongoose;
  } catch (err) {
    logger && logger.error
      ? logger.error("MongoDB connection error", err)
      : console.error(err);
    throw err;
  }
}

export default connectDB;
