import { describeServiceContract } from '../src/testing/service-contract.js';
import { makeMemoryFixture } from '../src/testing/memory-repos.js';

describeServiceContract('in-memory repositories', makeMemoryFixture);
