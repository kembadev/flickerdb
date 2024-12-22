import { expect } from 'chai';
import { FlickerDB } from '../core/flicker.js';
import fs from 'node:fs';

describe('find method', () => {
	const file = 'find.test.json';
	const db = new FlickerDB<string>(file);

	afterEach(async () => {
		await db.clearAll();
	});

	after(() => {
		fs.unlinkSync(file);
	});

	it('should find entries', async () => {
		const data = ['find me', 'data'];
		await db.add(data);

		const { entries } = (await db.find(({ data }) => data === 'find me'))!;
		expect(entries).to.have.lengthOf(1);
	});

	it('should bring exactly 2 entries', async () => {
		const data = ['a', 'b', 'c'];
		await db.add(data);

		const { entries } = (await db.find(() => true, { limit: 2 }))!;
		expect(entries).to.have.lengthOf(2);
	});

	it('should return undefined', async () => {
		const data = ['a', 'b', 'c'];
		await db.add(data);

		const result = await db.find(({ data }) => data === 'd');
		expect(result).to.be.equal(undefined);
	});

	it('should apply offset correctly', async () => {
		const data = ['a', 'b', 'c', 'd'];
		await db.add(data);

		const { entries } = (await db.find(() => true, { offset: 2 }))!;

		expect(entries).to.have.lengthOf(2);

		const [{ data: data1 }, { data: data2 }] = entries;
		expect(data1).to.equal('c');
		expect(data2).to.equal('d');
	});

	it('should apply limit and offset correctly', async () => {
		const data = ['a', 'b', 'c', 'd', 'e'];
		await db.add(data);

		const { entries } = (await db.find(() => true, { limit: 2, offset: 1 }))!;

		expect(entries).to.have.lengthOf(2);

		const [{ data: data1 }, { data: data2 }] = entries;
		expect(data1).to.equal('b');
		expect(data2).to.equal('c');
	});

	it('should handle holdTillMatch correctly', async () => {
		const data = ['a', 'b', 'c', 'd', 'e'];
		await db.add(data);

		const { entries, wereThereMatchesLeft } = (await db.find(() => true, {
			limit: 2,
			holdTillMatch: true,
		}))!;

		expect(entries).to.have.lengthOf(2);
		expect(wereThereMatchesLeft).to.be.equal(true);
	});
});
