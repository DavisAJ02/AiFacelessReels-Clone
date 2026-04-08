export function pipelineLog(videoId, step, message, extra = {}) {
  const id = videoId || '—';
  const meta = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[pipeline:${step}] video=${id} ${message}${meta}`);
}
