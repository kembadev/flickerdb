import { expect } from 'chai';
import { FlickerDB } from '../core/flicker.js';
import fs from 'node:fs';

describe('remove method', () => {
	const file = 'remove.test.json';
	const db = new FlickerDB<string>(file);

	afterEach(async () => {
		await db.clearAll();
	});

	after(() => {
		fs.unlinkSync(file);
	});

	it('should remove entries', async () => {
		const data = ['remove me', 'data'];
		await db.add(data);

		const removedEntries = await db.remove(({ data }) => data === 'remove me');
		expect(removedEntries).to.be.equal(1);
	});

	it('should not remove any entry', async () => {
		await db.addOne('data');

		const removedEntries = await db.remove(() => false);
		expect(removedEntries).to.be.equal(undefined);
	});

	it('should not modify db', async () => {
		await db.remove(() => true);

		const dbContent = fs.readFileSync(file, { encoding: 'utf-8' });
		expect(dbContent).to.be.equal('{}');
	});
});
