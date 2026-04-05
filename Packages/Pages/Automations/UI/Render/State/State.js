export function createAgentsPageState() {
  return {
    agents: [],
    allModels: [],
    editingId: null,
    deletingId: null,
    editingEnabled: true,
    primaryModel: null,
    fallbackModels: [],
    jobs: [],
  };
}
