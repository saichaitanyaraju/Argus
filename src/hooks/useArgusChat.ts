import { useCallback } from 'react';
import {
  askLyzrAgent,
  AgentProxyError,
  type AgentErrorCode,
  type AskLyzrAgentArgs,
  getAgentFriendlyErrorMessage,
} from '../lib/lyzrAgent';

const MAX_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ArgusChatResult =
  | {
      ok: true;
      answer: string;
    }
  | {
      ok: false;
      errorCode: AgentErrorCode;
      message: string;
    };

export function useArgusChat() {
  const sendMessage = useCallback(async (args: AskLyzrAgentArgs): Promise<ArgusChatResult> => {
    let retry = 0;

    while (retry <= MAX_RETRIES) {
      try {
        const response = await askLyzrAgent(args);
        return { ok: true, answer: response.answer };
      } catch (error) {
        const code =
          error instanceof AgentProxyError ? error.code : ('SERVICE_UNAVAILABLE' as AgentErrorCode);
        if (retry >= MAX_RETRIES) {
          return {
            ok: false,
            errorCode: code,
            message: getAgentFriendlyErrorMessage(code),
          };
        }

        const delay = 1000 * 2 ** retry;
        await sleep(delay);
      }

      retry += 1;
    }

    return {
      ok: false,
      errorCode: 'SERVICE_UNAVAILABLE',
      message: getAgentFriendlyErrorMessage('SERVICE_UNAVAILABLE'),
    };
  }, []);

  return { sendMessage };
}

