export function createEnqueue() {
  let queue = Promise.resolve();

  function enqueue(fn) {
    queue = queue.then(fn, fn);
    return queue;
  }

  return enqueue;
}

export async function tryParseJson(response) {
  return response.json().catch(() => ({}));
}
