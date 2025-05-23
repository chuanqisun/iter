import { Observable } from "rxjs";

/**
 * doWork is an expensive function. When it is running, skip the stream. But make sure doWork is called with the last value
 * this assumes producer is faster than consumer
 * and the work will be completed in the order of the input stream
 * input stream is finite, and will complete
 */
export function skipWhenBusy<T, K>(stream: Observable<T>, doWork: (data: T) => Promise<K>): Observable<K> {
  return new Observable<K>((subscriber) => {
    let isBusy = false;
    let lastSkippedValue: T | undefined;
    const subscription = stream.subscribe({
      next: (value) => {
        if (isBusy) {
          lastSkippedValue = value;
        } else {
          isBusy = true;
          lastSkippedValue = undefined;
          doWork(value)
            .then((result) => subscriber.next(result))
            .finally(() => (isBusy = false));
        }
      },
      error: (err) => subscriber.error(err),
      complete: async () => {
        if (lastSkippedValue !== undefined) {
          doWork(lastSkippedValue)
            .then((result) => subscriber.next(result))
            .finally(() => subscriber.complete());
        } else {
          subscriber.complete();
        }
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  });
}
