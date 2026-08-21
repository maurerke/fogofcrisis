import path from "path";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  scenarioPath:
    process.env.SCENARIO_PATH ||
    path.resolve(__dirname, "../../../../scenarios/ransomware_stadtwerke.json"),
  dbPath:
    process.env.DB_PATH ||
    path.resolve(__dirname, "../../../../data/cybercrisis.sqlite"),
  adminApiKey: process.env.ADMIN_API_KEY || "",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  nodeEnv: process.env.NODE_ENV || "development",
  reconnectTimeoutMs: parseInt(process.env.RECONNECT_TIMEOUT_MS || "300000", 10),
};

/**
 * Validate critical configuration at startup.
 * Throws if production deployment is misconfigured.
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (config.nodeEnv === "production") {
    if (!config.adminApiKey || config.adminApiKey === "changeme") {
      errors.push("ADMIN_API_KEY must be set to a strong secret in production (not 'changeme').");
    }
    if (config.frontendOrigin === "http://localhost:5173") {
      errors.push("FRONTEND_ORIGIN should be set to the actual deployment URL in production.");
    }
  }

  if (config.adminApiKey === "changeme") {
    console.warn(
      "\n⚠️  WARNING: ADMIN_API_KEY is set to 'changeme'. This is insecure.\n" +
      "   Set ADMIN_API_KEY environment variable to a strong secret before deploying.\n"
    );
  }

  if (!config.adminApiKey && config.nodeEnv !== "development") {
    errors.push("ADMIN_API_KEY must be set in non-development environments.");
  }

  if (errors.length > 0) {
    console.error("\n[CONFIG ERROR] Invalid configuration:");
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error("\nPlease check your environment variables. See .env.example for reference.\n");
    process.exit(1);
  }
}
