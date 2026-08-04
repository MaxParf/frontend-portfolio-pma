export function createMediaPreviewStore({ createObjectURL = URL.createObjectURL, revokeObjectURL = URL.revokeObjectURL } = {}) {
  const previews = new Map();
  return {
    replace(mediaId, file) {
      const previous = previews.get(mediaId);
      if (previous) revokeObjectURL(previous.objectUrl);
      const objectUrl = createObjectURL(file);
      previews.set(mediaId, { file, objectUrl });
      return objectUrl;
    },
    get(mediaId) { return previews.get(mediaId) ?? null; },
    remove(mediaId) { const item = previews.get(mediaId); if (item) revokeObjectURL(item.objectUrl); previews.delete(mediaId); },
    dispose() { [...previews.keys()].forEach((mediaId) => this.remove(mediaId)); },
  };
}
