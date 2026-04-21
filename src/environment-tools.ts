import apiClient from "./utils/apiClient.js";
import { createLogger } from "./utils/logger.js";
import { ResponseFormatter } from "./utils/responseFormatter.js";

const logger = createLogger("EnvironmentTools");

export type EnvMap = Record<string, string>;

export const serviceTypes = [
  "application",
  "compose",
  "postgres",
  "mysql",
  "mongo",
  "redis",
  "mariadb",
  "libsql",
] as const;

export type ServiceType = (typeof serviceTypes)[number];

const pathMap: Record<ServiceType, string> = {
  application: "/application.one",
  compose: "/compose.one",
  postgres: "/postgres.one",
  mysql: "/mysql.one",
  mongo: "/mongo.one",
  redis: "/redis.one",
  mariadb: "/mariadb.one",
  libsql: "/libsql.one",
};

const paramMap: Record<ServiceType, string> = {
  application: "applicationId",
  compose: "composeId",
  postgres: "postgresId",
  mysql: "mysqlId",
  mongo: "mongoId",
  redis: "redisId",
  mariadb: "mariadbId",
  libsql: "libsqlId",
};

const savePathMap: Record<ServiceType, string> = {
  application: "/application.saveEnvironment",
  compose: "/compose.saveEnvironment",
  postgres: "/postgres.saveEnvironment",
  mysql: "/mysql.saveEnvironment",
  mongo: "/mongo.saveEnvironment",
  redis: "/redis.saveEnvironment",
  mariadb: "/mariadb.saveEnvironment",
  libsql: "/libsql.saveEnvironment",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvText(envText: string): EnvMap {
  const envMap: EnvMap = {};

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const value = rawLine.slice(separatorIndex + 1).replace(/\r$/, "");
    envMap[key] = value;
  }

  return envMap;
}

function serializeEnvMap(envMap: EnvMap): string {
  return Object.entries(envMap)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function normalizeEnvInput(env: unknown): { envMap: EnvMap; envText: string } {
  if (typeof env === "string") {
    return {
      envMap: parseEnvText(env),
      envText: env,
    };
  }

  if (isRecord(env)) {
    const envMap = Object.entries(env).reduce<EnvMap>((accumulator, [key, value]) => {
      if (typeof value === "string") {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});

    return {
      envMap,
      envText: serializeEnvMap(envMap),
    };
  }

  throw new Error("env must be a string or an object map");
}

async function getServiceEnvironment(serviceType: ServiceType, serviceId: string) {
  const response = await apiClient.get(pathMap[serviceType], {
    params: { [paramMap[serviceType]]: serviceId },
  });
  const envText = response.data?.env || "";
  return {
    envText,
    envMap: parseEnvText(envText),
  };
}

async function saveServiceEnvironment(serviceType: ServiceType, serviceId: string, envText: string) {
  await apiClient.post(savePathMap[serviceType], {
    [paramMap[serviceType]]: serviceId,
    env: envText,
  });
}

export async function getServiceEnvironmentHandler(input: Record<string, unknown>) {
  try {
    const { serviceType, serviceId } = input as { serviceType: ServiceType; serviceId: string };
    if (!serviceTypes.includes(serviceType)) {
      return ResponseFormatter.error("Invalid serviceType", `Must be one of: ${serviceTypes.join(", ")}`);
    }
    logger.info(`Getting environment for ${serviceType}`, { serviceId });

    const { envText, envMap } = await getServiceEnvironment(serviceType, serviceId);

    return ResponseFormatter.success(
      `Successfully retrieved environment for ${serviceType}`,
      { serviceType, serviceId, envMap, envText },
    );
  } catch (error) {
    logger.error("Failed to get service environment", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return ResponseFormatter.error(
      "Failed to get service environment",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export async function saveServiceEnvironmentHandler(input: Record<string, unknown>) {
  try {
    const { serviceType, serviceId, env } = input as {
      serviceType: ServiceType;
      serviceId: string;
      env: string | Record<string, unknown>;
    };
    if (!serviceTypes.includes(serviceType)) {
      return ResponseFormatter.error("Invalid serviceType", `Must be one of: ${serviceTypes.join(", ")}`);
    }
    if (!env) {
      return ResponseFormatter.error("env is required", "Please provide env parameter");
    }
    const normalizedEnv = normalizeEnvInput(env);
    logger.info(`Saving environment for ${serviceType}`, { serviceId, envLength: normalizedEnv.envText.length });

    await saveServiceEnvironment(serviceType, serviceId, normalizedEnv.envText);

    return ResponseFormatter.success(
      `Successfully saved environment for ${serviceType}`,
      { serviceType, serviceId, envMap: normalizedEnv.envMap },
    );
  } catch (error) {
    logger.error("Failed to save service environment", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return ResponseFormatter.error(
      "Failed to save service environment",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export async function getProjectEnvironmentHandler(input: Record<string, unknown>) {
  try {
    const { projectId } = input as { projectId: string };
    logger.info("Getting environment for project", { projectId });

    const response = await apiClient.get("/environment.byProjectId", {
      params: { projectId },
    });

    const environments: Array<{ env?: string; [key: string]: unknown }> = response.data || [];
    const normalizedEnvironments = environments.map((environment) => {
      const envText = environment.env || "";

      return {
        ...environment,
        envText,
        envMap: parseEnvText(envText),
      };
    });

    const envMap = normalizedEnvironments.reduce((accumulator: EnvMap, environment) => {
      return { ...accumulator, ...environment.envMap };
    }, {});

    const envText = serializeEnvMap(envMap);

    return ResponseFormatter.success(
      "Successfully retrieved project environments",
      { projectId, environments: normalizedEnvironments, envMap, envText },
    );
  } catch (error) {
    logger.error("Failed to get project environment", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return ResponseFormatter.error(
      "Failed to get project environment",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export async function saveProjectEnvironmentHandler(input: Record<string, unknown>) {
  try {
    const { projectId, env } = input as { projectId: string; env: string | Record<string, unknown> };
    if (!env) {
      return ResponseFormatter.error("env is required", "Please provide env parameter");
    }
    const normalizedEnv = normalizeEnvInput(env);
    logger.info("Saving environment for project", { projectId, envLength: normalizedEnv.envText.length });

    const response = await apiClient.get("/environment.byProjectId", {
      params: { projectId },
    });

    const environments = response.data || [];
    if (environments.length === 0) {
      return ResponseFormatter.error(
        "No environment found for project",
        "Please create an environment first",
      );
    }

    const environmentId = environments[0].environmentId;

    await apiClient.post("/environment.update", {
      environmentId,
      env: normalizedEnv.envText,
    });

    return ResponseFormatter.success(
      "Successfully saved project environment",
      { projectId, environmentId, envMap: normalizedEnv.envMap },
    );
  } catch (error) {
    logger.error("Failed to save project environment", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return ResponseFormatter.error(
      "Failed to save project environment",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}