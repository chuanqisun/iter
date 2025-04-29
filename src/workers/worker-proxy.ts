let previewWorker: Promise<Worker>;

export function preloadPreviewWorker() {
  previewWorker ??= import("./preview-worker?worker").then((WorkerModule) => {
    const worker = new WorkerModule.default();
    return worker;
  });

  return previewWorker;
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const portPair = new MessageChannel();
  const [workerPort, hostPort] = [portPair.port1, portPair.port2];

  const loadedWorker = preloadPreviewWorker();

  const promise = new Promise<string>((resolve, reject) => {
    hostPort.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data.html);
      }
    };
  });

  (await loadedWorker).postMessage({ markdown }, [workerPort]);

  return promise;
}

let tokenWorker: Promise<Worker>;

export function preloadTokenWorker() {
  tokenWorker ??= import("./token-worker?worker").then((WorkerModule) => {
    const worker = new WorkerModule.default();
    return worker;
  });
  return tokenWorker;
}

export async function getEstimatedTokenCount(text: string): Promise<number> {
  const portPair = new MessageChannel();
  const [workerPort, hostPort] = [portPair.port1, portPair.port2];
  const loadedWorker = preloadTokenWorker();
  const promise = new Promise<number>((resolve, reject) => {
    hostPort.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data.tokenCount);
      }
    };
  });

  (await loadedWorker).postMessage({ text }, [workerPort]);
  return promise;
}
