import apiClient from "./utils/apiClient.js";
import { createLogger } from "./utils/logger.js";
import { ResponseFormatter } from "./utils/responseFormatter.js";

const logger = createLogger("EnvironmentTools");

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

async function getServiceEnvironment(serviceType: ServiceType, serviceId: string) {
  const response = await apiClient.get(pathMap[serviceType], {
    params: { [paramMap[serviceType]]: serviceId },
  });
  return response.data?.env || "";
}

async function saveServiceEnvironment(serviceType: ServiceType, serviceId: string, env: string) {
  await apiClient.post(savePathMap[serviceType], {
    [paramMap[serviceType]]: serviceId,
    env,
  });
}

export async function getServiceEnvironmentHandler(input: Record<string, unknown>) {
  try {
    const { serviceType, serviceId } = input as { serviceType: ServiceType; serviceId: string };
    if (!serviceTypes.includes(serviceType)) {
      return ResponseFormatter.error("Invalid serviceType", `Must be one of: ${serviceTypes.join(", ")}`);
    }
    logger.info(`Getting environment for ${serviceType}`, { serviceId });

    const env = await getServiceEnvironment(serviceType, serviceId);

    return ResponseFormatter.success(
      `Successfully retrieved environment for ${serviceType}`,
      { serviceType, serviceId, env },
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
    const { serviceType, serviceId, env } = input as { serviceType: ServiceType; serviceId: string; env: string };
    if (!serviceTypes.includes(serviceType)) {
      return ResponseFormatter.error("Invalid serviceType", `Must be one of: ${serviceTypes.join(", ")}`);
    }
    if (!env) {
      return ResponseFormatter.error("env is required", "Please provide env parameter");
    }
    logger.info(`Saving environment for ${serviceType}`, { serviceId, envLength: env.length });

    await saveServiceEnvironment(serviceType, serviceId, env);

    return ResponseFormatter.success(
      `Successfully saved environment for ${serviceType}`,
      { serviceType, serviceId },
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

    const environments = response.data || [];
    const envVariables = environments
      .map((env: { env?: string }) => env.env || "")
      .join("\n");

    return ResponseFormatter.success(
      "Successfully retrieved project environments",
      { projectId, environments, envVariables },
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
    const { projectId, env } = input as { projectId: string; env: string };
    if (!env) {
      return ResponseFormatter.error("env is required", "Please provide env parameter");
    }
    logger.info("Saving environment for project", { projectId, envLength: env.length });

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
      env,
    });

    return ResponseFormatter.success(
      "Successfully saved project environment",
      { projectId, environmentId },
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