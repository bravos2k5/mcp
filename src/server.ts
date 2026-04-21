import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generatedTools } from "./generated/tools.js";
import { createHandler } from "./handler.js";
import { createLogger } from "./utils/logger.js";
import {
  getServiceEnvironmentHandler,
  saveServiceEnvironmentHandler,
  getProjectEnvironmentHandler,
  saveProjectEnvironmentHandler,
} from "./environment-tools.js";

const logger = createLogger("MCP-Server");

function getEnabledTools() {
  const enabledTags = process.env.DOKPLOY_ENABLED_TAGS;

  if (!enabledTags) {
    return generatedTools;
  }

  const tags = new Set(
    enabledTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );

  const filtered = generatedTools.filter((tool) => tags.has(tool.tag.toLowerCase()));

  logger.info("Filtered tools by tags", {
    enabledTags: [...tags],
    total: generatedTools.length,
    loaded: filtered.length,
  });

  return filtered;
}

export function createServer() {
  const server = new McpServer({
    name: "dokploy",
    version: "2.0.0",
  });

  const tools = getEnabledTools();

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      tool.annotations ?? {},
      createHandler(tool),
    );
  }

  server.tool(
    "projectEnvironment-get",
    "Get environment variables for a project. Returns normalized envMap plus the reconstructed envText.",
    { projectId: z.string().min(1) },
    { title: "Get Project Environment Variables", readOnlyHint: true, idempotentHint: true },
    getProjectEnvironmentHandler,
  );

  server.tool(
    "projectEnvironment-save",
    "Save (update) environment variables for a project. The env parameter can be a string in KEY=VALUE format or an object map of env keys to values.",
    { projectId: z.string().min(1), env: z.union([z.string(), z.record(z.string(), z.string())]) },
    { title: "Save Project Environment Variables", idempotentHint: true },
    saveProjectEnvironmentHandler,
  );

  server.tool(
    "serviceEnvironment-get",
    "Get environment variables for a service (application, compose, postgres, mysql, mongo, redis, mariadb, or libsql). Returns normalized envMap plus the reconstructed envText.",
    {
      serviceType: z.enum(["application", "compose", "postgres", "mysql", "mongo", "redis", "mariadb", "libsql"]),
      serviceId: z.string().min(1),
    },
    { title: "Get Service Environment Variables", readOnlyHint: true, idempotentHint: true },
    getServiceEnvironmentHandler,
  );

  server.tool(
    "serviceEnvironment-save",
    "Save (update) environment variables for a service. The env parameter can be a string in KEY=VALUE format or an object map of env keys to values.",
    {
      serviceType: z.enum(["application", "compose", "postgres", "mysql", "mongo", "redis", "mariadb", "libsql"]),
      serviceId: z.string().min(1),
      env: z.union([z.string(), z.record(z.string(), z.string())]),
    },
    { title: "Save Service Environment Variables", idempotentHint: true },
    saveServiceEnvironmentHandler,
  );

  return server;
}
