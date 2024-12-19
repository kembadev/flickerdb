# 💾FlickerDB

Create posts db and add the first post:

```js
import FlickerDB from 'flickerdb';

const postsDB = new FlickerDB('db/posts');

postsDB.addOne({ title: 'post 1', content: 'this is my first post' });
```

## Description

Local JSON database based on the file system. Designed for maximum memory efficiency, it features robust error handling, and a variety and easy-to-use methods for seamless integration 🚀

## Requirements

### Node.js

[Node.js](https://nodejs.org/en/) version 16 or newer.

## ⚡Features

- Type-safe (made in [Typescript](https://www.typescriptlang.org/)).
- Atomic write.
- Memmory-friendly.
- Robust error handling 💪

## Installation

```bash
npm install flickerdb
```

## Usage

Create posts db and add the first post:

```ts
import FlickerDB from 'flickerdb';

type Post = { title: string; content: string };

const postsDB = new FlickerDB<Post>('db/posts');

postsDB
	.addOne({ title: 'post 1', content: 'this is my first post' })
	.then(id => console.log("post's id:", id))
	.catch(err => console.error('could not add the post. error code:', err.code));
```

In db/posts.json:

```json
{"d98821f5-87a6-47c8-bb46-8af04a65c7ba":{"title":"post 1","content":"this is my first post"}}
```

Get 10 posts where the title property contains the substring 'funko pop'

```js
postsDB
	.find(entry => entry.data.title.includes('funko pop'), { limit: 10 })
	.then(result => {
		if (!result) return console.log('no matches found');

		console.log('posts found:', result.entries);
	})
	.catch(() => console.log('something went wrong'));
```

More examples [here](https://github.com/kembadev/flickerdb/tree/master/src/examples).

> [!WARNING]
> Manipulating the database file manually could arise unexpected behaviors and frequent thrown exceptions. Avoid doing it in favor to keep things working 😎

## API

### 💾FlickerDB

Initializes db. Usage: `new FlickerDB(PathLike, FlickerOptions)`.

- `PathLike`: string, URL or Buffer.
- `FlickerOptions`:
  - `overwrite`: Whether overwrite the previous content when init db or not. `Default: true`.
  - `stringify`: The desired serialization method to use. `Default: JSON.stringify`.

```js
import FlickerDB from 'flickerdb';

const db = new FlickerDB('db', { overwrite: false });
```

#### Instance methods:

- `add`: add new entries to db. Usage: `db.add(Array<data>)`.

```js
const ids = await db.add(['data1', 'data2']);

console.log(ids.length); // output: 2
```

- `addOne`: add new entry to db. Usage: `db.addOne(data)`.

```js
const id = await db.addOne('data1');

console.log("entry's id:", id);
```

> [!NOTE]
> You should use add over addOne in those cases where you want to add more than one entry at a time. addOne uses add under the hood so using it several times instead of using add is slower. This behavior is not exclusive of add and addOne, since other methods do similar things.

- `find`: get an object that contains a list of entries and other properties. Usage: `db.find(matcherFn, FilterOptions)`.

  - `matcherFn`: a function that takes each entry as argument. A return value of true indicates that the entry meet the match.
  - `FilterOptions`:
    - `limit`: limits the number of entries to search. `Default: Infinity`.
    - `offset`: indicates from where to start saving the entries. For example,
  if the offset is set to 3, the first 3 entries matched are ignore.
  Values less than 0 are interpreted as 0. `Default: 0`.
    - `holdTillMatch`: once the limit has been reached, the search is intended to stop.
  If `holdTillMatch` is true, the search stops just after one more match
  is found (which is not added to final entries), preventing from stop
  when limit is reached. This is useful in scenarios where you wanna know
  whether there are more matches in addition to offset + limit.
  For example, if you apply pagination maybe you wanna know whether
  some entry left or not. `Default: false`.

```js
// get 10 entries whose data content includes the word "empanada",
// ignoring the first 3 matches (offset = 3)
const result = await db.find(({ data }) => /empanada/gi.test(data), {
	limit: 10,
	offset: 3,
	// if exactly 13 matches were found (offset + limit),
	// the search will stop after finding one more entry,
	// which is not added to the final entries in the return value.
	holdTillMatch: true,
});

if (!result) return console.log('no match found');

const { entries, wereThereMatchesLeft } = result;

console.log('matches found:', entries);

console.log(
	wereThereMatchesLeft
		? 'there are still more matches in db'
		: 'these are all matches in db',
);

// if holdTillMatch were false, wereThereMatchesLeft would be false too
```

- `findById`: get the entry's data identified by the `id` argument. Usage: `db.findById(id)`.

```js
const data = await db.findById('d98821f5-87a6-47c8-bb46-8af04a65c7ba');

if (!data) return console.log('entry not found');

console.log("entry's data:", data);
```

- `remove`: remove entries from db. Usage: `db.remove(matcherFn)`.

  - `matcherFn`: a function that takes each entry as argument. A return value of true indicates that the entry must be removed.

```js
// remove all entries whose data content doesn't include the word "empanada"
const removedEntries = await db.remove(
	({ data }) => !/empanada/gi.test(data),
);

if (!removedEntries) return console.log('no match found');

console.log(`${removedEntries} entries were removed`);
```

- `removeById`: remove an entry by its id. Usage: `db.removeById(id)`.

```js
const result = await db.removeById('d98821f5-87a6-47c8-bb46-8af04a65c7ba');

if (!result) return console.log('entry not found');

console.log('entry removed correctly!');
```

- `clearAll`: remove all entries from db. Usage: `db.clearAll()`.

```js
await db.clearAll();
```

- `update`: update entries from db. Usage: `db.update(fn)`.

  - `fn`: a function that takes each entry as argument. A return value of undefined means that that entry must be ignored (do not update).

```js
const beerReg = /beer/gi;

// update all entries whose data content includes the word "beer"
const updatedEntries = await db.update(({ data }) => {
	// do not update those entries whose data content does not include the word "beer"
	if (!beerReg.test(data)) return;

	return data.replace(beerReg, '🍺');
});

if (!updatedEntries) return console.log('no match found');

console.log(`${updatedEntries} entries were updated`);
```

- `updateById`: update entry by its id. Usage: `db.updateById(id, modifierFn)`.

  - `id`: entry's id.
  - `modifierFn`: a function that takes the entry's data identified by `id` as argument. The entry's data will be replaced by the return value of `modifierFn`.

```js
const result = await db.updateById(
	'd98821f5-87a6-47c8-bb46-8af04a65c7ba',
	data => 'new value',
);

if (!result) return console.log('entry not found');

console.log('entry updated correctly!');
```

> [!NOTE]
> Almost all methods require reading the database file during execution, so the time it takes to execute each method depends on the size of the database 😱. When possible, consider splitting databases that are intended to store large amounts of data to improve performance.

### 💥FlickerError

FlickerDB's instances methods might throw exceptions. These errors are instances of FlickerError. FlickerError objects have two important properties: `message` and `code`.

- `code`: error code assigned to each type of error. Example values: 'MISSING_FILE', 'SERIALIZATION_ERROR'.

## 🦉Final thoughts

This library is not intended to replace more scalable, secure and, in general, better solutions like MySQL, MongoDB, etc. It has limited capabilities and use cases. You can use it for small projects or as a complement to other options. Use it wisely within its intended scope for optimal results ✨
