export function subscribeDocsReload(onReload: () => void): () => void {
  const source = new EventSource('/api/events');
  source.onmessage = () => {
    onReload();
  };
  return () => {
    source.close();
  };
}
