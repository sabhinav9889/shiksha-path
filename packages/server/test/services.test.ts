import { describeServiceContract } from '../src/testing/service-contract.js';
import { describeAdminContract } from '../src/testing/admin-contract.js';
import { describeCommunityContract } from '../src/testing/community-contract.js';
import { describePostRepoContract } from '../src/testing/post-repo-contract.js';
import { describeStaffContract } from '../src/testing/staff-contract.js';
import { makeMemoryFixture } from '../src/testing/memory-repos.js';

describeServiceContract('in-memory repositories', makeMemoryFixture);
describeStaffContract('in-memory repositories', makeMemoryFixture);
describeAdminContract('in-memory repositories', makeMemoryFixture);
describePostRepoContract('in-memory repositories', makeMemoryFixture);
describeCommunityContract('in-memory repositories', makeMemoryFixture);
