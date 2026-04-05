import {
  definePluginEntry,
  type AnyAgentTool,
  type OpenClawPluginService,
  type OpenClawPluginServiceContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { createOpenSpecGatewayHandlers } from "./src/openspec-gateway.js";
import { createOpenSpecChangeTool, createOpenSpecTaskTool } from "./src/openspec-tool.js";
import { createOpenSpecProjectsTool } from "./src/projects-tool.js";

function createOpenSpecService(): OpenClawPluginService {
  return {
    id: "openspec",
    async start(ctx: OpenClawPluginServiceContext): Promise<void> {
      ctx.logger.info("OpenSpec plugin started");
    },
    async stop(_ctx: OpenClawPluginServiceContext): Promise<void> {
      // Nothing to clean up
    },
  };
}

export default definePluginEntry({
  id: "openspec",
  name: "OpenSpec",
  description:
    "OpenSpec multi-agent development system for managing changes, phases, and agent coordination.",
  register(api) {
    // Register the openspec_change tool for agents
    api.registerTool(createOpenSpecChangeTool(api) as AnyAgentTool);

    // Register the openspec_task tool for agents
    api.registerTool(createOpenSpecTaskTool(api) as AnyAgentTool);

    // Register the openspec_projects tool for agents
    api.registerTool(createOpenSpecProjectsTool(api) as AnyAgentTool);

    // Register gateway methods for the dashboard
    const gatewayHandlers = createOpenSpecGatewayHandlers(api);
    api.registerGatewayMethod("openspec.projects.list", gatewayHandlers.handleProjectsList, {
      scope: "operator.read",
    });
    api.registerGatewayMethod("openspec.changes.list", gatewayHandlers.handleChangesList, {
      scope: "operator.read",
    });
    api.registerGatewayMethod("openspec.changes.detail", gatewayHandlers.handleChangesDetail, {
      scope: "operator.read",
    });
    api.registerGatewayMethod("openspec.agents.status", gatewayHandlers.handleAgentsStatus, {
      scope: "operator.read",
    });
    api.registerGatewayMethod("openspec.tasks.list", gatewayHandlers.handleTasksList, {
      scope: "operator.read",
    });

    // Register the lifecycle service
    api.registerService(createOpenSpecService());
  },
});
