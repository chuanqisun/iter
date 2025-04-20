import { Observable } from "rxjs";
import PreviewWorker from "./worker?worker";
const worker = new PreviewWorker();

/**
 * emit the stream when isBusy is false, skip the value when isBusy is true
 * however, when the stream completes, make sure to emit the last value
 */
export function skipWhenBusy<T>(stream: Observable<T>, isBusy: () => boolean): Observable<T> {
  return new Observable<T>((subscriber) => {
    let lastSkippedValue: T | undefined;
    const subscription = stream.subscribe({
      next: (value) => {
        if (isBusy()) {
          lastSkippedValue = value;
        } else {
          subscriber.next(value);
          lastSkippedValue = undefined;
        }
      },
      error: (err) => subscriber.error(err),
      complete: () => {
        if (lastSkippedValue !== undefined) {
          subscriber.next(lastSkippedValue);
        }
        subscriber.complete();
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  });
}

export function markdownToHtml(markdown: string): Promise<string> {
  const portPair = new MessageChannel();
  const [workerPort, hostPort] = [portPair.port1, portPair.port2];

  const promise = new Promise<string>((resolve, reject) => {
    hostPort.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data.html);
      }
    };
  });
  worker.postMessage({ markdown }, [workerPort]);

  return promise;
}
