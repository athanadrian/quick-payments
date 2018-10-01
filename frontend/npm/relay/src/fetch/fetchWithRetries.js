// @flow

import {sprintf, warning} from '_utils';

const fetch = require('./fetch');

export type InitWithRetries = {
  body?: mixed,
  cache?: ?string,
  credentials?: ?string,
  fetchTimeout?: ?number,
  headers?: mixed,
  method?: ?string,
  mode?: ?string,
  retryDelays?: ?Array<number>,
};

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = [1000, 3000];

/**
 * Makes a POST request to the server with the given data as the payload.
 * Automatic retries are done based on the values in `retryDelays`.
 */
export default function fetchWithRetries(
  uri: string,
  initWithRetries?: ?InitWithRetries,
): Promise<any> {
  const {fetchTimeout, retryDelays, ...init} = initWithRetries || {};
  const _fetchTimeout = fetchTimeout != null ? fetchTimeout : DEFAULT_TIMEOUT;
  const _retryDelays = retryDelays != null ? retryDelays : DEFAULT_RETRIES;

  let requestsAttempted = 0;
  let requestStartTime = 0;

  return new Promise((resolve, reject) => {
    /**
     * Sends a request to the server that will timeout after `fetchTimeout`.
     * If the request fails or times out a new request might be scheduled.
     */
    function sendTimedRequest(): void {
      requestsAttempted++;
      requestStartTime = Date.now();
      let isRequestAlive = true;
      const request = fetch(uri, init);
      const requestTimeout = setTimeout(() => {
        isRequestAlive = false;
        if (shouldRetry(requestsAttempted)) {
          warning(false, `fetchWithRetries: HTTP timeout (${uri}), retrying.`);
          retryRequest();
        } else {
          reject(
            new Error(
              sprintf(
                `fetchWithRetries: Failed to get response from server (${uri}), tried %s times.`,
                requestsAttempted,
              ),
            ),
          );
        }
      }, _fetchTimeout);

      request
        .then(response => {
          clearTimeout(requestTimeout);
          if (isRequestAlive) {
            // We got a response, we can clear the timeout.
            if (response.status >= 200 && response.status < 300) {
              // Got a response code that indicates success, resolve the promise.
              resolve(response);
            } else if (shouldRetry(requestsAttempted)) {
              // Fetch was not successful, retrying.
              // TODO(#7595849): Only retry on transient HTTP errors.
              warning(false, `fetchWithRetries: HTTP error (${uri}), retrying.`);
              retryRequest();
            } else {
              // Request was not successful, giving up.
              const error: any = new Error(
                sprintf(
                  'fetchWithRetries: Still no successful response after ' +
                    '%s retries, giving up.',
                  requestsAttempted,
                ),
              );
              error.response = response;
              reject(error);
            }
          }
        })
        .catch(error => {
          clearTimeout(requestTimeout);
          if (shouldRetry(requestsAttempted)) {
            retryRequest();
          } else {
            reject(error);
          }
        });
    }

    /**
     * Schedules another run of sendTimedRequest based on how much time has
     * passed between the time the last request was sent and now.
     */
    function retryRequest(): void {
      const retryDelay = _retryDelays[requestsAttempted - 1];
      const retryStartTime = requestStartTime + retryDelay;
      // Schedule retry for a configured duration after last request started.
      setTimeout(sendTimedRequest, retryStartTime - Date.now());
    }

    /**
     * Checks if another attempt should be done to send a request to the server.
     */
    function shouldRetry(attempt: number): boolean {
      return attempt <= _retryDelays.length;
    }

    sendTimedRequest();
  });
}