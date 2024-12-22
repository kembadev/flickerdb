import { expect } from 'chai';
import { FlickerDB } from '../core/flicker.js';
import fs from 'node:fs';

describe('getTotalEntries method', () => {
	const file = 'get-total-entries.test.json';
	const db = new FlickerDB<string>(file);

	afterEach(async () => {
		await db.clearAll();
	});

	after(() => {
		fs.unlinkSync(file);
	});

	it('should get 2 as total entries', async () => {
		const data = ['a', 'b'];
		await db.add(data);

		const totalEntries = await db.getTotalEntries();

		expect(totalEntries).to.be.equal(2);
	});
});
