export function createAgentsPageState() {
  return {
    agents: [],
    allModels: [],
    editingId: null,
    deletingId: null,
    editingEnabled: !0,
    primaryModel: null,
    jobs: [],
  };
}
