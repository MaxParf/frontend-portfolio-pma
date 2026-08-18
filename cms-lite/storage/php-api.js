import { loadPrivateState, savePrivateState } from "../api.js";

export function createPhpStorage({ getToken }) {
  return {
    clearsPendingMedia: true,
    async load() { return loadPrivateState(getToken()); },
    async save(state, pendingMedia) {
      const form = new FormData();
      form.set("state", JSON.stringify({ baseVersion: state.version, projects: state.projects }));
      form.set("pendingMedia", JSON.stringify(pendingMedia.map(({ file, objectUrl, ...media }) => media)));
      pendingMedia.forEach((media) => form.append(`uploads[${media.id}]`, media.file));
      return savePrivateState(getToken(), form);
    },
  };
}
