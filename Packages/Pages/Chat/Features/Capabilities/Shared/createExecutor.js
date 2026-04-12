export function createExecutor({ name: name, tools: tools, handlers: handlers }) {
  const HANDLED = new Set(tools);
  return {
    handles: function (toolName) {
      return HANDLED.has(toolName);
    },
    execute: async function (toolName, params, hooksOrOnStage = () => {}) {
      const handler = handlers[toolName];
      if (!handler) throw new Error(`${name}: unknown tool "${toolName}"`);
      const hooks = (function (hooksOrOnStage) {
        return 'function' == typeof hooksOrOnStage
          ? { onStage: hooksOrOnStage }
          : hooksOrOnStage && 'object' == typeof hooksOrOnStage
            ? hooksOrOnStage
            : {};
      })(hooksOrOnStage);
      return handler(params, hooks.onStage ?? (() => {}), hooks);
    },
  };
}
