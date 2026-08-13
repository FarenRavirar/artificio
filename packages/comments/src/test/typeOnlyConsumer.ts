import type {
  CommentsResourceState,
  CommentsTransport,
} from '../index.js';

export type TypeOnlyConsumerContract = {
  readonly state: CommentsResourceState<readonly string[]>;
  readonly transport: CommentsTransport<'thread.read'>;
};
