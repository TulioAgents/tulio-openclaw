import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerLearningCli } from "./src/cli.js";
import { registerObserverHooks } from "./src/observer.js";
import { resolveLearningConfig } from "./src/trace-store.js";

export default definePluginEntry({
  id: "learning-core",
  name: "Learning (Core)",
  description: "Observes repeated workflows and generates human-reviewable draft skills",
  register(api) {
    registerObserverHooks(
      api,
      () => resolveLearningConfig(api.pluginConfig),
      () => api.config,
    );

    api.registerCli(
      ({ program }) => {
        registerLearningCli(program);
      },
      {
        descriptors: [
          {
            name: "learning",
            description: "Review and promote auto-generated skill candidates",
            hasSubcommands: true,
          },
        ],
      },
    );
  },
});
