import { test as base } from '@playwright/test';
import path from 'path';

export const testLicensePath = path.join(__dirname, 'test-license.jpg');

// Re-export test data for convenience
export { testUser, testEnterprise, testAdmin, testPartyA, testRequirement, simpleRequirement, expectedAnalysis } from './test-data';
import path from 'path';

export const testLicensePath = path.join(__dirname, 'test-license.jpg');
